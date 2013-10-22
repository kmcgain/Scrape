require('./trip-schemas').Entities()
.then(function(entities) {	
	debugger;

	entities.HotelMongo.drop();
	entities.TripMongo.drop();	

	debugger;

	entities.closeRepository();
})
.done();