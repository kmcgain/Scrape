var deferred = require('deferred');

module.exports = function(hotelRepository) {
	var createHotel = function(locationId) {
		var hotel = new hotelRepository();
		hotel.LocationId = locationId;
		hotel.save(); // TODO: Handle the callback and keep hotel in cache until save is complete
		return hotel;
	};

	var loadHotel = function(id) {
		var def = new deferred();
		hotelRepository.find({_id: id}, function(err, hotel) {
			if (err) {
				throw new Error(err);
			}

			def.resolve(hotel);
		})

		return def.promise;
	};

	var ext = {
		getHotel: function(locationId) {
			var def = deferred();

			hotelRepository.find({LocationId: locationId}, function(err, hotel) {
				if (hotel == null) {
					hotel = createHotel(locationId);				
				}

				def.resolve(hotel);
			});

			return def.promise;
		},	

		addReviews: function(hotelId, reviews) {
			loadHotel(hotelId)
			.then(function(hotel){
				hotel.Reviews = hotel.Reviews.concat(reviews);
				hotel.isModified = true;
			})
			.done();
		},

		setTitle: function(hotelId, title) {
			loadHotel(hotelId) 
			.then(function(hotel) {
				hotel.Title = title;
				hotel.isModified = true;
			})
			.done();
		},

		markAsComplete: function(hotelId) {
			loadHotel(hotelId) 
			.then(function(hotel) {
				hotel.IsComplete = true;
				hotel.isModified = true;
			})
			.done();
		},
	}

	return ext;
}