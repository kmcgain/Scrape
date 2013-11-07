var Cache = function(options) {
	this.items = {};
	if (options && options.policy) {
		this.policy = options.policy;
	}
};

var convertId = function(id) {
	var stringy = JSON.stringify(id);
	return stringy;
};

var CacheAddError = function(key){};

Cache.prototype = {
	addItem: function(id, item) {
		var key = convertId(id);
		if (this.hasItem(id)) {
			throw new CacheAddError(key);			
		}
		var itemObj = {id: id, item: item};

		this.items[key] = itemObj;

		if (this.policy) {
			this.policy.call(this, itemObj);// Invoke policy with original id
		}
	},
	
	addItemIfNotExist: function(id, item) {
		try {
			this.addItem(id, item);
		}
		catch(e) {
			if (e instanceof CacheAddError) {
				return;
			}

			throw e;
		}
	},

	getItem: function(id) {
		id = convertId(id);
		return this.items[id];
	},

	hasItem: function(id) {
		var key = convertId(id);
		return key in this.items && this.items.hasOwnProperty(key);
	},

	removeItem: function(id) {
		if (!this.hasItem(id)) {
			throw new Error("Cannot remove item because it doesn't exist");
		}
		var key = convertId(id);

		delete this.items[key];
	},

	size: function() {
		var count = 0;
		for (var key in this.items) {
			if (this.items.hasOwnProperty(key)) {
				count++;
			}
		}
		
		return count;
	}
};

module.exports.timeoutPolicy = function(timeInMs) {
	return {name: "timeout", func: function(value, prev, next) {				
		setTimeout(function(){
			next(value);
		}, timeInMs);
	}};
};


module.exports.persistencePolicy = function() {
	return {name: "persistence", func: function(value, prev, next) {
		debugger;
		if (value.item.hasPendingChanges)
		{
			value.item.save(function(){/*handle error*/next(value)});
		}
		else {
			next(value);
		}
	}};
};

/*
 * we count locks rather than boolean because we want to allow multiple clients to take a lock
 * but prevent the lock release until all clients have removed the lock.
 */
module.exports.lockSetupPolicy = function() { return {name: "lockSetup", func: function(value, prev, next) {
	if (!value.lockCount) {
		value.lockCount = 0;
	}
	value.lockCount++;
	
	next(value);
}}};

module.exports.lockCheckPolicy = function() { return {name: "lockCheck", func: function(value, prev, next) {
	if (value.lockCount > 0) {
		prev(value);
		return;
	}

	next(value);
}}};

module.exports.removePolicy = function() { return {name: "remove", func: function(value, prev, next) {
	this.removeItem(value.id);
	next(value);
}}};

module.exports.createPolicyChain = function(funcs, debugOut) {
	if (!funcs) {
		return null;
	}

	var prev = null;
	for (var i = 0; i < funcs.length; i++) {
		funcs[i].prev = prev;
		prev = funcs[i];
	}

	var next = null;

	for (var i = funcs.length-1; i >= 0; i--) {
		funcs[i].next = next;
		next = funcs[i];
	}

	function emptyFunction(){};

	funcs.forEach(function(obj) {
		obj.exec = function(value) {
			if (debugOut) {debugOut(obj.name);}

			var self = this;
			obj.func.call(self, value, 
				obj.prev == null ? emptyFunction : function(value) {obj.prev.exec.call(self, value)}, 
				obj.next == null ? emptyFunction : function(value) {obj.next.exec.call(self, value)});
		}
	});

	return funcs[0].exec;
}

module.exports.Cache = Cache;