var request = require('request');
var url = require('url');
var trip = require('./Trip');
var place = require('./place');
require('./arrayExt');

request.setMaxListeners(0);

var winston = require('winston');
var logger = new (winston.Logger)({
	levels: {progress: 0, verbose: 1, error: 2},
	transports: [
		//new winston.transports.File({filename: 'progress.log', level: 'progress'}),
		new winston.transports.File({filename: 'verbose.log', level: 'verbose'})
	]
});

place.logger = logger;

var progressReporter = require('./progress-reporter');

var TripDocumentManager = require('./trip-document-manager.js').TripDocumentManager;

var tripDocumentManager = null;

require('./trip-schemas').Entities()
.then(function (schemas) {	
	var tripEntities = schemas;

	var tripRegistry = new trip.tripRegistry(tripEntities.TripMongo);
	var hotelRegistry = new trip.tripRegistry(tripEntities.HotelMongo);

	tripDocumentManager = new TripDocumentManager(tripRegistry, hotelRegistry, tripEntities);	

	appStart(tripEntities);
})
.done();



function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}

function appStart(tripEntities) {
	console.log("Loading places");

	tripEntities.TripMongo.find({IsRoot: true}, rootDataFound);
}

function rootDataFound(err, rootProgress) {

	// Start from scratch
	if (err || rootProgress == null || rootProgress.length == 0) {
		//var allLocationsUrl = getUrl('/AllLocations-g1-Places-World.html');
		var allLocationsUrl = getUrl('/AllLocations-g255098-Places-Victoria.html');
		//var allLocationsUrl = getUrl('/Tourism-g2708206-Allansford_Victoria-Vacations.html');
	
		downloadTracker = new trip.Progress(allLocationsUrl);
		downloadTracker.IsRoot = true;
	}
	// Found root
	else if (rootProgress.length == 1) {
		var doc = rootProgress[0];
		tripDocumentManager.tripRegistry.Store(doc);
		downloadTracker = trip.lazyConvertDoc(doc, tripDocumentManager.tripRegistry);
	}
	else {
		throw new Exception("Bad data");
	}

	place.load(downloadTracker.Url, downloadTracker);

	console.log("Starting progress tracking");
	function reportProgress(progress) {
		tripDocumentManager.WriteData(progress)
		.then(function() {
			return progressReporter(progress);
		})
		.then(function(prog) {
			console.log("Total progress: " + prog);

			if (prog == 1.0) {				
				tripDocumentManager.finish();
				return;
			}
			
			setTimeout(reportProgress, 10000, progress);			
		})
		.done();
	}

	reportProgress(downloadTracker);

}

function handleExit() {
	if (tripDocumentManager.WritingData) {
		process.nextTick(handleExit);
		return;
	}

	process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);