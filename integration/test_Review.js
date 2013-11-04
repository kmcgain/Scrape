var proxyquire = require('proxyquire').noCallThru();
var deferred = require('deferred');
var place = proxyquire('../app/place', {
	'../app/review-get': {getReviewDetails: function(hotel, reviews){return deferred(1);}}
	});
var assert = require('node-assertthat');
var Hotel = require('../app/hotel').Hotel;

var urlForTest = "http://www.tripadvisor.com.au/Hotel_Review-g2708206-d1086922-Reviews-Allansford_Hotel_Motel-Allansford_Victoria.html#REVIEWS";
var Trip = require('../app/Trip');

var progress = new Trip.Progress('href');
progress.Hotel = new Hotel();

try {
	place.load(urlForTest, progress)
	.then(function complete() {
		console.log('asserting');
		assert.that(progress.Hotel.Reviews.length, is.equalTo(11));
	})
	.done(function(){}, function (err) {
		console.log(err);
		throw err;
	});
}
catch (err) {
	console.log(err);
	throw err;
}