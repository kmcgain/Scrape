var deferred = require('deferred');

var Lock = function(delFunc) {
	this.waiters = [];
	this.delFunc = delFunc;
};
Lock.prototype = {
	addWaiter: function(def, workFunc) {
		this.waiters.push({def: def, workFunc: workFunc});
		if (this.waiters.length == 1) {
			this.signalNext();
		}
	},
	signalNext: function() {
		var self = this;

		if (self.waiters.length > 0) {
			var next = self.waiters[0];
			var finalDef = next.def;
			
			var def = deferred();
			
			next.workFunc(def);

			def.promise
			.then(function(data) {
				self.waiters.shift();
				finalDef.resolve(data);
				self.signalNext();					
			})
			.done();
		}
		else {
			this.delFunc();
		}
	},
}


var loadLocks = {};


exports.getLock = function getLock(lockObject, workFunc) {
	
	var lock = loadLocks[lockObject];

	if (!lock) {
		lock = new Lock(function delFunc() {
			delete loadLocks[lockObject];
		});
		loadLocks[lockObject] = lock;
	}

	var def = deferred();
	lock.addWaiter(def, workFunc);
	return def.promise;
}