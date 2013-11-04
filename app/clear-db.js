require('./trip-schemas').Entities()
.then(function(entities) {	
	entities.HotelMongo.drop();
	entities.TripMongo.drop();	

	entities.closeRepository();
})
.done();