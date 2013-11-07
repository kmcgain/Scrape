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

	var cache = new Cache({policy: cacheLib.createPolicyChain(chain, options ? options.debugOut : null)});

	this.isCached = function(id) {
		return cache.hasItem(id);
	};

	this.isLocked = function(id) {
		var item = cache.getItem(id);
		return item.lockCount && item.lockCount > 0;
	}

	this.unlock = function(id) {
		cache.getItem(id).lockCount--;
	}

	this.add = function(id, value) {
		cache.addItem(id, value);
	}

	this.load = function(id, options) {
		if (cache.hasItem(id)) {
			this.hits++;
			var item = cache.getItem(id);
			item.lockCount++; // lock it on every load. TODO: Can this be part of the chain??

			return deferred(item.item);
		}

		this.misses++;

		var d1 = deferred();

		repository.findById(id, function(err, loadedItem) {
			if (err) {
				throw new Error(err);
			}

			if (!options || !options.noCache && notAlreadyAdded) {
				cache.addItemIfNotExist(id, loadedItem);
			}

			d1.resolve(loadedItem);
		});

		return d1.promise;
	};

	this.size = function() {
		return cache.size();
	}

	this.hits = 0;
	this.misses = 0;
}

module.exports = CacheRegistry;