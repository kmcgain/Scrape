var assert = require('node-assertthat');
var TripRegistry = require('../app/tripRegistry');

var repository = {findById: function(id){

}};
var tr = new TripRegistry(repository);

tr.Store({_id: 1, testA: true});
tr.Store({_id: 2, testB: true});
tr.Store({_id: 3, testC: true});
tr.Load(1)
.then(function(testA) {
	assert.that(testA.testA, is.true());
	assert.that(tr.IsLoaded(1), is.true());	

	tr.Remove(2);
	assert.that(tr.IsLoaded(2), is.false());

	tr.Remove(1);
	assert.that(tr.IsLoaded(1), is.false());	
})
.done();

