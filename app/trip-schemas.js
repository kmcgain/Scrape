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
			NumberOfExpectedChildren: Number,
			ParentId: repository.Schema.ObjectId,
		});

		var hotelSchema = new repository.Schema({
			Id: String,
			Title: String,
			LocationId: String,
			Reviews: [repository.Schema.Types.Mixed],
		});

		var tripMongo = repository.modelExt('Trip', tripSchema);
		var hotelMongo = repository.modelExt('Hotel', hotelSchema);

		tripMongo.mapReduce = function(mapF, reduceF) {
			var def = deferred();

			repository.connection.db.executeDbCommand({
				mapreduce: 'trips',
				map: mapF.toString(),
				reduce: reduceF.toString(),
				out: 'tripsMR', // TODO: allow custom name to avoid conflict
			}, function(err, result) {
				if (err) {
					throw new Error(err);
				}

				result.documents.forEach(function(doc) {
					if (!doc.ok) {
						throw new Error(doc);
					}	
				})

				repository.connection.db.collection('tripsMR', function(err, tripsMR) {
					tripsMR.find({}).toArray(function(err, items) {
						def.resolve(items[0].value);
					});
				});
				
			});

			return def.promise;
		};

		console.log('repository loaded');
		def.resolve({TripMongo: tripMongo, HotelMongo: hotelMongo, closeRepository: function (cb) {
			repository.connection.db.close(cb);
		}});
	})
	.done();

	console.log('Promising to load the repository');
	return def.promise;
};