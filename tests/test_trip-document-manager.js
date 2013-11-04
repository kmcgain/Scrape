var Tdm = require('../app/trip-document-manager').TripDocumentManager;
var assert = require('node-assertthat');
var trip = require('../app/Trip');
var TripRegistry = require('../app/tripRegistry');

var tripRegistry =  new TripRegistry({findById2: function(doc_id, cb) {cb(null, null)}});
var hotelRegistry = new TripRegistry({});

var savedHotels = [];
var savedTrips = [];
var entities = {
	HotelMongo: function() {
		var self = this;

		this.save = function(cb) {
			savedHotels.push(self);
			cb();
		}
	},
	TripMongo: function() {
		var self = this;

		this.save = function(cb) {
			savedTrips.push(self);
			cb();
		}
	},
};

var tdm = new Tdm(tripRegistry, hotelRegistry, entities);

var completeProg = function(url, isRoot) {
	var prog = new trip.Progress(url);
	prog.IsRoot = isRoot !== undefined ? isRoot : false;
	prog.IsComplete = true;
	return prog;
}

var addChildren = function(prog, children) {
	prog.Children = children;
	return prog;
}

var progress = completeProg("a", true)

progress.AddChildren([
		completeProg("b")
			.AddChildren([
				completeProg('d'),
				completeProg('e')
				]),
		completeProg('c')
			.AddChildren([
				completeProg('f'),
				completeProg('g')
				])
	]);

tdm.WriteData(progress)
.then(function() {
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "a"}).length, is.equalTo(1));	
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "b"}).length, is.equalTo(1));
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "c"}).length, is.equalTo(1));
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "d"}).length, is.equalTo(1));
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "e"}).length, is.equalTo(1));
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "f"}).length, is.equalTo(1));
	assert.that(savedTrips.filter(function(elem) {return elem.Url == "g"}).length, is.equalTo(1));
})
.done();