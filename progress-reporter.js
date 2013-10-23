var deferred = require('deferred');
var deferWork = require('./deferWork');

var unwrapProgress = function (prog)
{
	if (prog.IsComplete) {
		return new deferred(1.0);
	}

	if (prog.NumberOfChildren() == 0) {
		return new deferred(0.0);
	}

	return deferWork(function(){return reduceChildren(prog);}, 
		function(sum) {
		return sum / prog.NumberOfChildren();
	});
}

function reduceChildren(prog) {
	return deferred.reduce(prog.GetChildren(), function (accum, child) {

		return deferWork(function() {
			return unwrapProgress(child);
		}, function(result) {
			return accum + result;
		});
	}, 0.0);
}

module.exports = unwrapProgress;