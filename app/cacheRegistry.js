var cacheLib = require('./cache');
var Cache = cacheLib.Cache;
var deferred = require('deferred');

var CacheRegistry = function(repository, options) {
	var timeout = (options && options.timeout) ? options.timeout : 1000;

	var chain = [];
	chain.push(cacheLib.lockSetupPolicy());
	if (!options || !options.noTimeout) {
		chain.push(cacheLib.timeoutPolicy(timeout));
		chain.push(cacheLib.lockCheckPolicy());
		chain.push(cacheLib.persistencePolicy());
		chain.push(cacheLib.removePolicy());
	}

	var cache = new Cache({policy: cacheLib.createPolicyChain(chain, options.debugOut)});

	this.isCached = function(id) {
		return cache.hasItem(id);
	};

	this.isLocked = function(id) {
		return cache.getItem(id).isLocked;
	}

	this.unlock = function(id) {
		cache.getItem(id).isLocked = false;
	}

	this.load = function(id, options) {
		if (cache.hasItem(id)) {
			this.hits++;
			return deferred(cache.getItem(id).item);
		}

		this.misses++;

		var d1 = deferred();

		repository.findById(id, function(loadedItem) {
			if (!options || !options.noCache) {
				cache.addItem(id, loadedItem);
			}
			
			d1.resolve(loadedItem);
		});

		return d1.promise;
	};

	this.hits = 0;
	this.misses = 0;
}

module.exports = CacheRegistry;