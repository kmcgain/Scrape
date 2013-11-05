var deferWork = require('./deferWork');
var meld = require('meld');
var deferred = deferWork.deferred;

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
var TripRegistry = require('./tripRegistry');
var async = require('async');



// try {
// 	var heapdump = require('heapdump');
// }
// catch (e) {
// 	console.log("Couldn't import heapdump: " + e);
// }
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
		newPageLoad: function(href) {
			loads.put(href, {startTime: process.hrtime()});
		},

		endPageLoad: function(href) {
			var item = loads.get(href);
			loads.remove(href);

			var diff = process.hrtime(item.startTime);
			var totalMS = ((diff[0] * 1e9) + diff[1]) / 1e6;

			requestTime += totalMS;
			pageCount++;
		},

		currentRate: function() {
			if (pageCount == 0) {
				return 0;
			}

			return pageCount / requestTime; 
		},

		averageRequest: function() {
			if (pageCount == 0) {
				return 0;
			}

			return requestTime / pageCount;
		}
	};
};

var isExiting = false;
var totalWorkItemsProcessed = 0;
var appStartTime = process.hrtime();

var workerQueue = async.queue(function(task, callback) {	
	if (isExiting) {
		return;
	}

	var def = deferred();
	callback(null, task, def);

	def.promise
	.then(function() {
		totalWorkItemsProcessed++;		
	})
	.done();
}, 100);
place.workerQueue = workerQueue;

var progressRegistry = null;


//require('./trip-schemas-in-memory').Entities()
require('./trip-schemas').Entities()
.then(function (schemas) {	
	var tripEntities = schemas;

	var tripRegistry = new TripRegistry(tripEntities.TripMongo);
	var hotelRegistry = new TripRegistry(tripEntities.HotelMongo);

	var hotelRegistry = require('./hotelRegistry')(tripEntities.HotelMongo);
	progressRegistry = require('./progressRegistry')(tripEntities.TripMongo, hotelRegistry);
	place.setProgressRegistry(progressRegistry);

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

	//var allLocationsUrl = getUrl('http://www.tripadvisor.com.au/Tourism-g552127-Aireys_Inlet_Victoria-Vacations.html');

	logger.verbose('starting');
	progressRegistry.getRoot(allLocationsUrl)
	.then(function(rootData) {
		checkForCompletion(tripEntities, rootData.id, progressRegistry);
		return place.load(rootData.href, rootData.id)		
	})
	.done();
}

var checkCount = 1;
function checkForCompletion(entities, rootId, progressRegistry) {
	progressRegistry.isComplete(rootId, {noCache: true})
	.then(function(isComplete) {
		return isComplete && progressRegistry.isFinishedWriting();
	})
	.done(function(isAllWorkDone) {
		logger.verbose('number of items in cache: ' + progressRegistry.cacheSize());
		//logger.verbose('Load rate/Avg Time: ' + place.loadTracker.currentRate() + '/' + place.loadTracker.averageRequest());
		//logger.verbose('Total time spent deferring: ' + totalTimeDeferred);
		var startDiff = process.hrtime(appStartTime);
		var totalTimeInNano = startDiff[0] * 1e9 + startDiff[1];
		var avgWorkTime = totalTimeInNano / 1e9 / totalWorkItemsProcessed;

		logger.verbose('Time per work item: ' + avgWorkTime);
		logger.verbose('Cache Hits/Misses: ' + progressRegistry.cacheHits() + '/' + progressRegistry.cacheMisses());
		// if (checkCount++ % 60 == 0 && heapdump) {
		// 	console.log('writing heap');
		// 	heapdump.writeSnapshot('/var/local/heapdumps/' + Date.now() + '.heapsnapshot');
		// }

		if (!isAllWorkDone) {
			setTimeout(checkForCompletion, 1000, entities, rootId, progressRegistry);
			return;
		}	

		appShutdown(entities);	
	});	
}

function appShutdown(entities) {
	logger.verbose('closing repository');
	entities.closeRepository(function() {
		console.log('finished closing repository');
	});
}

function handleExit() {
	isExiting = true;
	// if (tripDocumentManager.WritingData) {
	// 	process.nextTick(handleExit);
	// 	return;
	// }
	if (!progressRegistry.isFinishedWriting()) {
		process.nextTick(handleExit);
		return;
	}

	process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
