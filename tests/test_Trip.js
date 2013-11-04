var trip = require('../app/Trip');
var assert = require('node-assertthat');
var TripRegistry = require('../app/tripRegistry');

var repository = {
	findById: function(id, callback) {
		callback(null, {
			Url: "the_url",
			Children: [],
			IsRoot: true,
			IsComplete: true,
		});
	}
};
var tr = new TripRegistry(repository);

var doc = {
	Children: [1],
	IsRoot: true,
	IsComplete: false,
	_id: 2,
};


var prog = trip.lazyConvertDoc(doc, tr);

assert.that(prog.IsRoot, is.true());
assert.that(prog.IsComplete, is.false());
assert.that(prog.TripDoc_id, is.equalTo(2));

prog.GetChild(0)
.then(function(child) {
	debugger;
	assert.that(child.Url, is.equalTo("the_url"));
	assert.that(child.IsRoot, is.true());
	assert.that(child.IsComplete, is.true());
}).done();

