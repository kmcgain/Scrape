var deferred = require('deferred');
var promisify = deferred.promisify;
var deferWork = require('./deferWork').deferWork;
var CacheRegistry = require('./cacheRegistry');

var cacheDropTimeoutPeriodInMs = 50000;

var logger = require('./logging');

module.exports = function(tripRepository, hotelRegistry) {
	var cacheRegistry = new CacheRegistry(tripRepository);



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
		item.hasPendingChanges = true;
	}

	var newProgress = function(href, parentId) {
		if (parentId) {
			return deferWork(function() {
				return cacheRegistry.load(parentId);
			}, function(parent) {
				
				var newId = createNewProgress(href, parent);
				cacheRegistry.unlock(parentId);

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

		cacheRegistry.add(newProgress._id, newProgress);

		return newProgress._id;
	}

	var ext = {
		cacheHits: function() {
			return cacheRegistry.cacheHits;
		},

		cacheMisses: function() {
			return cacheRegistry.cacheMisses;
		},

		cacheSize: function() {
			return cacheRegistry.size();
		},

		isFinishedWriting: function() {
			return cache.size() == 0;
		},

		isComplete: function(id, loadOptions) {
			return deferWork(function() {
				return cacheRegistry.load(id, loadOptions);
			}, function(item) {
				if (!loadOptions || !loadOptions.noCache) {
					cacheRegistry.unlock(id);
				}

				return !!(item.IsComplete); // return false on undefined
			});
		},

		markAsComplete: function(id) {
			logger.verbose('Marking complete: ' + id);

			cacheRegistry.load(id)
			.then(function(item) {
				cacheRegistry.unlock(id);
				item.IsComplete = true;
				setModified(item);

				if (!item.IsRoot) {
					markAsCompleteOnChildren(item.ParentId);
				}
			})
			.done();
		},

		newProgress: newProgress,

		getHotel: function(locationId, parentId) {
			var def = deferred();

			cacheRegistry.load(parentId)
			.then(function(parent) {
				var hotelExists = !!(parent.Hotel);

				var promise = hotelExists
					? hotelRegistry.getHotelById(parent.Hotel)
					: hotelRegistry.getHotelByLocationId(locationId);

				promise
				.then(function(hotel) {
					if (!hotelExists) {
						parent.Hotel = hotel._id;
						setModified(parent);
					}
					cacheRegistry.unlock(parentId);

					def.resolve(hotel._id);
				})
				.done();
			});
		
			return def.promise;	
		},

		setNumberOfExpectedChildren: function(number, parentId) {
			cacheRegistry.load(parentId)
			.then(function(parent) {
				parent.NumberOfExpectedChildren = number;	
				setModified(parent);
				cacheRegistry.unlock(parentId);
			})
			.done();			
		},

		getChildren: function(parentId) {
			return deferWork(function() {
				return cacheRegistry.load(parentId);
			}, function(parent) {

				if (parent == null) {
					throw new Error("parent doesn't exist");
				}
				cacheRegistry.unlock(parentId);
				return parent.Children;
			});			
		},

		getUrl: function(progressId) {
			return deferWork(function() {
				return cacheRegistry.load(progressId);
			}, function(progress) {
				cacheRegistry.unlock(progressId);
				return progress.Url;
			})
		},

		findByHref: function(children, href) {
			if (typeof (href) != "string") {
				throw new Error("Href was not correct type");
			}
			// TODO: optimise by searching by href, don't load all children
			return deferWork(function() {
				return deferred.map(children, function(child) {return cacheRegistry.load(child);});
			}, function(loadedChildren) {
				children.forEach(function(childId){cacheRegistry.unlock(childId)});
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
						return cacheRegistry.load(newId);
					})
					.then(function(item) {
						cacheRegistry.unlock(item._id);
						def.resolve({id: item._id, href: url});
					})
					.done();

					return;
				}
				
				var root = roots[0];
					
				cacheRegistry.add(root._id, root);
				cacheRegistry.unlock(root._id);
				def.resolve({id: root._id, href: root.Url});
			});

			return def.promise;
		}
	};

	return ext;
};