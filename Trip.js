var deferred = require('deferred');
var deferWork = require('./deferWork').deferWork;
var promisify = deferred.promisify;

var TripRegistry = function(tripRepository){
	var store = {};
	var repository = tripRepository;

	this.Load = function(doc_id) {
		if (doc_id in store) {
			return deferred(store[doc_id]);
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

var Progress = function(href, parent) {
	var self = this;
	this.Url = href;
	var children = [];
	this.TripDoc_id = null;
	this.IsRoot = false;
	this.IsComplete = false;
	this.Parent = parent;
	this.NumberOfExpectedChildren = 0;

	this.PrintParents = function() {
		console.log(printParentsAux(self));
	}

	var printParentsAux = function(prog) {
		if (!prog) {
			return "";
		}

		return prog.Url + ":::" + printParentsAux(prog.Parent);
	}

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
		return deferred(self);
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
		return deferred(this.loadedProgress);
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