var CacheRegistry = require('../app/cacheRegistry');
var cache = require('../app/cache');
var deferred = require('deferred');
var assert = require('node-assertthat');

var saved = [];
var fakeDoc = function(id) {
	return {_id: id, value: id, save: function(callBack){
		debugger;
		saved.push(id); callBack();
	}};
}

var repository = {
		findById: function(id, cb) {
			var err = null;
			if (id == 1) {
				cb(err, fakeDoc(1));
			}
			if (id == 2) {
				cb(err, fakeDoc(2));
			}
		}
	};

function testSetup() {
	saved = [];
}

function testNoTimeout() {
	testSetup();

	var cr = new CacheRegistry(repository, {noTimeout: true});

	var d1 = deferred(),
		d2 = deferred(),
		d3 = deferred();

	debugger;
	assertLoad(cr, d1, 1);
	assertLoad(cr, d2, 2);
	assertLoad(cr, d3, 1);

	var def = deferred();

	deferred.map([d1.promise, d2.promise, d3.promise])
	.then(function() {
		assert.that(cr.hits, is.equalTo(1));
		assert.that(cr.misses, is.equalTo(2));
		def.resolve();
	})
	.done();

	return def.promise;
}

function assertLoad(cr, def, value) {
	testSetup();

	cr.load(value)
	.then(function(loadedItem) {
		assert.that(loadedItem.value, is.equalTo(value));
		def.resolve();
	})
	.done();
}

function testTimeout() {
	testSetup();

	var cr = new CacheRegistry(repository, {timeout: 1});
	cr.load(1)
	.then(function(item) {
		assert.that(cr.isCached(1), is.true());
		cr.unlock(1);
	})
	.done();

	var def = deferred();
	waitOnCondition(function() {return !cr.isCached(1);}, def.resolve);

	return def.promise;	
}

function testTimeoutWithLocking() {
	testSetup();

	var cr = new CacheRegistry(repository, {timeout: 1});
	cr.load(1)
	.then(function(item) {
		assert.that(cr.isLocked(1), is.true());
	})
	.done();

	var def = deferred();
	holdCondition(function() {return cr.isCached(1);}, function() {cr.unlock(1); def.resolve()});
	return def.promise;
}

function testPersistenceWithModification() {
	testSetup();

	var cr = new CacheRegistry(repository, {timeout: 1});

	cr.load(1)
	.then(function(item) {
		assert.that(saved.indexOf(1), is.equalTo(-1));
		item.hasPendingChanges = true;
		cr.unlock(1);
	})
	.done();

	var def = deferred();
	waitOnCondition(function(){return saved.indexOf(1) != -1}, def.resolve);

	return def.promise;
}

function testPersistenceWithoutModification() {
	testSetup();

	var cr = new CacheRegistry(repository, {timeout: 1});

	cr.load(1)
	.then(function(item) {
		assert.that(saved.indexOf(1), is.equalTo(-1));
		cr.unlock(1);
	})
	.done();

	var def = deferred();
	holdCondition(function(){return saved.indexOf(1) == -1}, def.resolve);
	return def.promise;
}

function testLoadWithoutCache() {
	testSetup();

	var def = deferred();

	var cr = new CacheRegistry(repository, {timeout: 1});
	cr.load(1, {noCache: true})
	.then(function(item) {
		assert.that(cr.isCached(1), is.false());
		def.resolve();		
	})
	.done();

	return def.promise;
}

function testLockOnLoadCachedValue() {
	testSetup();
	var def = deferred();

	var cr = new CacheRegistry(repository, {timeout: 1});
	cr.load(1)
	.then(function() {
		cr.unlock(1);

		cr.load(1)
		.then(function() {
			assert.that(cr.isLocked(1), is.true());
			cr.unlock(1);
			def.resolve();
		})
		.done();
	})
	.done();

	return def.promise;
}

function waitOnCondition(func, cleanUp, startTime) {
	if (!startTime) {
		startTime = process.hrtime();
	}

	if (func()) {
		cleanUp && cleanUp();

		return;
	}

	if (process.hrtime(startTime)[0] >= 1) {
		throw new Error('Failed to wait for test completeion');
	}

	setTimeout(function(){waitOnCondition(func, cleanUp, startTime)}, 1);
}

function holdCondition(func, cleanUp, startTime) {	
	if (!startTime) {
		startTime = process.hrtime();
	}

	if (!func()) {
		throw new Error('Condition was not held for timeout period');
	}

	var diff = process.hrtime(startTime);	
	if (diff[0] >= 1) {
		cleanUp && cleanUp();
		
		return;
	}

	setTimeout(function(){holdCondition(func, cleanUp, startTime)}, 1);
}

testNoTimeout()
.then(testTimeout)
.then(testTimeoutWithLocking)
.then(testPersistenceWithoutModification)
.then(testPersistenceWithModification)
.then(testLoadWithoutCache)
.then(testLockOnLoadCachedValue)
.done();
