
exports.TripDocumentManager = function (tripRegistry, hotelRegistry, entities) {
	this.tripRegistry = tripRegistry;
	this.hotelRegistry = hotelRegistry;

	this.finish = entities.closeRepository;

	var createDocument = function(progress) {
		var doc = new entities.TripMongo();
		updateDocData(doc, progress);
		doc.save();

		tripRegistry.Store(doc);
		return doc._id;
	}

	var createHotelDocument = function(hotel) {
		var doc = new entities.HotelMongo();
		doc.save();

		updateHotelDoc(doc, hotel);

		hotelRegistry.Store(doc);
		return doc._id;
	}

	var updateDocData = function(doc, progress) {
		doc.Url = progress.Url;
		doc.IsRoot = progress.IsRoot;
		doc.IsComplete = progress.IsComplete;
		doc.Children = progress.Children.map(function (item) {return item.TripDoc_id;});

		if (progress.Hotel) {
			updateHotel(doc, progress.Hotel);
		}
	}

	var updateHotelDoc = function(doc, hotel) {
		doc.Id = hotel.Id;
		doc.Reviews = hotel.Reviews;
		doc.LocationId = hotel.LocationId;
		doc.Title = hotel.Title;
	}

	var updateHotel = function(progressDoc, hotel) {
		if (hotel.Doc_id == null) {
			hotel.Doc_id = createHotelDocument(hotel);
			return;
		}

		var hotelDoc = hotelRegistry.Load(hotel.Doc_id);
		updateHotelDoc(hotelDoc, hotel);
	}

	this.WritingData = false;
	this.WriteData = function(progress) {
		// Prevent termination while writing
		debugger;
		writingData = true;
		writeDataAux(progress);
		writingData = false;
	}

	// TODO: Optimise by not always updating every item.
	// Only update items that weren't previously complete?
	var writeDataAux = function(progress) {		
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
}