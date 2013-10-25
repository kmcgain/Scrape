var deferred = require('deferred');
var tDeferred = require('./deferWork').trackedDeferred;

exports.Entities = function () {
	var def = new tDeferred();

	var repositoryPromise = require('./repository.js').repository();
	
	repositoryPromise.then(function (repository) {
		var tripSchema = new repository.Schema({
			Children: [repository.Schema.ObjectId],
			Url: String,
			IsRoot: Boolean,
			IsComplete: Boolean,	
			Hotel: repository.Schema.ObjectId,
		});

		var hotelSchema = new repository.Schema({
			Id: String,
			Title: String,
			LocationId: String,
			Reviews: [repository.Schema.Types.Mixed],
		});

		var tripMongo = repository.modelExt('Trip', tripSchema);
		var hotelMongo = repository.modelExt('Hotel', hotelSchema);

		console.log('repository loaded');
		def.resolve({TripMongo: tripMongo, HotelMongo: hotelMongo, closeRepository: function () {
			repository.connection.db.close();
		}});
	})
	.done();

	console.log('Promising to load the repository');
	return def.promise;
};