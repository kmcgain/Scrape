
var TripRegistry = function(tripRepository){
	var store = {};
	var repository = tripRepository;

	this.Load = function(doc_id) {
		if (doc_id in store) {
			return store[doc_id];
		}

		var doc = repository.find({_id: doc_id})[0]; // assume 1
		store[doc_id] = doc;
		return doc;
	}

	this.Store = function(doc) {
		store[doc._id] = doc;
	}
};

var Progress = function(href) {
	this.Url = href;
	this.Children = [];
	this.TripDoc_id = null;
	this.IsRoot = false;
	this.IsComplete = false;
};

var ProgressProxy = function(childDoc_id, tripRegistry) {
	var self = this;
	this.TripDoc_id = childDoc_id;

	var url = null;
	var children = null;
	var isRoot = null;
	var IsComplete = null;
	var loadedProgress = null
	var registry = tripRegistry;

	var loadDoc = function() {
		var doc = registry.Load(childDoc_id);
		loadedProgress = lazyConvertDoc(doc);
	};

	var toProxy = ["Url", "Children", "IsRoot", "IsComplete"];

	var proxiedGet = function(funcOnProg) {
		if (loadedProgress == null) {
			loadDoc();
		}

		return funcOnProg(loadedProgress);
	}

	toProxy.forEach(function (proxyName) {
		Object.defineProperty(self, proxyName, {
			get: function() {
				return proxiedGet(function(prog){return prog[proxyName]});
			},
			set: function(value) {
				loadProgress[proxyName] = value;
			},
		});
	});
}

var lazyConvertDoc = function(doc, tripRegistry) {
	var prog = new Progress(doc.Url);
	prog.TripDoc_id = doc._id;
	prog.IsRoot = doc.IsRoot;
	prog.IsComplete = doc.IsComplete;

	prog.Children = doc.Children.map(function (childDoc_id) {
		return new ProgressProxy(childDoc_id, tripRegistry);
	});

	return prog;
};

exports.lazyConvertDoc = lazyConvertDoc;
exports.Progress = Progress;
exports.tripRegistry = TripRegistry;