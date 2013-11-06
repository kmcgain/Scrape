var deferred = require('deferred');
var http = require('http');
var cheerio = require('cheerio');
var deferWorkLib = require('./deferWork');
var pageLoader = require('./pageLoader');
var promisify = deferred.promisify;
var tDeferred = deferWorkLib.trackedDeferred;

exports.getReviewDetails = function(hotelLocationId, reviews) {
	if (reviews.length == 0) {
		return deferred(0);
	}

	var def = new tDeferred();

	reviewIds = reviews.map(function(review) { return review.Id; })
		.join(',');

	target = reviews[0].Id;

	href = 'http://www.tripadvisor.com.au/ExpandedUserReviews-' + hotelLocationId +
			'?target=' + target + '&context=1&reviews=' + reviewIds + 
			'&servlet=Hotel_Review&expand=1&extraad=true&extraadtarget=' + target;

	pageLoader.load(href)
	.then(function(body) {		
		var $ = cheerio.load(body);

		reviews.forEach(function(review) {
			var reviewSelector = $('#expanded_review_' + review.Id);

			if (reviewSelector.length != 1) {
				console.log('problem with review download');
				throw new Error('Problem with review ' + review.Id);
			}

			review.Message = reviewSelector.find('.entry').text();
			review.Rating = parseFloat(reviewSelector.find('.sprite-ratings').attr('content'));
			review.Quote = reviewSelector.find('.quote a').text();
		});		

		def.resolve();
	});
	
	return def.promise;
}