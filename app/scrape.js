var url = require('url');
var trip = require('./Trip');
var place = require('./place');
require('./arrayExt');
var deferWork = require('./deferWork');
var TripRegistry = require('./tripRegistry');
var async = require('async');
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

var isExiting = false;

var workerQueue = async.queue(function(task, callback) {	
	if (isExiting) {
		return;
	}

	callback(null, task);
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


// function rootDataFound(err, rootProgress) {
// 	// Start from scratch
// 	if (err || rootProgress == null || rootProgress.length == 0) {
		
// 		downloadTracker = new trip.Progress(allLocationsUrl);
// 		downloadTracker.IsRoot = true;
// 	}
// 	// Found root
// 	else if (rootProgress.length == 1) {
// 		var doc = rootProgress[0];
// 		tripDocumentManager.tripRegistry.Store(doc);
// 		downloadTracker = trip.lazyConvertDoc(doc, tripDocumentManager.tripRegistry);
// 	}
// 	else {
// 		throw new Exception("Bad data");
// 	}

// 	place.load(downloadTracker.Url, downloadTracker.TripDoc_id)
// 	.done();

// 	console.log("Starting progress tracking");
// 	function reportProgress(progress) {
// 		//tripDocumentManager.WriteData(progress)
// 		deferWork.trackedDeferred(0)
// 		.then(function() {
// 			return progressReporter(progress);
// 		})
// 		.then(function(prog) {
// 			console.log("Total progress: " + prog);
// 			console.log("Outstanding queue items: " + workerQueue.length());

// 			var workDone = false; // TODO implement completion
// 			if (workDone) {				
// 				console.log('finishing');
// 				tripDocumentManager.finish();
				
// 				// An attempt to discover why the program never ends. Reenable to discover unresolved promises.
// 				//deferWork.printUnresolved();
// 				return;
// 			}
			
// 			setTimeout(reportProgress, 10000, progress);			
// 		})
// 		.done();

// 		console.log('Trip Reg count: ' + tripDocumentManager.tripRegistry.NumberStored());
// 		console.log('Hotel Reg count: ' + tripDocumentManager.hotelRegistry.NumberStored());		
// 	}

// 	//reportProgress(downloadTracker);

// }

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


// function roughSizeOfObject( object ) {
// 	debugger;
//     var objectList = [];
//     var stack = [ object ];
//     var bytes = 0;

//     while ( stack.length ) {
//         var value = stack.pop();

//         if ( typeof value === 'boolean' ) {
//             bytes += 4;
//         }
//         else if ( typeof value === 'string' ) {
//             bytes += value.length * 2;
//         }
//         else if ( typeof value === 'number' ) {
//             bytes += 8;
//         }
//         else if
//         (
//             typeof value === 'object'
//             && objectList.indexOf( value ) === -1
//         )
//         {
//             objectList.push( value );

//             for( i in value ) {
//                 stack.push( value[ i ] );
//             }
//         }
//     }
//     return bytes;
// }