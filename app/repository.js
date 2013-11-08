var deferWorkLib = require('./deferWork');
var deferred = deferWorkLib.deferred;
var promisify = deferred.promisify;

var mongoose = require('mongoose');

//mongoose.connect('mongodb://admin:dx7XmV8Hx1Hb@127.9.111.2:27017');
//mongoose.connect('mongodb://admin:dx7XmV8Hx1Hb@127.0.0.1:27018');
mongoose.connect('mongodb://127.0.0.1');

exports.repository = function() {
	var def = new deferred();

	mongoose.connection.once('open', function () {
		mongoose.modelExt = function(collection, schema) {
			var md = mongoose.model(collection, schema);
			md.drop = function() {
				collection = convertToMongoCollectionName(collection);
				console.log('removing ' + collection);
				mongoose.connection.db.dropCollection(collection, function (){});
			};
			return md;
		}
	
		def.resolve(mongoose);
	});

	return def.promise;
};

function convertToMongoCollectionName(name) {
	return name.toLowerCase() + (endsWith(name, 's') ? "" : "s") ;
}

var endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};