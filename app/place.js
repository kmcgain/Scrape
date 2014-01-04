"use strict";

var cheerio = require("cheerio");

var defWorkLib = require("./deferWork");
var deferred = defWorkLib.deferred;
var deferWork = defWorkLib.deferWork;
var mapSyncronously = defWorkLib.mapSyncronously;
var Review = require("./review").Review;
var getReviewDetails = require("./review-get").getReviewDetails;
var url = require("url");
var trip = require("./Trip");
var Hotel = require("./hotel").Hotel;
var deferred = defWorkLib.deferred;
var mapDeferred = defWorkLib.map;
require("./arrayExt");

var pageLoader = require("./pageLoader");

var promisify = deferred.promisify;

var $ = null;

function loadPlace(href, progressId) {
	var def = deferred();
	// NOTE: This will prevent the change in data over time
	progressRegistry.isComplete(progressId)
	.then(function(isComplete) {
		if (isComplete) {
			return def.resolve();
		}

		continueLoading(href, progressId)
		.then(def.resolve)
		.done();
	})
	.done();
		
	return def.promise;
}

function continueLoading(href, progressId) {
	if (exports.logger) {
		exports.logger.verbose('Loading: ' + href);
	}

	var def = new deferred();

	var hrefCopied = href;
	
	var pageLoadId = {href: href, rand: Math.random()};
	exports.loadTracker.newPageLoad(pageLoadId);
	pageLoader.load(href)
	.then(function pageLoaded(body) {
		exports.loadTracker.endPageLoad(pageLoadId);
		handleResponse(body, href, progressId)
		.then(def.resolve)
		.done();
	})
	.done();

	return def.promise;
}

function deRef(str) {
	return (str + ' ').substring(0, str.length);
}

function handleResponse(body, href, progressId) {
	$ = cheerio.load(body);

	var selecter = null;

	// Process the reviews without the use of a new queue job
	if (href.match(/\/Hotel_Review/)) {
		// TODO: make this align with the other cases so we can refactor.	
		console.log('processing child ' + href);
		return deferred(0);

		var allReviewIds = [];
		$('#REVIEWS .reviewSelector').each(function() {
			allReviewIds.push(deRef(this.attr('id')));
		});
		var hotelInfo = {
			allReviewIds: allReviewIds,
			hotelTitle: deRef($('#HEADING').text().trim()),
			pageCount: deRef($('.pagination .pgCount').text()),
		};

		return processChildHotel(progressId, href, hotelInfo);
	}
	
	if (href.match(/\/Tourism-/)) {
		var viewHotels = $('#HSCS_SEE_ALL');

		selecter = viewHotels.length === 0 
			? $('.lodging .summaryLink')
			: viewHotels;			

		if (selecter.length === 0) {
			// No hotels for this location
			progressRegistry.markAsComplete(progressId);
			return deferred(0); 
		}
	}
	else if (href.match(/\/Hotels-/)) {			
		selecter = $('#ACCOM_OVERVIEW .listing .property_title');
	}
	else if (href.match(/\/AllLocations-/)) {
		selecter = $('#BODYCON table td a');
	}
	
	else {
		console.log('Specifal Url: ' + href);
	}

	var childHrefs = selecter.map(function hrefMapper() {return deRef($(this).attr('href'));});

	progressRegistry.setNumberOfExpectedChildren(childHrefs.length, progressId);		

	// Here we will resolve immediatelly after queuing more work
	processChildren(childHrefs, progressId);	
	return deferred(0);	
}

function placeWorkerFunction(err, workItem, def) {
	processChild(workItem.href, workItem.progressId)
	.done(function placeWorkerChildProcessed(){
		def.resolve();
	});
}

function processChildren(childHrefs, progressId) {
	var workData = childHrefs.map(function childHrefMapper(childHref) {
		return {progressId: progressId, href: childHref};
	});

	if (exports.workerQueue == null) {
		throw new Error('The worker queue has not been initialised');
	}

	addWorkItem(workData, placeWorkerFunction);	
}

function addWorkItem(data, cb) {
	data.forEach(function(item) {
		exports.workerQueue.unshift({data: item, workerFunc: cb}, null);
	});	
}

function processChildHotel(href, progressId, hotelInfo) {
	return processChild(progressId, href, function childHotelProcessed(absHref, prog) {
		return processHotel(absHref, prog, hotelInfo);
	});
}

function processChild(href, progressId, childProcessor) {
	var absHref = getUrl(href);	

	var def = new deferred();

	mapDeferred(progressRegistry.getChildren(progressId))
	.then(function gotChildren(children) {
		progressRegistry.findByHref(children, absHref)
		.then(function progressFound(child) {

			if (child != null) {				
				if (progressRegistry.isComplete(child)) {
					def.resolve();	
					return;			
				}

				var newProgressPromise = deferred(child);
			}
			else {
				var newProgressPromise = progressRegistry.newProgress(absHref, progressId);			
			}

			newProgressPromise
			.then(function newProgressLoaded(newProgress) {		
				if (childProcessor != null) {
					childProcessor(absHref, newProgress)
					.then(def.resolve)
					.done();
					return;
				}

				loadPlace(absHref, newProgress)
				.then(def.resolve)
				.done();
			})
			.done();
		})
		.done();
	})
	.done();

	return def.promise;
}

