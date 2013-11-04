var assert = require('node-assertthat');
var trip = require('../app/Trip');
var TripDM = require('../app/trip-document-manager').TripDocumentManager;
var deferred = require('deferred');
var TripRegistry = require('../app/tripRegistry');

function completeProg(name) {
	var prog = new trip.Progress('c');
	prog.IsComplete = true;
	return prog;
}

// test not already saved

var c = completeProg('c');
c.Hotel = {};

var a = new trip.Progress('a');
a.AddChildren([
	new trip.Progress('b'),
	c
	]);

var newIdsForDocs = {'a': 1, 'b': 2, 'c': 3};

var repository = {
	savedDocs: [],
	save: function(doc) {
		this.savedDocs[doc._id] = doc;
	},
	findById: function(doc_id, cb){
		cb(null, this.savedDocs[doc_id]);
	}
};


var tripReg = new TripRegistry(repository);
var hotelReg = {Store: function(){}};
var entities = {
	TripMongo: function(){
		return {
			save: function(cb) {
				this._id = newIdsForDocs[this.Url];		
				repository.save(this);	
				cb();
			}
		}
	}, 
	HotelMongo: function(){
		return {
			save: function(cb) {cb();}
		}
	}
};		
var manager = new TripDM(tripReg, hotelReg, entities);

manager.WriteData(a)
.then(function(){
	assert.that(a.NumberOfChildren(), is.equalTo(2));

	assert.that(tripReg.IsLoaded(3), is.false());
	// make sure the completed child is proxied
	assert.that(a.GetNonProxiedChildren().indexOf(c), is.equalTo(-1)); 

	deferred.map(a.GetChildren())
	.then(function(children) {
		debugger;
		// make sure child does exist
		assert.that(children.filter(function(item) {return item.Url == 'c'}).length, is.equalTo(1));
	})
	.done();
})
.done();