var http = require('follow-redirects').http;
var cheerio = require('cheerio');
var deferred = require('deferred');
var defWorkLib = require('./deferWork');
var deferWork = defWorkLib.deferWork;
var mapSyncronously = defWorkLib.mapSyncronously;
var Review = require('./review').Review;
var getReviewDetails = require('./review-get').getReviewDetails;
var url = require('url');
var trip = require('./Trip');
var Hotel = require('./hotel').Hotel;
var tDeferred = defWorkLib.trackedDeferred;
var tDefMap = defWorkLib.trackedMap;
require('./arrayExt');

var promisify = deferred.promisify;

var $ = null;

var loadPlace = function(href, progressId) {	
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

var continueLoading = function(href, progressId) {
	if (exports.logger) {
		exports.logger.verbose('Loading: ' + href);
	}

	var def = new tDeferred();

	var hrefCopied = href;
	
	http.get(href, closeOverLoadResponse(href, progressId, def))
	.on("error", function(e) {
		console.log(e);
		throw new Error(e);
	});	

	return def.promise;
};

var closeOverLoadResponse = function(href, progressId, def, childProcessor) {
	var loadResponse = function(resp) {
		if (resp.statusCode != 200) {
			throw new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href);
		}

		var respParts = [];
		resp.on("data", function(chunk) {
			respParts.push(chunk);
		});

		resp.on('end', function() {
			var body = respParts.join('');
			var resolutionHandler = null;

			$ = cheerio.load(body);

			var selecter = null;

			// Process the reviews without the use of a new queue job
			if (href.match(/\/Hotel_Review/)) {	
				// TODO: make this align with the other cases so we can refactor.	
				console.log('processing child ' + href);	
				// processChildHotel(progressId, href, $)
				// .then(function () {
				// 	console.log('reviews done for ' + href);
				// 	progressRegistry.markAsComplete(progressId);
				// 	def.resolve();
				// })
				// .done();	
				progressRegistry.markAsComplete(progressId);
				def.resolve();
				return;	
			}
			
			if (href.match(/\/Tourism-/)) {
				var viewHotels = $('#HSCS_SEE_ALL');

				selecter = viewHotels.length == 0 
					? $('.lodging .summaryLink')
					: viewHotels;			

				if (selecter.length == 0) {
					// No hotels for this location
					progressRegistry.markAsComplete(progressId);

					def.resolve();
					return; 
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

			var childHrefs = selecter.map(function() {return $(this).attr('href');});

			progressRegistry.setNumberOfExpectedChildren(childHrefs.length, progressId);		

			// Here we will resolve immediatelly after queuing more work
			processChildren(childHrefs, progressId);		
			def.resolve();
		});
	}

	return loadResponse;
};

var placeWorkerFunction = function(err, workItem) {
	processChild(workItem.href, workItem.progressId)
	.done();
}

var processChildren = function(childHrefs, progressId) {
	var workData = childHrefs.map(function(childHref) {
		return {progressId: progressId, href: childHref};
	});

	if (exports.workerQueue == null) {
		throw new Error('The worker queue has not been initialised');
	}

	exports.workerQueue.push(workData, placeWorkerFunction);
}

var processChildHotel = function(href, progressId, $) {
	return processChild(progressId, href, function(absHref, prog) {
		return processHotel(absHref, prog, $);
	});
}

var processChild = function(href, progressId, childProcessor) {
	var absHref = getUrl(href);	

	var def = new tDeferred();

	tDefMap(progressRegistry.getChildren(progressId))
	.then(function(children) {
		progressRegistry.findByHref(children, absHref)
		.then(function(child) {

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
			.then(function(newProgress) {		
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

var processHotel = function(href, progressId, $) {
	if (exports.logger) {
		progressRegistry.getUrl(progressId)
		.then(function(url) {
			exports.logger.verbose('Process Hotel: ' + href + ' from prog: ' + url);	
		})
		.done();
	}

	return deferred(0);
	var def = deferred();

	progressRegistry.getHotel(href, progressId)
	.then(function(hotelId) {
		var reviewPromises = [];

		var theseReviews = [];
		$('#REVIEWS .reviewSelector').each(function() {
			var elem = this;	
			var review = new Review(this.attr('id').match(/review_(.*)/)[1]);
			theseReviews.push(review);
		});

		exports.logger.verbose('Hotel review count: ' + theseReviews.length + ' for hotel: ' + href);

		// NOTE: Async
		hotelRegistry.addReviews(hotelId, theseReviews);

		reviewPromises.push(getReviewDetails(hotel, theseReviews));

		if (!isHotelLandingPage(href)) {
			// We don't want page the reviews

			if (reviewPromises.length == 0) {
				return deferred(0);
			}

			return tDefMap(reviewPromises);
		}

		hotelRegistry.setTitle(hotelId, $('#HEADING').text().trim());

		// page the reviews
		var pageCountTxt = $('.pagination .pgCount').text();
		var pcMatch = pageCountTxt.match(/1-\d+ of (\d+) reviews/);

		if (!pcMatch || pcMatch.length == 0) {
			// no reviews?
			progressRegistry.markAsComplete(progressId);
			return deferred(0);
		}

		var totalNumberOfReviews = pcMatch[1];
		
		for (var i = 10; i < totalNumberOfReviews; i += 10) {
			var reviewHref = getReviewPageRef(href, i);
			reviewPromises.push(
				loadPlace(reviewHref, progressId)
			);
		}

		return deferWork(function() {
			return tDefMap(reviewPromises);
		}, function() {
			console.log('The entire hotel has been completed at this point');
			hotelRegistry.markAsComplete(hotelId);
		});
	})
	.then(function() {
		def.resolve();
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

exports.load = loadPlace;
exports.logger = null;
exports.workerQueue = null;
var progressRegistry = null;
exports.setProgressRegistry = function(pr) {
	progressRegistry = pr;
};

// TODO: Copied and pasted
function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}