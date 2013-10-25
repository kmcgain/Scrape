var deferred = require('deferred');
var deferWorkLib = require('./deferWork');
var trackedDeferred = deferWorkLib.trackedDeferred;
var deferWork = deferWorkLib.deferWork;
var promisify = deferred.promisify;
var sprintf = require('util').format;
var deferredMap = deferWorkLib.trackedMap;

var pSave = function(doc) {
	var def = new trackedDeferred();

	doc.save(function(err) {
				if (err) {
					console.log('Error: ' + err);
					throw new Error(err);
				}

				def.resolve();
			});

	return def.promise;
};

exports.TripDocumentManager = function (tripRegistry, hotelRegistry, entities) {
	this.tripRegistry = tripRegistry;
	this.hotelRegistry = hotelRegistry;

	this.finish = entities.closeRepository;

	var createDocument = function(progress, idCallback) {
		var def = new trackedDeferred();

		var doc = new entities.TripMongo();

		updateDocData(doc, progress)
		.then(function() {return pSave(doc);})
		.then(def.resolve)
		.done();
		
		tripRegistry.Store(doc); // we can register the doc before it is saved back to the repo!	

		idCallback(doc._id);
		return def.promise;
	}

	var createHotelDocument = function(hotel, idCallback) {
		var doc = new entities.HotelMongo();

		updateHotelDoc(doc, hotel);
		hotelRegistry.Store(doc);
		idCallback(doc._id);

		return pSave(doc);
	}

	var updateDocData = function(doc, progress) {
		doc.Url = progress.Url;
		doc.IsRoot = progress.IsRoot;
		doc.IsComplete = progress.IsComplete;
		doc.Children = [];

		var promises = [deferWork(progress.GetChildren(), function(child) {
			doc.Children.push(child.TripDoc_id);				
		})];

		debugger;
		if (progress.Hotel) {
			promises.push(updateHotel(doc, progress.Hotel));
		}

		if (promises.length == 0) {
			promises.push(deferred(0));
		}

		return deferredMap(promises);
	}

	var updateHotelDoc = function(doc, hotel) {
		doc.Id = hotel.Id;
		doc.Reviews = hotel.Reviews;
		doc.LocationId = hotel.LocationId;
		doc.Title = hotel.Title;
	}

	var updateHotel = function(progressDoc, hotel) {
		if (hotel.Doc_id == null) {
			return createHotelDocument(hotel, function(id){hotel.Doc_id = id});			
		}

		var hotelDoc = hotelRegistry.Load(hotel.Doc_id);
		updateHotelDoc(hotelDoc, hotel);

		return deferred(0);
	}

	this.WriteData = function(progress) {

		// Prevent termination while writing
		var out = writeDataAux(progress);		

		//output(progress);

		return out;
	}

	// TODO: Optimise by not always updating every item.
	// Only update items that weren't previously complete?
	var writeDataAux = function(progress) {
		var promises = [deferWork(progress.GetChildren(), writeDataAux)];
		
		if (progress.TripDoc_id == null) {
			promises.push(createDocument(progress, function (id) {progress.TripDoc_id = id}));
			return deferredMap(promises);
		}
		
		var docDef = new trackedDeferred();

		tripRegistry.Load(progress.TripDoc_id)
		.then(function(doc) {
			updateDocData(doc, progress)
			.then(function () {
				return pSave(doc); 
			})
			.then(docDef.resolve)
			.done();
		})
		.done();

		promises.push(docDef.promise);

		return deferredMap(promises);
	}
}

function output(progress) {
	// var out = outputAux(progress);
	// console.log(sprintf("Writing data: %j", out).replace(/,/g, "\n"));
	console.log(JSON.stringify(outputAux(progress), null, "\t"));	
}

function outputAux(progress) {	
	var children = progress.Children.map(outputAux);

	return {TripDoc_id: progress.TripDoc_id, Url: progress.Url, Hotel: progress.Hotel != null ? progress.Hotel.Title : null, Children: children};
}
