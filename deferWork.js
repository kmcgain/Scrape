var deferred = require('deferred');

var deferWork = function(work, handler) {	
	if (Array.isArray(work)) {
		return deferred.map(work, function(item) {
			return item;
		});
	}

	var def = new deferred();

	work()
	.then(function(result) {
		if (!handler) {
			def.resolve();
			return;
		}
		
		var handledResult = handler(result);
		def.resolve(handledResult);
	})
	.done();

	return def.promise;
}

module.exports = deferWork;