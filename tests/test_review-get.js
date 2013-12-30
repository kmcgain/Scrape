var proxyquire = require('proxyquire').noCallThru();
var assert = require('node-assertthat');
var deferred = require('deferred');

var responseBody = [
'<div id="expanded_review_17137387">',
	'<div class="entry">SomeMessage</div>',
	'<img class="sprite-ratings" content="4.0" />',
	'<div class="quote"><a>"TheQuote"</a></div>',
'</div>'
];


var getReview = proxyquire('../app/review-get', {
	'./pageLoader': {
		load: function(href) {
			debugger;
			return deferred(responseBody.join(''));			
		}
	}
})
.getReviewDetails;


var collectedReview;
var hotelRegistry = {
	setReviewDetails: function(hotelId, reviewId, review) {
		debugger;
		collectedReview = review;
	}
};

var reviewId = '17137387';
getReview({LocationId: 'g2708206-d1086922'}, null, [reviewId], hotelRegistry)
.then(function () {
	assert.that(collectedReview.message, is.equalTo('SomeMessage'));
	assert.that(collectedReview.rating, is.equalTo(4.0));
	assert.that(collectedReview.quote, is.equalTo("\"TheQuote\""));
})
.done();