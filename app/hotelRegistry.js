var deferred = require('deferred');
var Review = require('./review').Review;
var CacheRegistry = require('./cacheRegistry');
var logger = require('./logging');

module.exports = function(hotelRepository, progressRegistry) {
	var cacheRegistry = new CacheRegistry(hotelRepository);

	var createHotel = function(locationId, parentProgressId) {
		if (!parentProgressId) {
			throw new Error('Must define parent of hotel');
		}

		var hotel = new hotelRepository();
		hotel.LocationId = locationId;
		hotel.Reviews = [];
		hotel.ParentProgressId = parentProgressId;
		cacheRegistry.add(hotel._id, hotel);
		
		return hotel;
	};

	var loadHotel = function(id) {
		return cacheRegistry.load(id);
	};

	var ext = {};
	ext.getHotelByLocationId = function(locationId, parentProgressId) {
		var def = deferred();

		cacheRegistry.loadBy({LocationId: locationId})
		.then(function(hotel) {
			if (hotel == null) {
				def.resolve(createHotel(locationId, parentProgressId).id);
			}
			else {
				cacheRegistry.unlock(hotel.id);
				def.resolve(hotel.id);
			}
		})
		.done();

		return def.promise;
	};	

	ext.addReviews = function(hotelId, reviews) {
		if (!reviews) {
			throw new Error('reviews must be an initialised array');
		}

		loadHotel(hotelId)
		.then(function(hotel){	
			if (!hotel) {
				throw new Error('The hotel did not load correctly');
			}

			hotel.Reviews = hotel.Reviews.concat(reviews);
			hotel.hasPendingChanges = true;
			cacheRegistry.unlock(hotelId);				
		})
		.done();
	};

	ext.setTitle = function(hotelId, title) {
		loadHotel(hotelId) 
		.then(function(hotel) {
			hotel.Title = title;
			hotel.hasPendingChanges = true;
			cacheRegistry.unlock(hotelId);
		})
		.done();
	};

	ext.markAsComplete = function(hotelId) {		
		logger.verbose('Hotel Is Complete ' + hotelId);

		loadHotel(hotelId) 
		.then(function(hotel) {
			hotel.IsComplete = true;
			hotel.hasPendingChanges = true;
			cacheRegistry.unlock(hotelId);

			if (!hotel.ParentProgressId) {
				throw new Error('parent not defined'); 
			}
			progressRegistry.markAsComplete(hotel.ParentProgressId);
		})
		.done();
	};

	ext.setNumberOfExpectedReviews = function setNumberOfExpectedReviews(hotelId, numberOfExpectedReviews) {
		loadHotel(hotelId)
		.then(function(hotel) {
			hotel.NumberOfExpectedChildren = numberOfExpectedReviews;
			hotel.hasPendingChanges = true;
			cacheRegistry.unlock(hotelId);
		})
		.done();
	};

	ext.createReview = function createReview(hotelId, reviewId) {
		var def = deferred();

		loadHotel(hotelId)
		.then(function(hotel) {
			var review = new Review(reviewId);
			hotel.Reviews.push(review);
			def.resolve(review.Id);
			cacheRegistry.unlock(hotelId);
		})
		.done();

		return def.promise;
	};

	ext.setReviewDetails = function setReviewDetails(hotelId, reviewId, details) {
		loadHotel(hotelId)
		.then(function(hotel) {				
			var review = hotel.Reviews.single(function(review) {return review.Id == reviewId;});
			review.Message = details.message;
			review.Rating = details.rating;
			review.Quote = details.quote;	
			if ((hotel.Reviews.length == hotel.NumberOfExpectedChildren) && allReviewsFinished(hotel)) {
				ext.markAsComplete(hotelId);
			}		

			cacheRegistry.unlock(hotelId);			
		})
		.done();
	};

	function allReviewsFinished(hotel) {
		return hotel.Reviews.filter(function(review) { return !review.Rating; }).length == 0;
	}

	return ext;
};