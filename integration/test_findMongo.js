var assert = require('node-assertthat');
var trip = require('../app/Trip');
require('../app/trip-schemas').Entities()
.then(function(entities) {
	var rego = new trip.TripRegistry(entities.HotelMongo);

	var doc = new entities.HotelMongo();
	doc.Title='test';
	doc.save();

	var id = doc._id;

	entities.TripMongo.findById(id)
	.then(function(result) {
		assert.that(result.Title, is.equalTo('test'));
	})
	.done();
})
.done();

