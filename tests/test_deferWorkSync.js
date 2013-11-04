var mapSync = require('../app/deferWork').mapSyncronously;
var assert = require('node-assertthat');
var deferred = require('deferred');

var items = [1,2,3,4,5,6,7,8];

var result = []
mapSync(items, function(item) {
	result.push(item);
	return new deferred(0);
})
.then(function() {
	assert.that(items[0], is.equalTo(1));
	assert.that(items[1], is.equalTo(2));
	assert.that(items[2], is.equalTo(3));
	assert.that(items[3], is.equalTo(4));
	assert.that(items[4], is.equalTo(5));
	assert.that(items[5], is.equalTo(6));
	assert.that(items[6], is.equalTo(7));	
	assert.that(items[7], is.equalTo(8));
})
.done();