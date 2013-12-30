
module.exports.timeoutPolicy = function(timeInMs) {
	return {name: "timeout", func: function(value, prev, next) {				
		setTimeout(function(){
			next(value);
		}, timeInMs);
	}};
};


module.exports.persistencePolicy = function() {
	return {name: "persistence", func: function(value, prev, next) {
		if (value.item.hasPendingChanges)
		{
			value.item.save(function(){/*TODO: handle error*/next(value)});
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
