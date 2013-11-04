
var deferWorkLib = require('../app/deferWork');
var deferWork = deferWorkLib.deferWork;
var deferred = require('deferred');
var assert = require('node-assertthat');

var count = 0;

var asyncAdd = function() {
	return deferred(1);
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

var runningCount = 0;
deferWork([deferred(1), deferred(2)], function (resolution) {
	runningCount += resolution;
})
.then(function(){
	assert.that(runningCount, is.equalTo(3))
})
.done();

