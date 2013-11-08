var deferred = require('deferred');
var uuid = require('node-uuid');

var unresolvedPromises = null;

function trackedMap(promises) {
	var def = new module.exports.deferred();

	deferred.map(promises)
	.then(def.resolve)
	.done();

	return def.promise;
}


function trackedReduce() {
	var args = arguments;
	return deferWork(function() {
		return deferred.reduce.apply(deferred.reduce, args);
	});	
}

function deferWork(work, handler) {		
	if (Array.isArray(work)) {
		return trackedMap(
			work.map(function(item) {
				return deferWork(function(){return item;}, handler);
			})
		);
	}

	var def = new module.exports.deferred();
	
	work()
	.then(function(result) {

		if (!handler) {
			def.resolve(result);
			return;
		}
		
		var handledResult = handler(result);
		def.resolve(handledResult);
	})
	.done();

	return def.promise;
}


function mapSyncronously(items, work) {
	if (items.length == 0) {
		return deferred(0);
	}

	var currentItem = items[0];

	var promise = work(items[0]);

	var def = new module.exports.deferred();

	promise
	.then(function() {
		mapSyncronously(items.slice(1), work)
		.then(function() {
			def.resolve();
		})
		.done();
	})
	.done();

	return def.promise;
}


module.exports.deferWork = deferWork;
module.exports.mapSyncronously = mapSyncronously;
module.exports.printUnresolved = function printUnresolved() {
	var unresolved = module.exports.currentUnresolved();;
	console.log('Unresolved: ' + unresolved.length);
	unresolved.forEach(function (def) {
		console.log(def);
	});
};

module.exports.currentUnresolved = function currentUnresolved() {
	return module.exports.currentUnfinalised().filter(function(item) {
		return !item.isResolved;
	});
};

module.exports.currentUnfinalised = function currentUnfinalised() {
	var defs = [];

	if (!unresolvedPromises) {
		return defs;
	}

	Object.keys(unresolvedPromises).forEach(function(key) {
		if (unresolvedPromises.hasOwnProperty(key)) {			
			var elem = unresolvedPromises[key];
			defs.push(elem);
		}		
	});		

	return defs;
}

module.exports.reduce = trackedReduce;
module.exports.map = trackedMap;

function tDeferred() {
	if (arguments.length > 1) {
		throw new Error('we need to implement resolved promises');
	}

	var id = uuid.v1();
	var myDeferred = deferred();
	var tracker = {self: this, isResolved: false};
	unresolvedPromises[id] = tracker;

	this.resolve = function() {
		delete unresolvedPromises[id];
		return myDeferred.resolve.apply(myDeferred, arguments);
	};

	this.promise = myDeferred.promise;
};

module.exports.deferred = deferred;

module.exports.enableTracking = function enableTracking() {
	unresolvedPromises = {};
	module.exports.deferred = tDeferred;
};

module.exports.promisify = deferred.promisify;

function keys(obj)
{
    var keys = [];

    for(var key in obj)
    {
        if(obj.hasOwnProperty(key))
        {
            keys.push(key);
        }
    }

    return keys;
}