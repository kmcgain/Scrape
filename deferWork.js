var deferred = require('deferred');

var deferWork = function(work, handler) {	
	if (Array.isArray(work)) {
		return deferred.map(work, function(item) {
			return item;
		});
	}

	var def = new deferred();

	work()
	.then(function(result) {
		if (!handler) {
			def.resolve();
			return;
		}
		
		var handledResult = handler(result);
		def.resolve(handledResult);
	})
	.done();

	return def.promise;
}


var mapSyncronously = function(items, work) {
	if (items.length == 0) {
		return new deferred(0);
	}

	var currentItem = items[0];

	var promise = work(items[0]);

	var def = new deferred();

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