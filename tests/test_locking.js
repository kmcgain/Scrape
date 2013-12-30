var deferred = require('deferred');
var locking = require('../app/locking');
var assert = require('node-assertthat');

var orderedItems = [];

var dRes1 = locking.getLock(1, function(def) {
	setTimeout(function() {
		console.log('first timeout');
		orderedItems.push(1);
		def.resolve();
	}, 200);
});

var dRes2 = locking.getLock(1, function(def) {
	setTimeout(function() {
		console.log('second timeout');
		orderedItems.push(2);
		def.resolve();
	}, 100);
});

var dRes3 = locking.getLock(1, function(def) {
	setTimeout(function() {
		console.log('third timeout');
		orderedItems.push(3);
		def.resolve();
	}, 10);
});


deferred.map([dRes1, dRes2, dRes3])
.then(function() {
	assert.that(orderedItems[0], is.equalTo(1));
	assert.that(orderedItems[1], is.equalTo(2));
	assert.that(orderedItems[2], is.equalTo(3));
})
.done();