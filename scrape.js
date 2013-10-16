var cheerio = require('cheerio');
var request = require('request');
var url = require('url');
var mongoose = require('mongoose');

mongoose.connect('mongodb://admin:dx7XmV8Hx1Hb@127.9.111.2:27017');
mongoose.connection.once('open', function callback() {
	// cool.
	appStart();
});

function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}

var Progress = function(href) {
	this.Url = href;
	this.Children = [];
	this.IsHotel = false;
	this.DbId = null; // Not all progress objects are persisted.
	this.IsRoot = false;
};

var loadPlace = function(href, progressObj) {
	//console.log('Loading:' + href);
	
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
			var newProgObj = new Progress(tourismHref);
			progressObj.Children.push(newProgObj);
			loadPlace(tourismHref, newProgObj);
			return;
		}

		if (href.match(/\/Hotels-/)) {
			//console.log('Found hotels page');
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

					var newProgObj = new Progress(childHref);
					progressObj.Children.push(newProgObj);						
					loadPlace(childHref, newProgObj);
				});
		}
	});
};

var progressSchema = new mongoose.Schema({
	Progress: mongoose.Schema.Types.Mixed, 
	IsRoot: { type: Boolean, index: true },
	Url: String,
});

var ProgressMongo = mongoose.model('Scrape', progressSchema); 

function createDocument(progress) {
	var doc = new ProgressMongo();
	doc.Progress = progress;
	doc.save();
	return doc._id;
}

function appStart() {
	

	console.log("Loading places");

	ProgressMongo.find({IsRoot: true}, rootDataFound);
}

function loadProgress(progress) {
	if (progress.DocId) {
		progress = ProgressMongo.find({_id: progress.DocId})[0].Progress;
	}

	for (var i = 0; i < progress.Chilren.length; i++) {
		progress.Chilren[i] = loadProgress(progress.Chilren[i]);
	}

	return prog;
}

function rootDataFound(err, rootProgress) {

	if (err || rootProgress == null || rootProgress.length == 0) {
		//var allLocationsUrl = getUrl('/AllLocations-g1-Places-World.html');
		var allLocationsUrl = getUrl('/AllLocations-g255098-Places-Victoria.html');
		//var allLocationsUrl = getUrl('/Tourism-g2708206-Allansford_Victoria-Vacations.html');
	
		downloadTracker = new Progress(allLocationsUrl);
		downloadTracker.IsRoot = true;
	}
	else if (rootProgress.length == 1) {
		downloadTracker = loadProgress(rootProgress[0].Progress);
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

	function writeData(progress) {
		var root = writeDataAux(progress, 0);
		createDocument(root);
	}
	
	function writeDataAux(progress, depth) {
		var maxWriteDepth = 2;
		depth++;

		var newProg = {Children: [], Url: progress.Url};

		var nextDepth = depth == maxWriteDepth ? 0 : depth;
		for (var i = 0; i < progress.Children.length; i++) {
			newProg.Children[i] = writeData(progress.Children[i], nextDepth);
		}

		if (depth == maxWriteDepth) {
			var savedId = createDocument(newProg);
			return {DocId: savedId};
		}

		return newProg;
	}

	function unwrapProgress (prog)
	{
		if (prog.Completed) {
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

