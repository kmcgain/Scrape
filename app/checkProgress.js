require('./arrayExt');
var deferWork = require('./deferWork');
var TripRegistry = require('./tripRegistry');

//require('./trip-schemas-in-memory').Entities()
require('./trip-schemas').Entities()
.then(function (schemas) {	
	var tripEntities = schemas;

	tripEntities.TripMongo.mapReduce(function(){
		emit(1, {expectedChildren: this.NumberOfExpectedChildren, complete: this.IsComplete ? 1 : 0});
	}, function(key, values){
		var totalExpectedChildren = Array.sum(values.map(function(item){return item.expectedChildren}));
		var totalComplete = Array.sum(values.map(function(item){return item.complete}));
		return {expectedChildren: totalExpectedChildren, complete: totalComplete};
	})
	.then(function(result) {		
		console.log('progress: ' + (result.complete / result.expectedChildren));
	})
	.finally(function() {
		tripEntities.closeRepository();
	})
	.done();
})
.done();