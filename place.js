var request = require('request');
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

var promisify = deferred.promisify;

var loadPlace = function(href, progressObj) {
	// NOTE: This will prevent the change in data over time
	if (progressObj.IsComplete) {
		return new deferred(0);
	}

	if (exports.logger) {
		exports.logger.verbose('Loading: ' + href);
	}

	if (href.match(/Daylesford/)) {
		debugger;
	}

	var def =  deferred();

	var hrefCopied = href;
	
	request({uri: href, followRedirect: true, maxRedirects: 20}, function(error, resp, body) {	
		if (hrefCopied.match(/Daylesford/)) {
			debugger;
		}
		if (error) {throw new Error(error);}
		if (resp.statusCode != 200) {
			throw new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href);
		}

		var resolutionHandler = null;

		var $ = cheerio.load(body);

		//var redirectedUrl = resp.request.uri.href;
		

		var selecter = null;
		if (href.match(/\/Tourism-/)) {
			var viewHotels = $('#HSCS_SEE_ALL');

			if (href == "http://www.tripadvisor.com.au/Tourism-g499623-Daylesford_Victoria-Vacations.html") {
				debugger;
			}
			if (href == "http://www.tripadvisor.com.au/Tourism-g552127-Aireys_Inlet_Victoria-Vacations.html") {
				debugger;
			}
			if (viewHotels.length == 0) {
				// No hotels for this location
				progressObj.IsComplete = true;

				def.resolve();
				return;
			}

			selecter = viewHotels;					
		}

		if (href.match(/\/Hotels-/)) {			
			selecter = $('#ACCOM_OVERVIEW .listing .property_title');
		}
		
		if (href.match(/\/AllLocations-/)) {
			selecter = $('#BODYCON table td a');				
		}

		// Special Case
		if (href.match(/\/Hotel_Review/)) {	
			// TODO: make this align with the other cases so we can refactor.		
			processChildHotel(progressObj, href, $)
			.then(function () {
				progressObj.IsComplete = true;
				def.resolve();
			})
			.done();		

			return;	
		}

		var childHrefs = selecter.map(function() {return $(this).attr('href');});

		mapSyncronously(childHrefs, function(item) {
			return processChild(item, progressObj);
		})		
		.then(function () {
			progressObj.IsComplete = true;		
			def.resolve();
		})
		.done();
	});	

	return def.promise;
};

var processChildHotel = function(href, progress, $) {
	return processChild(progress, href, function(absHref, prog) {
		return processHotel(absHref, prog, $);
	});
}

var processChild = function(href, progress, childProcessor) {
	var absHref = getUrl(href);	

	var def = new deferred();

	deferred.map(progress.GetChildren(), function(item){return item})
	.then(function(children) {
		var child = children.singleOrNone(function(elem) { return elem.Url == absHref; });

		if (child != null) {
			if (child.IsComplete) {
				def.resolve();	
				return;			
			}

			var newProgress = child;
		}
		else {
			var newProgress = progress;
			if (progress.Hotel == null) {			
				newProgress = new trip.Progress(absHref, progress);
				progress.AddChild(newProgress);
			}
		}

		if (childProcessor != null) {
			childProcessor(absHref, newProgress)
			.then(def.resolve)
			.done();
		}

		loadPlace(absHref, newProgress)
		.then(def.resolve)
		.done();
	})
	.done();

	return def.promise;
}

var processHotel = function(href, progressObj, $) {
	if (exports.logger) {
		exports.logger.verbose('Process Hotel: ' + href + ' from prog: ' + progressObj.Url);
	}

	if (progressObj.Hotel == null) {
		progressObj.Hotel = new Hotel(href.match(/Hotel_Review-(\w*-\w*)-Reviews/)[1]);
	}

	var hotel = progressObj.Hotel;	

	var reviewPromises = [];

	var theseReviews = [];
	$('#REVIEWS .reviewSelector').each(function() {
		var elem = this;	
		var review = new Review(this.attr('id').match(/review_(.*)/)[1]);
		theseReviews.push(review);
	});
	hotel.Reviews = hotel.Reviews.concat(theseReviews);
	reviewPromises.push(getReviewDetails(hotel, theseReviews));

	if (!isHotelLandingPage(href)) {
		// We don't want page the reviews

		if (reviewPromises.length == 0) {
			return deferred(0);
		}

		return deferred.map(reviewPromises);
	}

	progressObj.Hotel.Title = $('#HEADING').text().trim();

	// page the reviews
	var pageCountTxt = $('.pagination .pgCount').text();
	var pcMatch = pageCountTxt.match(/1-\d+ of (\d+) reviews/);

	if (!pcMatch || pcMatch.length == 0) {
		// no reviews?
		progressObj.IsComplete = true;
		return deferred(0);
	}

	var totalNumberOfReviews = pcMatch[1];
	
	for (var i = 10; i < totalNumberOfReviews; i += 10) {
		var reviewHref = getReviewPageRef(href, i);
		reviewPromises.push(
			loadPlace(reviewHref, progressObj)
		);
	}

	return deferWork(function() {
		return deferred.map(reviewPromises);
	}, function() {
		console.log('The entire hotel has been completed at this point');
		progressObj.Hotel.IsComplete = true;
	});
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

// TODO: Copied and pasted
function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}