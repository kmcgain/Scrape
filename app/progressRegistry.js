var deferred = require('deferred');
var promisify = deferred.promisify;
var deferWork = require('./deferWork').deferWork;
var cache = require('memory-cache');
var cacheDropTimeoutPeriodInMs = 5000;

var logger = require('./logging');

module.exports = function(tripRepository, hotelRegistry) {
	var idCount = 1;
	// the purpose of this is to prevent updates to docs without them being saved back to db
	// we don't mind multiple locks being out on the one id
	// we only care about the state where no locks have been taken
	var locks = []; 
	var self = this;	

	var loadItem = function(id, loadOptions) {
		if (!id) {
			throw new Error('Bad id to load: ' + id);
		}

		locks.push(id); 

		var existingItem = cache.get(id);

		if (existingItem != null) {
			return deferred(existingItem);
		}

		return deferWork(function() {
			var def = deferred();
			tripRepository.findById(id, function(err, result){
				if (result == null) {
					throw new Error('Cannot load item because it is not cached or persisted: ' + id);
				}
				def.resolve(result);
			});
			return def.promise;
		}, function(item) {		
			if (loadOptions && loadOptions.noCache) {
				logger.verbose('Loading an item without cache: ' + id);
				return item;
			}

			addToCache(id, item);		
			return item;
		});
	}

	var cacheCB = function(item) {
		return function(id) {
			// We have dropped the cache item
			var aLockExists = locks.indexOf(id) != -1;
			if (aLockExists) {
				logger.verbose('Lock still exists for ' + id);			
				return;
			}

			// Save the document before dropping			
			if (item.hasPendingChanges) {
				logger.verbose('Item modified ' + id);

				item.hasPendingChanges = false;
				item.save(function (err) {
					if (err) {
						logger.verbose('Error saving ' + id);
						throw new Error(err);
					}								

					logger.verbose('Save succesfull ' + id);
					setTimeout(cacheCB(item), cacheDropTimeoutPeriodInMs, id);
				});

				return;
			}

			cache.del(id);
			logger.verbose('No modification so removing from cache: ' + id + ', now size is: ' + cache.size());		
		};
	}

	/*
	 * We explicitly deal with the timeout because the implementation they provide
	 * will stop returning the value from the cache as soon as the timeout expires.
	 * This is potentially prior to our callback happening but we rely on our 
	 * callback to save the item before it is removed from the cache
	 */
	var addToCache = function(id, item) {
		cache.put(id, item);
		setTimeout(cacheCB(item), cacheDropTimeoutPeriodInMs, id);
	};

	var unlock = function(id) {
		locks.splice(locks.indexOf(id), 1);
	}

	var markAsCompleteOnChildren = function(parentId) {
		ext.getChildren(parentId)
		.then(function(childIds) {			
			deferred.map(childIds.map(function(childId) {
				return ext.isComplete(childId);
			}))
			.then(function(childCompletions) {
				if (childCompletions.every(function(complete) {return complete;})) {
					ext.markAsComplete(parentId);
				}
			})
			.done();
		})
		.done();
	}

	var setModified = function(item) {		
		logger.verbose('Marking item as modifed: ' + item._id);
		item.hasPendingChanges = true;
	}

	var newProgress = function(href, parentId) {
		if (parentId) {
			return deferWork(function() {
				return loadItem(parentId);
			}, function(parent) {
				
				var newId = createNewProgress(href, parent);
				unlock(parentId);

				return newId;
			});
		}

		return deferred(createNewProgress(href, null));
	};

	var createNewProgress = function(href, parent) {
		var newProgress = new tripRepository();
		newProgress.Url = href;
		setModified(newProgress);
		newProgress.Children = [];

		if (parent) {
			newProgress.ParentId = parent._id;

			parent.Children.push(newProgress._id);
			setModified(parent);
		}

		newProgress.IsRoot = !parent;

		addToCache(newProgress._id, newProgress);

		return newProgress._id;
	}

	var ext = {
		cacheSize: function() {
			return cache.size();
		},

		isFinishedWriting: function() {
			return cache.size() == 0;
		},

		isComplete: function(id, loadOptions) {
			return deferWork(function() {
				return loadItem(id, loadOptions);
			}, function(item) {
				unlock(id);
				return !!(item.IsComplete); // return false on undefined
			});
		},

		markAsComplete: function(id) {
			logger.verbose('Marking complete: ' + id);

			loadItem(id)
			.then(function(item) {
				unlock(id);
				item.IsComplete = true;
				setModified(item);

				if (!item.IsRoot) {
					markAsCompleteOnChildren(item.ParentId);
				}
			})
			.done();
		},

		newProgress: newProgress,

		getHotel: function(href, parentId) {
			var def = deferred();

			loadItem(parentId)
			.then(function(parent) {
				var hotelExists = (parent.Hotel != null);

				var promise = hotelExists
					? deferred(parent.Hotel)
					: hotelRegistry.getHotel(href.match(/Hotel_Review-(\w*-\w*)-Reviews/)[1]);

				promise
				.then(function(hotel) {
					if (!hotelExists) {
						parent.Hotel = hotel;
						setModified(parent);
					}
					unlock(parentId);

					def.resolve(parent.Hotel._id);
				})
				.done();
			});
		
			return def.promise;	
		},

		setNumberOfExpectedChildren: function(number, parentId) {
			loadItem(parentId)
			.then(function(parent) {
				parent.NumberOfExpectedChildren = number;	
				setModified(parent);
				unlock(parentId);
			})
			.done();			
		},

		getChildren: function(parentId) {
			return deferWork(function() {
				return loadItem(parentId);
			}, function(parent) {

				if (parent == null) {
					throw new Error("parent doesn't exist");
				}
				unlock(parentId);
				return parent.Children;
			});			
		},

		getUrl: function(progressId) {
			return deferWork(function() {
				return loadItem(progressId);
			}, function(progress) {
				unlock(progressId);
				return progress.Url;
			})
		},

		findByHref: function(children, href) {
			if (typeof (href) != "string") {
				throw new Error("Href was not correct type");
			}
			// TODO: optimise by searching by href, don't load all children
			return deferWork(function() {
				return deferred.map(children, function(child) {return loadItem(child);});
			}, function(loadedChildren) {
				children.forEach(unlock);
				return loadedChildren.filter(function(item){return item.Url == href})[0];
			});
		},

		// Url is not used if a root already exists
		getRoot: function(url) {
			// We don't have an id so we will look straight in db
			var def = deferred();

			tripRepository.find({IsRoot: true}, function(err, roots) {


				if (err || roots.length == 0) {
					// create root

					newProgress(url, null)
					.then(function(newId) {
						return loadItem(newId);
					})
					.then(function(item) {
						unlock(item._id);
						def.resolve({id: item._id, href: url});
					})
					.done();

					return;
				}
				
				var root = roots[0];
					
				addToCache(root._id, root);
				unlock(root._id);
				def.resolve({id: root._id, href: root.Url});
			});

			return def.promise;
		}
	};

	return ext;
};