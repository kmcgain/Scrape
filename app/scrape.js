require('longjohn');

var deferWork = require('./deferWork');
var meld = require('meld');
var deferred = deferWork.deferred;

var levelOfConcurrency = 2;
var totalTimeDeferred = 0;
// meld.around(deferWork, 'deferred', function(methodCall) {
// 	var time = process.hrtime();
// 	var result = methodCall.proceed();
// 	var diff = process.hrtime(time);
// 	totalTimeDeferred += diff[0] * 1e9 + diff[1];

// 	return result;
// });

var url = require('url');
var trip = require('./Trip');
var place = require('./place');
require('./arrayExt');
var async = require('async');
var util = require('util');


setInterval(function () {
    if (typeof gc === 'function') {
        gc();
    }
    console.log('Memory Usage' + util.inspect(process.memoryUsage()));
}, 60000);


try {
	var heapdump = require('heapdump');
}
catch (e) {
	console.log("Couldn't import heapdump: " + e);
}
// var nodetime = require('nodetime');
// nodetime.profile({
//     accountKey: 'd1299ed3f939d927ff5c62e7b11e22f59eb46b4a', 
//     appName: 'Node.js Application'
//   });

var logger = require('./logging');

place.logger = logger;
place.loadTracker = new function loadTracker() {
	var pageCount = 0;

	var requestTime = 0;

	function HashTable() {
	    this.hashes = {};
	}

	HashTable.prototype = {
	    constructor: HashTable,

	    put: function( key, value ) {
	        this.hashes[JSON.stringify(key)] = value;
	    },

	    get: function( key ) {
	        return this.hashes[JSON.stringify(key)];
	    },

	    remove: function( key) {
	    	delete this.hashes[JSON.stringify(key)];
	    }
	};

	var loads = new HashTable();

	return {
		newPageLoad: function newPageLoad(href) {
			loads.put(href, {startTime: process.hrtime()});
		},

		endPageLoad: function endPageLoad(href) {
			var item = loads.get(href);
			loads.remove(href);

			var diff = process.hrtime(item.startTime);
			var totalMS = ((diff[0] * 1e9) + diff[1]) / 1e6;

			requestTime += totalMS;
			pageCount++;
		},

		currentRate: function currentRate() {
			if (pageCount == 0) {
				return 0;
			}

			return pageCount / requestTime; 
		},

		averageRequest: function averageRequest() {
			if (pageCount == 0) {
				return 0;
			}

			return requestTime / pageCount;
		}
	};
}();

var isExiting = false;
var totalWorkItemsProcessed = 0;
var appStartTime = process.hrtime();

var workerQueue = async.queue(function asyncQueueWorker(task, callback) {	
	if (isExiting) {
		return;
	}

	var def = deferred();

	if (task.workerFunc) {
		task.workerFunc(null, task.data, def);
	}
	
	def.promise
	.then(function() {
		totalWorkItemsProcessed++;	
		callback();	
	})
	.done();
}, levelOfConcurrency);
place.workerQueue = workerQueue;

var progressRegistry = null;
var hotelRegistry = null;

//require('./trip-schemas-in-memory').Entities()
require('./trip-schemas').Entities()
.then(function entitiesLoaded(schemas) {	
	var tripEntities = schemas;

	
	progressRegistry = require('./progressRegistry')(tripEntities.TripMongo);
	hotelRegistry = require('./hotelRegistry')(tripEntities.HotelMongo, progressRegistry);
	place.setProgressRegistry(progressRegistry);
	place.setHotelRegistry(hotelRegistry);

	appStart(tripEntities, progressRegistry);
})
.done();



function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}

function appStart(tripEntities, progressRegistry) {
	console.log("Loading places");
	//var allLocationsUrl = getUrl('/AllLocations-g1-Places-World.html');
	var allLocationsUrl = getUrl('/AllLocations-g255098-Places-Victoria.html');
	//var allLocationsUrl = getUrl('/Tourism-g2708206-Allansford_Victoria-Vacations.html');
	//var allLocationsUrl = getUrl('/Hotel_Review-g2708206-d1086922-Reviews-Allansford_Hotel_Motel-Allansford_Victoria.html');

	//var allLocationsUrl = getUrl('/Tourism-g261659-Lorne_Victoria-Vacations.html');
	//var allLocationsUrl = getUrl('http://www.tripadvisor.com.au/Tourism-g552127-Aireys_Inlet_Victoria-Vacations.html');

	logger.verbose('starting');
	progressRegistry.getRoot(allLocationsUrl)
	.then(function rootFound(rootData) {
		checkForCompletion(tripEntities, rootData.id, progressRegistry);
		return place.load(rootData.href, rootData.id)		
	})
	.done();
}

var checkCount = 1;
function checkForCompletion(entities, rootId, progressRegistry) {
	progressRegistry.isComplete(rootId, {noCache: true})
	.then(function completionCheck(isComplete) {
		return isComplete && progressRegistry.isFinishedWriting() && hotelRegistry.isFinishedWriting();
	})
	.done(function allWorkDone(isAllWorkDone) {
		logger.verbose('number of items in cache: ' + progressRegistry.cacheSize());
		var startDiff = process.hrtime(appStartTime);
		var totalTimeInNano = startDiff[0] * 1e9 + startDiff[1];
		var avgWorkTime = totalTimeInNano / 1e9 / totalWorkItemsProcessed;

		//logger.verbose('Time per work item: ' + avgWorkTime);
		//logger.verbose('Cache Hits/Misses: ' + progressRegistry.cacheHits() + '/' + progressRegistry.cacheMisses());

		if (!isAllWorkDone) {
			setTimeout(checkForCompletion, 1000, entities, rootId, progressRegistry);
			return;
		}	

		appShutdown(entities);	
	});	
}

function appShutdown(entities) {
	logger.verbose('closing repository');
	entities.closeRepository(function repositoryClosed() {
		console.log('finished closing repository');
	});
}

function handleExit() {
	isExiting = true;

	if (!progressRegistry.isFinishedWriting()) {
		process.nextTick(handleExit);
		return;
	}

	process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
