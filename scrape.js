var cheerio = require('cheerio');
var request = require('request');
var url = require('url');

function getUrl(relHref) {
	return url.resolve('http://www.tripadvisor.com.au', relHref);
}

var Progress = function(href) {
	this.Url = href;
	this.Children = [];
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
			console.log('Found hotels page');
			progressObj.Completed = true;
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

console.log("Loading places");

//var allLocationsUrl = getUrl('/AllLocations-g1-Places-World.html');
var allLocationsUrl = getUrl('/AllLocations-g255098-Places-Victoria.html');
//var allLocationsUrl = getUrl('/Tourism-g2708206-Allansford_Victoria-Vacations.html');
var downloadTracker = new Progress(allLocationsUrl);
loadPlace(allLocationsUrl, downloadTracker);

console.log("Starting progress tracking");
function reportProgress(progress) {
	var prog = unwrapProgress(progress);
	console.log("Total progress: " + prog);

	if (prog == 1.0) {
		return;
	}
	
	setTimeout(reportProgress, 10000, progress);
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



