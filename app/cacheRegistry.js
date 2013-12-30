var cacheLib = require('./cache');
var cachePolicy = require('./cachePolicy');
var Cache = cacheLib.Cache;
var deferred = require('deferred');
var locking = require('./locking');

var CacheRegistry = function(repository, options) {	
	var timeout = (options && options.timeout) ? options.timeout : 1000;

	var chain = [];
	chain.push(cachePolicy.lockSetupPolicy());
	if (!options || !options.noTimeout) {
		chain.push(cachePolicy.timeoutPolicy(timeout));
		chain.push(cachePolicy.lockCheckPolicy());
		chain.push(cachePolicy.persistencePolicy());
		chain.push(cachePolicy.removePolicy());
	}

	var cache = new Cache({policy: cacheLib.createPolicyChain(chain, options ? options.debugOut : null)});
	var self = this;

	this.isCached = function(id) {
		return cache.hasItem(id);
	};

	this.isLocked = function(id) {
		var item = cache.getItem(id);
		return item.lockCount && item.lockCount > 0;
	}

	this.unlock = function(id) {	

		var item = cache.getItem(id);
		if (!item.lockCount) {
			throw new Error('bad unlock: ' + id + ' ' + item.lockCount);
		}

		item.lockCount--;
	}

	this.add = function(id, value) {
		cache.addItem(id, value);
	}

	this.load = function(id, options) {		
		return locking.getLock(id, function loadLockObtained(def) {
			if (cache.hasItem(id)) {
				self.hits++;
				var item = cache.getItem(id);

				if (!options || !options.noCache) {
					item.lockCount++; // lock it on every load. TODO: Can this be part of the chain??
				}

				def.resolve(item.item);
				return;
			}

			self.misses++;

			repository.findById(id, function(err, loadedItem) {
				if (cache.hasItem(id)) {
					throw new Error("locking didn't work");
				}

				if (err) {
					throw new Error(err);
				}
				if (loadedItem == null) {
					throw new Error('could not load by id: ' + id);
				}

				if (!options || !options.noCache) {
					cache.addItemIfNotExist(id, loadedItem);
					cache.getItem(id).lockCount++;
				}

				def.resolve(loadedItem);
			});
		});
	};

	this.loadBy = function(signature) {	
		var def = new deferred();

		
		var item = cache.getBySignature(signature);

		if (item == null || item.length == 0) {
			repository.find(signature, function(err, loadedItems) {
				if (err) {
					throw new Error(err);
				}

				if (loadedItems.length == 0) {
					def.resolve(null);
				}
				else if (loadedItems.length > 1) {
					throw new Error('too many with same signature');
				}
				else {
					var loadedItem = loadedItems[0];

					// Unfortunately in order to use a lock correctly we need to reload :(
					// if we make ues of loadedItem we aren't gauranteed to be consistent with
					// the locking
					self.load(loadedItem._id)
					.then(function(item) {
						def.resolve(item);
					})
					.done();

					// cache.addItemIfNotExist(loadedItem._id, loadedItem)
					// cache.getItem(loadedItem._id).lockCount++;
					// def.resolve(loadedItem);
				}
			})
		}
		else if (item.length > 1) {
			throw new Error('too many with same signature');			
		}
		else {
			var loadedItem = item[0];
			loadedItem.lockCount++;
			def.resolve(loadedItem.item);
		}

		return def.promise;
	}

	this.size = function() {
		return cache.size();
	}

	this.hits = 0;
	this.misses = 0;
}

module.exports = CacheRegistry;