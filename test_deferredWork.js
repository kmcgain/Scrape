var deferWork = require('./deferWork');
var deferred = require('deferred');
var assert = require('node-assertthat');

var count = 0;

var asyncAdd = function() {
	return new deferred(1);
}

deferWork(function() {
	return deferred.map([deferWork(asyncAdd, function(amount) {
		count += amount;
	}),
	deferWork(asyncAdd, function(amount) {
		count += amount;
	})]);
})
.then(function() {
	assert.that(count, is.equalTo(2));
})
.done();
