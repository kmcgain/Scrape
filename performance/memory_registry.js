var TripRegistry = require('../app/tripRegistry');


var nodetime = require('nodetime');
nodetime.profile({
    accountKey: 'd1299ed3f939d927ff5c62e7b11e22f59eb46b4a', 
    appName: 'Mem Profile'
  });

var id = 1;
var tmFunc = function() {
	this._id = id++;
	this.save = function(cb) {
		cb();
	}
	
};

var sEntities = null;
require('../app/trip-schemas.js').Entities({})
.then(function(entities) {

	var tr = new TripRegistry(entities.TripMongo);
	sEntities = entities;

	addSlowly(tr, tmFunc, 0);	
})
.done();

var ids = [];
function addSlowly(tr, tm, counter) {
	if (counter == 10) {
		removeSlowly(tr,tam,0);
		return;
	}

	for (var i = 0; i < 100; i++) {
		var doc = new tm();
		doc.save(function() {});
		ids.push(doc._id);
		tr.Store(doc);
	}

	console.log('Stored: ' + tr.NumberStored());

	setTimeout(addSlowly, 1000, tr, tm, counter + 1);
}

function finish() {
	sEntities.closeRepository();
	delete ids;
	global.gc();
}

function removeSlowly(tr, tm, counter) {
	if (counter == 10) {		
		finish();
		return;
	}

	for (var i = 0; i < 100; i++) {
		tr.Load(ids[i + (counter * 100)])
		.then(function(doc) {
			tr.Remove(doc._id);	
		})
		.done();		
		
	}

	console.log('Stored: ' + tr.NumberStored());

	setTimeout(removeSlowly, 1000, tr, tm, counter + 1);
}