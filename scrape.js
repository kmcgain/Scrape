var request = require('request');
var url = require('url');
var trip = require('./Trip');
var place = require('./place');
var TripDocumentManager = require('./trip-document-manager.js').TripDocumentManager;

var tripDocumentManager = null;

// var deferred = require('deferred');
// deferred.monitor(20000, function (err) {
// 	console.log('err');
// });

require('./trip-schemas').Entities()
.then(function (schemas) {	
	var tripEntities = schemas;

	var tripRegistry = new trip.tripRegistry(tripEntities.TripMongo);
	var hotelRegistry = new trip.tripRegistry(tripEntities.HotelMongo);

	tripDocumentManager = new TripDocumentManager(tripRegistry, hotelRegistry, tripEntities);	

	console.log('manage');
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

	if (err || rootProgress == null || rootProgress.length == 0) {
		//var allLocationsUrl = getUrl('/AllLocations-g1-Places-World.html');
		//var allLocationsUrl = getUrl('/AllLocations-g255098-Places-Victoria.html');
		var allLocationsUrl = getUrl('/Tourism-g2708206-Allansford_Victoria-Vacations.html');
	
		downloadTracker = new trip.Progress(allLocationsUrl);
		downloadTracker.IsRoot = true;
	}
	else if (rootProgress.length == 1) {
		var doc = rootProgress[0];
		tripDocumentManager.tripRegistry.Store(doc);
		downloadTracker = trip.lazyConvertDoc(doc);
	}
	else {
		throw new Exception("Bad data");
	}

	place.load(allLocationsUrl, downloadTracker);

	console.log("Starting progress tracking");
	function reportProgress(progress) {
		tripDocumentManager.WriteData(progress);

		var prog = unwrapProgress(progress);
		console.log("Total progress: " + prog);

		if (prog == 1.0) {
			tripDocumentManager.finish();
			return;
		}
		
		setTimeout(reportProgress, 10000, progress);
	}

	function unwrapProgress (prog)
	{
		if (prog.IsComplete) {
			return 1.0;
		}

		if (prog.Children.length == 0) {
			return 0.0;
		}

		var sum = prog.Children.reduce(function (accum, value, index, array) {
			return accum + unwrapProgress(value);
		}, 0.0);

		return sum / prog.Children.length;
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