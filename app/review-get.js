var cheerio = require('cheerio');
var deferWorkLib = require('./deferWork');
var pageLoader = require('./pageLoader');


var deferred = deferWorkLib.deferred;
var promisify = deferred.promisify;

exports.getReviewDetails = function getReviewDetails(hotelLocationId, hotelId, reviewIds, hotelRegistry) {
	if (reviewIds.length == 0) {
		return deferred(0);
	}	

	var def = new deferred();

	joinedReviewIds = reviewIds.join(',');

	target = reviewIds[0];

	href = 'http://www.tripadvisor.com.au/ExpandedUserReviews-' + hotelLocationId +
			'?target=' + target + '&context=1&reviews=' + joinedReviewIds + 
			'&servlet=Hotel_Review&expand=1&extraad=true&extraadtarget=' + target;

	pageLoader.load(href)
	.then(function reviewPageLoaded(body) {		
		var $ = cheerio.load(body);

		reviewIds.forEach(function eachReview(reviewId) {
			var reviewSelector = $('#expanded_review_' + reviewId);

			if (reviewSelector.length != 1) {
				console.log('problem with review download');
				throw new Error('Problem with review ' + reviewId);
			}

			hotelRegistry.setReviewDetails(hotelId, reviewId, {
				message: reviewSelector.find('.entry').text(),
				rating: parseFloat(reviewSelector.find('.sprite-ratings').attr('content')),
				quote: reviewSelector.find('.quote a').text(),
			});
		});		

		def.resolve();
	})
	.done();
	
	return def.promise;
}