var deferred = require('deferred');
var deferWork = require('./deferWork').deferWork;
var promisify = deferred.promisify;

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
		return self;
	}

	this.AddChildren = function(childrenToAdd) {
		childrenToAdd.forEach(function(elem) {children.push(elem);});
		return self;
	}

	this.GetChild = function(index) {
		return children[index].realise();
	}

	this.NumberOfChildren = function() {
		return children.length;
	}

	this.GetChildren = function() {
		return children.map(function(child) {return child.realise()});
	}

	this.GetChildIds = function() {
		return children.map(function(child) {
			return child.TripDoc_id;
		});
	}

	this.GetNonProxiedChildren = function() {
		return children.filter(function(item) {return !item.isProxied});
	}

	this.RemoveChild = function(child) {
		var idx = children.indexOf(child);
		if (idx == -1) {
			throw new Error("Can't find child to remove");
		}

		children.splice(idx, 1);
	}
};

Progress.prototype.realise = function() {	
	return deferred(this);
};
Progress.prototype.isProxied = false;

var ProgressProxy = function(doc_id, tripRegistry) {	
	Progress.call(this);
	this.TripDoc_id = doc_id;
	this.loadedProgress = null;	
	this.registry = tripRegistry;
}

ProgressProxy.isProxied = true;

ProgressProxy.prototype = new Progress();

ProgressProxy.prototype.realise = function() {
	var self = this;
	if (self.loadedProgress != null) {
		return deferred(self.loadedProgress);
	}

	return deferWork(function() {
		return self.registry.Load(self.TripDoc_id);
	}, function(doc) {
		self.loadedProgress = lazyConvertDoc(doc, self.registry);	
		return self.loadedProgress;
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
exports.ProgressProxy = ProgressProxy;