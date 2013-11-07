var registry = require('../app/cache');
var Cache = registry.Cache;
var assert = require('node-assertthat');
var deferred = require('deferred');

function addItem() {
	var cr = new Cache();
	var test1 = {value: 'test1'};
	cr.addItem(1, test1);
	var item = cr.getItem(1).item;

	assert.that(item, is.equalTo(test1));
};

function addComplexKey() {
	var cr = new Cache();
	var test2 = {value: 'test2'};
	cr.addItem({id: [2,3]}, test2);
	cr.addItem({id: [2,4]});
	var item2 = cr.getItem({id: [2,3]}).item;

	assert.that(item2, is.equalTo(test2));
};

function dontAddTwice() {
	var testPassed = false,
		cr = new Cache();

	cr.addItem(1, 1);
	try {
		cr.addItem(1, 2);
	}
	catch(e) {
		testPassed = true;
	}

	assert.that(testPassed, is.true());
};

function ignoreAddTwice() {
	var cr = new Cache();
	cr.addItem(1, 1);
	assert.that(cr.getItem(1).item, is.equalTo(1));

	cr.addItemIfNotExist(1, 2);

	assert.that(cr.getItem(1).item, is.equalTo(1));
}

function cacheTimeoutPolicy() {	
	var def = deferred(),
		testPassed = false,
		cr = new Cache({
			policy: registry.createPolicyChain([registry.timeoutPolicy(1), {func:function(value) {def.resolve(value);}}])
		});

	cr.addItem(1, 2);
	def.promise.then(function(res) {
		assert.that(res.id, is.equalTo(1));
		assert.that(res.item, is.equalTo(2));
		testPassed = true;
	})
	.done();

	setTimeout(function() {
		assert.that(testPassed, is.true());
	}, 10);
}

function cachePersistentTimeoutPolicyWithModification() {
	cachePersistentTimeoutPolicy(true, is.true());
}

function cachePersistentTimeoutPolicyWithoutModification() {
	cachePersistentTimeoutPolicy(false, is.false());
}

function cachePersistentTimeoutPolicy(hasPendingChanges, assertion) {
	var def = deferred(),
		wasSaved = false,
		testPassed = false,
		cr = new Cache({
			policy: registry.createPolicyChain([registry.timeoutPolicy(1), registry.persistencePolicy(), {func: function(){def.resolve();}}])
		});

	cr.addItem(1, {hasPendingChanges: hasPendingChanges, save: function(cb) {
		wasSaved = true;
		cb();
	}});

	def.promise.then(function() {
		assert.that(wasSaved, assertion);
	})
	.done();
}

function cacheSetupLockingPolicy() {
	var advanced = false,
		cr = new Cache({
		policy: registry.createPolicyChain([registry.lockSetupPolicy(), {func: function(value, prev, next){
			advanced = true;
			assert.that(value.lockCount, is.equalTo(1));
		}}])
	});

	var val = {a: 1 };
	cr.addItem(1, val);

	assert.that(advanced, is.true());
}

function cacheLockingPolicy() {
	var isFirstTime = true,
		wasRejected = false,
		didFinish = false;

	var myPolicy = {func: function(value, prev, next) {
		if (isFirstTime) {
			isFirstTime = false;
			next(value);
		}
		else {
			wasRejected = true;
			value.lockCount--;
			next(value);
		}
	}}

	var finishPolicy = {func: function(value, prev, next) {
		didFinish = true;
	}}

	var cr = new Cache({
		policy: registry.createPolicyChain([registry.lockSetupPolicy(), myPolicy, registry.lockCheckPolicy(), finishPolicy])
	});

	cr.addItem(1, 2);
	assert.that(wasRejected, is.true());
}

function cacheChain() {
	var collectedItem = null;
	var seenTwo = false;

	var one = {func: function(value, prev, next) {
		next(value);
	}}

	var two = {func: function(value, prev, next) {
		value.value++;

		if (!seenTwo) {
			seenTwo = true;
			prev(value);
		}
		else {
			next(value);
		}	
	}}

	var three = {func: function(value, prev, next) {
		value.value++;
		next(value);
	}}

	var four = {func: function(value, prev, next) {
		collectedItem = value;
		//assert.that(next, is.null()); TODO: how to assert this?
		assert.that(prev, is.not.null());
	}}

	var chain = registry.createPolicyChain([one, two, three, four]);

	chain({id: 1, value: 10});
	assert.that(collectedItem.value, is.equalTo(13));

}

addItem();
addComplexKey();
dontAddTwice();
ignoreAddTwice();
cacheTimeoutPolicy();
cachePersistentTimeoutPolicyWithModification();
cachePersistentTimeoutPolicyWithoutModification();
cacheSetupLockingPolicy();
cacheLockingPolicy();
cacheChain();
