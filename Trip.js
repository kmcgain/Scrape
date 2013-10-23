var deferred = require('deferred');
var deferWork = require('./deferWork');
var promisify = deferred.promisify;

var TripRegistry = function(tripRepository){
	var store = {};
	var repository = tripRepository;

	this.Load = function(doc_id) {
		if (doc_id in store) {
			return new deferred(store[doc_id]);
		}

		return deferWork(function() {
			return promisify(repository.findById)(doc_id);	
		}, function(doc) {
			store[doc_id] = doc;
			return doc;
		});
	}

	this.Store = function(doc) {
		store[doc._id] = doc;
	}
};

var Progress = function(href) {
	var self = this;
	this.Url = href;
	var children = [];
	this.TripDoc_id = null;
	this.IsRoot = false;
	this.IsComplete = false;


	this.AddChild = function(child) {
		children.push(child);
	}

	this.GetChild = function(index) {
		return children[index].realise();
	}

	this.NumberOfChildren = function() {
		return children.length;
	}

	this.realise = function() {
		return new deferred(self);
	}

	this.GetChildren = function() {
		return children.map(function(child) {return child.realise()});
	}
};

var ProgressProxy = function(childDoc_id, tripRegistry) {
	Progress.call(this);

	this.loadedProgress = null;	
	this.registry = tripRegistry;
}

ProgressProxy.prototype = Object.create(Progress.prototype);

ProgressProxy.prototype.realise = function() {
	if (this.loadedProgress != null) {
		return new deferred(this.loadedProgress);
	}

	return deferWork(function() {
		return this.registry.Load(this.childDoc_id);
	}, function(doc) {
		this.loadedProgress = lazyConvertDoc(doc, tripRegistry);	
		return this.loadedProgress;
	});
}

ProgressProxy.prototype.GetChild = function(index) {
	return children[index].realise();
}

	// var self = this;
	// this.TripDoc_id = childDoc_id;

	// var url = null;
	// var children = null;
	// var isRoot = null;
	// var IsComplete = null;
	// var loadedProgress = null
	// var registry = tripRegistry;

	// var loadDoc = function() {
	// 	return deferWork(function() {
	// 		return registry.Load(childDoc_id);
	// 	}, function(doc) {
	// 		loadedProgress = lazyConvertDoc(doc, tripRegistry);	
	// 		return doc;
	// 	});
	// };

	// var toProxy = ["Url", "Children", "IsRoot", "IsComplete"];

	// var proxiedGet = function(funcOnProg) {
	// 	if (loadedProgress == null) {
	// 		return deferWork(function() {
	// 			return loadDoc();
	// 		}, function() {
	// 			return new deferred(funcOnProg(loadedProgress));				
	// 		})
	// 	}

	// 	return new deferred(funcOnProg(loadedProgress));
	// }

	// toProxy.forEach(function (proxyName) {
	// 	Object.defineProperty(self, proxyName, {
	// 		get: function() {
	// 			return proxiedGet(function(prog){return prog[proxyName]});
	// 		},
	// 		set: function(value) {
	// 			loadProgress[proxyName] = value;
	// 		},
	// 	});
	// });
//}

var lazyConvertDoc = function(doc, tripRegistry) {
	var prog = new Progress(doc.Url);
	prog.TripDoc_id = doc._id;
	prog.IsRoot = doc.IsRoot;
	prog.IsComplete = doc.IsComplete;

	doc.Children.forEach(function (childDoc_id) {
		prog.AddChild(new ProgressProxy(childDoc_id, tripRegistry));
	});

	return prog;
};

exports.lazyConvertDoc = lazyConvertDoc;
exports.Progress = Progress;
exports.tripRegistry = TripRegistry;