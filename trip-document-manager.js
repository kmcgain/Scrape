var deferred = require('deferred');
var promisify = deferred.promisify;
var sprintf = require('util').format;

var pSave = function(doc) {
	var def = new deferred();

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
		var def = new deferred();

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
		doc.Children = progress.Children.map(function (item) {return item.TripDoc_id;});

		if (progress.Hotel) {
			return updateHotel(doc, progress.Hotel);
		}

		return new deferred(0);
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

		return new deferred(0);
	}

	this.WriteData = function(progress) {

		// Prevent termination while writing
		var out = writeDataAux(progress);		

		//output(progress);
		debugger;

		return out;
	}

	// TODO: Optimise by not always updating every item.
	// Only update items that weren't previously complete?
	var writeDataAux = function(progress) {

		var promises = [];
		for (var i = 0; i < progress.Children.length; i++) {
			promises.push(writeDataAux(progress.Children[i]));
		}

		if (progress.TripDoc_id == null) {
			promises.push(createDocument(progress, function (id) {progress.TripDoc_id = id}));
			return deferred.map(promises);
		}
		
		var doc = tripRegistry.Load(progress.TripDoc_id);
				
		var docDef = new deferred();
		promises.push(docDef.promise);

		updateDocData(doc, progress)
		.then(function () {
			return pSave(doc); 
		})
		.then(docDef.resolve)
		.done();

		return deferred.map(promises);
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
