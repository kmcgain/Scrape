var deferred = require('deferred');
var request = require('request');
var cheerio = require('cheerio');
var deferWorkLib = require('./deferWork');
var promisify = deferred.promisify;
var tDeferred = deferWorkLib.trackedDeferred;

exports.getReviewDetails = function(hotel, reviews) {
	if (reviews.length == 0) {
		return deferred(0);
	}

	var def = new tDeferred();

	reviewIds = reviews.map(function(review) { return review.Id; })
		.join(',');

	target = reviews[0].Id;

	href = 'http://www.tripadvisor.com.au/ExpandedUserReviews-' + hotel.LocationId +
			'?target=' + target + '&context=1&reviews=' + reviewIds + 
			'&servlet=Hotel_Review&expand=1&extraad=true&extraadtarget=' + target;

	request(href, function(error, resp, body) {
		if (error) {throw new Error(error);}
		if (resp.statusCode != 200) {
			throw new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href);
		}


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

	}).setMaxListeners(0);

	return def.promise();
}