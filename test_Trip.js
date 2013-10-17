var trip = require('./Trip');
var assert = require('node-assertthat');

var repository = {
	find: function(json) {
		return [{
			Url: "the_url",
			Children: [],
			IsRoot: true,
			IsComplete: true,
		}];
	}
};
var tr = new trip.tripRegistry(repository);

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

var child = prog.Children[0];
assert.that(child.Url, is.equalTo("the_url"));
assert.that(child.IsRoot, is.true());
assert.that(child.IsComplete, is.true());

