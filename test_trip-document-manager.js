var Tdm = require('./trip-document-manager').TripDocumentManager;
var assert = require('node-assertthat');

var tripRegistry = {
	Store: function(){}
};
var hotelRegistry = {
	Store: function(){}	
};

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
	return {
		Url: url,
		Children: [],
		TripDoc_id: null,
		IsRoot: isRoot !== undefined ? isRoot : false,
		IsComplete: true,
	};
}

var addChildren = function(prog, children) {
	prog.Children = children;
	return prog;
}

var progress = completeProg("a", true)
progress.Children = [
	addChildren(completeProg("b"), [
		completeProg('d'),
		completeProg('e')
		]),
	addChildren(completeProg("c"), [
		completeProg('f'),
		completeProg('g')
		]),
]

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