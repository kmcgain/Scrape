var deferred = require('deferred');
var deferWorkLib = require('./deferWork');
var deferWork = deferWorkLib.deferWork;
var tReduce = deferWorkLib.trackedReduce;

var unwrapProgress = function (prog)
{
	if (prog.IsComplete) {
		return deferred(1.0);
	}

	if (prog.NumberOfChildren() == 0) {
		return deferred(0.0);
	}

	return deferWork(function(){return reduceChildren(prog);}, 
		function(sum) {
			if (prog.NumberOfExpectedChildren == 0) {
				return sum / prog.NumberOfChildren();
			}

			return sum / prog.NumberOfExpectedChildren;
		}
	);
}

function reduceChildren(prog) {
	return tReduce(prog.GetChildren(), function (accum, child) {

		return deferWork(function() {
			return unwrapProgress(child);
		}, function(result) {
			return accum + result;
		});
	}, 0.0);
}

module.exports = unwrapProgress;