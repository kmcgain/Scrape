var deferred = require('deferred');

module.exports = function(repository){
	var store = {};
	var tRepository = repository;

	this.Load = function(doc_id) {
		if (doc_id in store) {
			return deferred(store[doc_id]);
		}

		var def = new deferred();
		
		tRepository.findById(doc_id, function(err, doc) {
			if (doc == null) {
				throw new Error("Couldn't find the document for doc_id: " + doc_id);
			}			
			store[doc_id] = doc;
			def.resolve(doc);
		});

		return def.promise;
	}

	this.Store = function(doc) {
		//store[doc._id] = doc;
	}

	this.IsLoaded = function(doc_id) {
		return doc_id in store;
	}

	this.Remove = function(doc_id) {
		console.log('deleting ' + doc_id);
		delete store[doc_id];
	}

	this.NumberStored = function() {
		var count = 0;

		for (var key in store) {
			if (store.hasOwnProperty(key)) {

				count++;
			}
		}

		return count;
	}
};

