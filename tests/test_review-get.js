var proxyquire = require('proxyquire').noCallThru();
var assert = require('node-assertthat');

var responseBody = [
'<div id="expanded_review_17137387">',
	'<div class="entry">SomeMessage</div>',
	'<img class="sprite-ratings" content="4.0" />',
	'<div class="quote"><a>"TheQuote"</a></div>',
'</div>'
];


var getReview = proxyquire('../app/review-get', {
	request: function(href, cb) {
		process.nextTick(function() {
			cb(null, {statusCode: 200}, responseBody);
		});	

		return {setMaxListeners: function(){}};	
	}
})
.getReviewDetails;

var review = {Id: '17137387'};
getReview({LocationId: 'g2708206-d1086922'}, [review])
.then(function () {
	assert.that(review.Message, is.equalTo('SomeMessage'));
	assert.that(review.Rating, is.equalTo(4.0));
	assert.that(review.Quote, is.equalTo("\"TheQuote\""));
})
.done();