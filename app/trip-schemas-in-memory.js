var deferred = require('./deferWork').deferred;

function objToArrayFilter(filter) {
	return function(item) {
		filter.forEach(function loop(filterMember) {
			if (filter.hasOwnProperty(filterMember)) {
				if (item.indexOf(filterMember) == -1 ||
					item[filterMember] != filter[filterMember]) {
					return false;
				}
			}
		});

		return true;
	}
}

var mongoProto = function(db) {
	return {
		find: function(filter, cb){cb(null, db.filter(objToArrayFilter(filter)));},
		findById: function(id, cb){
			cb(null, db.filter(function filter(item){ return item._id == id})[0])},
	};
};

var mongoDocProto = function(db) {
	return {
		save: function(cb){
			db.push(this);

			if (cb) {
				cb();
			}
		},
	};
};

var id = 1;
var mongo = function() {
	var db = [];

	var docConstructor = function(){
		this._id = id++;
	};
	docConstructor.__proto__ = mongoProto(db);
	docConstructor.prototype = mongoDocProto(db);

	return docConstructor;
}

exports.Entities = function () {
	var tripMongo = new mongo();

	var hotelMongo = new mongo();

	console.log('repository loaded');
	var data = {
		TripMongo: tripMongo, HotelMongo: hotelMongo, closeRepository: function (cb) {cb();}
	};

	console.log('Promising to load the repository');
	return deferred(data);
};