function processHotel(href, progressId, hotelInfo) {
	if (exports.logger) {
		progressRegistry.getUrl(progressId)
		.then(function gotUrl(url) {
			exports.logger.verbose('Process Hotel: ' + href + ' from prog: ' + url);
		})
		.done();
	}

	var def = deferred();

	var hotelLocationId = href.match(/Hotel_Review-(\w*-\w*)-Reviews/)[1];
	if (!hotelLocationId) {
		throw new Error('Bad hotel location id');
	}

	var idForHotel = null;
	var theseReviews = [];

	getHotel(hotelLocationId, progressId)
	.then(function gotHotel(hotelId) {
		idForHotel = hotelId;

		var reviewIdPromises = [];
		hotelInfo.allReviewIds.forEach(function(reviewId) {
			var reviewIdPromise = hotelRegistry.createReview(hotelId, reviewId.match(/review_(.*)/)[1]);			
			reviewIdPromises.push(reviewIdPromise);			
		});

		var reviewPromises = [];

		if (reviewIdPromises.length != 0) {
			var getReviewsDef = deferred();
			reviewPromises.push(getReviewsDef.promise);

			mapDeferred(reviewIdPromises)
			.then(function(reviewIds) {
				exports.logger.verbose('Hotel review count: ' + reviewIds.length + ' for hotel: ' + href);
				getReviewDetails(hotelLocationId, hotelId, reviewIds, hotelRegistry)
				.then(function() {
					getReviewsDef.resolve();
				})
				.done()
			})
			.done();
		}
		
		if (!isHotelLandingPage(href)) {
			// We don't want to page the reviews

			if (reviewPromises.length == 0) {
				return deferred(0);
			}

			return mapDeferred(reviewPromises);
		}

		hotelRegistry.setTitle(hotelId, hotelInfo.hotelTitle);

		// page the reviews
		var pageCountTxt = hotelInfo.pageCount;
		var pcMatch = pageCountTxt.match(/1-\d+ of ([\d,]+) review/);

		if (!pcMatch || pcMatch.length == 0) {
			// no reviews?
			if (reviewPromises.length != 0) {
				console.log(pageCountTxt);
				throw new Error('Not implemented ' + href);
			}
			progressRegistry.markAsComplete(progressId);
			return deferred(0);
		}

		var totalNumberOfReviews = parseInt(pcMatch[1].replace(',', ''));

		hotelRegistry.setNumberOfExpectedReviews(hotelId, totalNumberOfReviews);
		
		for (var i = 10; i < totalNumberOfReviews; i += 10) {
			var reviewHref = getReviewPageRef(href, i);

			var work = [{progressId: progressId, href: reviewHref, hotelId: hotelId}];
			addWorkItem(work, placeWorkerFunction);			
		}

		return mapDeferred(reviewPromises);
	})
	.then(function reviewSetFinished() {
		def.resolve();
	})
	.done();	

	return def.promise;
}

// TODO: Refactor into a hotelservice
var getHotel = function(locationId, parentId) {
	var def = deferred();

	progressRegistry.getAuxData(parentId, 'Hotel')
	.then(function(hotelId){		
		var hotelExists = hotelId != null;

		var promise = hotelExists
				? deferred(hotelId)
				: hotelRegistry.getHotelByLocationId(locationId, parentId);

		promise
		.then(function(hotelId) {
			if (!hotelExists) {
				progressRegistry.setAuxData(parentId, 'Hotel', hotelId);
			}

			def.resolve(hotelId);
		}) 
		.done();
	})
	.done();

	return def.promise;	
};

function getReviewPageRef(href, pageCount) {
	var regex = /(.*Hotel_Review-\w*-\w*-Reviews-)(.*)/;
	var newHref = href.replace(regex, '$1or' + pageCount + '-$2');
	return newHref;
}

function isHotelLandingPage(href) {
	var isHotelLandingPage = !href.match(/Hotel_Review-\w*-\w*-Reviews-or*/);
	return isHotelLandingPage;
}

exports.loadTrack = null;
exports.load = loadPlace;
exports.logger = null;
exports.workerQueue = null;
var progressRegistry = null;
exports.setProgressRegistry = function setProgressRegistry(pr) {
	progressRegistry = pr;
};

var hotelRegistry;
exports.setHotelRegistry = function setHotelRegistry(hr) {
	hotelRegistry = hr;
}

// TODO: Copied and pasted
function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}