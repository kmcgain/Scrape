var cheerio = require('cheerio');
var request = require('request');
var url = require('url');
var mongoose = require('mongoose');
var trip = require('./Trip');


mongoose.connect('mongodb://admin:dx7XmV8Hx1Hb@127.9.111.2:27017');
mongoose.connection.once('open', function callback() {
	// cool.
	appStart();
});

var tripSchema = new mongoose.Schema({
	Children: [mongoose.Schema.ObjectId],
	Url: String,
	IsRoot: Boolean,
	IsComplete: Boolean,	
});
var TripMongo = mongoose.model('Trip', tripSchema); 

var tripRegistry = new trip.tripRegistry(TripMongo);

function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}


var loadPlace = function(href, progressObj) {
	console.log('Loading:' + href);
	
	request(href, function(err, resp, body) {
		if (err)
			throw err;

		var $ = cheerio.load(body);

		if (href.match(/\/Tourism-/)) {
			var viewHotels = $('#HSCS_SEE_ALL');

			if (viewHotels.length == 0) {
				// No hotels for this location
				progressObj.Completed = true;
				return;
			}
			var tourismHref = getUrl(viewHotels.attr('href'));				
			var newProgObj = new trip.Progress(tourismHref);
			progressObj.Children.push(newProgObj);
			loadPlace(tourismHref, newProgObj);
			return;
		}

		if (href.match(/\/Hotels-/)) {
			console.log('Found hotels page');
			progressObj.IsHotel = true;

			progressObj.Completed = true;
			return;	
			
			
			/*$('#ACCOM_OVERVIEW .listing .property_title')
				.each(function(i, hotelTitle) {
					console.log('Hotel ' + hotelTitle.text());
				});*/
		}
		
		if (href.match(/\/AllLocations-/)) {
			$('#BODYCON table td a')
				.each(function(i, linkElem) {
					var childHref = getUrl($(this).attr('href'));

					var newProgObj = new trip.Progress(childHref);
					progressObj.Children.push(newProgObj);						
					loadPlace(childHref, newProgObj);
				});
		}
	});
};

function appStart() {
	console.log("Loading places");

	TripMongo.find({IsRoot: true}, rootDataFound);
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
		tripRegistry.Store(doc);
		downloadTracker = trip.lazyConvertDoc(doc);
	}
	else {
		throw new Exception("Bad data");
	}

	loadPlace(allLocationsUrl, downloadTracker);

	console.log("Starting progress tracking");
	function reportProgress(progress) {
		writeData(progress);

		var prog = unwrapProgress(progress);
		console.log("Total progress: " + prog);

		if (prog == 1.0) {
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


function createDocument(progress) {
	var doc = new TripMongo();
	updateDocData(doc, progress);
	doc.save();

	tripRegistry.Store(doc);
	return doc._id;
}

function updateDocData(doc, progress) {
	doc.Url = progress.Url;
	doc.IsRoot = progress.IsRoot;
	doc.IsComplete = progress.IsComplete;
	doc.Children = progress.Children.map(function (item) {return item.TripDoc_id;});
}

var writingData = false;
function writeData(progress) {
	// Prevent termination while writing
	writingData = true;
	writeDataAux(progress);
	writingData = false;
}

// TODO: Optimise by not always updating every item.
// Only update items that weren't previously complete?
function writeDataAux(progress) {
	for (var i = 0; i < progress.Children.length; i++) {
		writeDataAux(progress.Children[i]);
	}

	if (progress.TripDoc_id == null) {
		progress.TripDoc_id = createDocument(progress);
		return;
	}
	
	var doc = tripRegistry.Load(progress.TripDoc_id);
	
	updateDocData(doc, progress);
	doc.save();
}

function handleExit() {
	if (writingData) {
		process.nextTick(handleExit);
		return;
	}

	process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);