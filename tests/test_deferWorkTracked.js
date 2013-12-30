var deferWork = require('../app/deferWork');
var assert = require('node-assertthat');
var deferred = require('deferred');

var deferPreTrack = new deferWork.deferred();
assert.that(deferWork.currentUnresolved().length, is.equalTo(0));
deferPreTrack.resolve();
deferPreTrack.promise.done();

deferWork.enableTracking();
var defer = new deferWork.deferred();
assert.that(deferWork.currentUnresolved().length, is.equalTo(1));

defer.resolve(10);

assert.that(deferWork.currentUnresolved().length, is.equalTo(0));

defer.promise.then(function(resolution) {
	assert.that(resolution, is.equalTo(10));
})
.done();

var count = 0;
var inc = function(resolution){count += resolution};

deferWork.map([deferWork.deferWork(function(){return deferred(1);}, inc),deferWork.deferWork(function(){return deferred(3);}, inc)])
.then(function () {
	assert.that(count, is.equalTo(4));
})
.done();

deferWork.reduce([deferred(1), deferred(2), deferred(3)], function(accum, item) {
	return accum + item;
}, 10)
.then(function(result) {
	assert.that(result, is.equalTo(16));
})
.done();

