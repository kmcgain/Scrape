var http = require('follow-redirects').http;
var deferred = require('deferred');
var url = require('url');
var logger = require('./logger');

http.globalAgent.maxSockets = 100;

function loadResponse(def) {
	return function loadResponseClosure(resp) {
		if (resp.statusCode != 200) {
			throw new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href);
		}

		var respParts = [];
		resp.on("data", function(chunk) {
			respParts.push(chunk);
		});

		resp.on('end', function() {
			def.resolve(respParts.join(''));
		});
	};
}

var exportObj = {
	load: function(href, bodyCB, errCount) {
		if (!errCount) {
			errCount = 0;
		}	

		var def = deferred();

		var options = url.parse(href);
		//options.agent = false;

		http.get(options, loadResponse(def))
		.on("error", function(e) {
			errCount++;
			logger.verbose('Communication Error: ' + errCount + ': ' + e);

			if (errCount >= 5) {
				throw new Error(e);
			}

			exportObj.load(href, bodyCB, errCount)
			.then(function(body) {
				def.resolve(body);
			})
			.done();

		});	

		return def.promise;
	}
};

module.exports = exportObj;