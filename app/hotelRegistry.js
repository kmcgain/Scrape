var deferred = require('deferred');

module.exports = function(hotelRepository) {
	var createHotel = function(locationId) {
		var def = deferred();

		var hotel = new hotelRepository();
		hotel.LocationId = locationId;
		hotel.Reviews = [];
		hotel.save(function() {def.resolve(hotel);}); // TODO: Handle the callback and keep hotel in cache until save is complete
		
		return def.promise;
	};

	var loadHotel = function(id) {
		var def = new deferred();
		hotelRepository.findById(id, function(err, hotel) {
			if (err) {
				throw new Error(err);
			}

			if (!hotel) {
				throw new Error("Couldn't find hotel");
			}

			def.resolve(hotel);
		})

		return def.promise;
	};

	var ext = {
		getHotelByLocationId: function(locationId) {
			var def = deferred();

			hotelRepository.find({LocationId: locationId}, function(err, hotel) {
				if (err) {
					throw new Error(err);
				}

				if (hotel.length > 1) {
					throw new Error('non distinct hotel');
				}

				if (hotel.length == 1) {
					def.resolve(hotel[0]);
					return;
				}

				createHotel(locationId)
				.then(def.resolve)
				.done();
			});

			return def.promise;
		},	

		getHotelById: loadHotel,

		addReviews: function(hotelId, reviews) {
			if (!reviews) {
				throw new Error('reviews must be an initialised array');
			}

			loadHotel(hotelId)
			.then(function(hotel){	
				if (!hotel) {
					throw new Error('The hotel did not load correctly');
				}

				hotel.Reviews = hotel.Reviews.concat(reviews);
				hotel.isModified = true;
				hotel.save(function() {/*TODO*/});
			})
			.done();
		},

		setTitle: function(hotelId, title) {
			loadHotel(hotelId) 
			.then(function(hotel) {
				hotel.Title = title;
				hotel.isModified = true;
				hotel.save(function() {/*TODO*/});
			})
			.done();
		},

		markAsComplete: function(hotelId) {
			loadHotel(hotelId) 
			.then(function(hotel) {
				hotel.IsComplete = true;
				hotel.isModified = true;
				hotel.save(function() {/*TODO*/});
			})
			.done();
		},
	}

	return ext;
}