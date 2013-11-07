var http = require('follow-redirects').http;
var deferred = require('deferred');
var url = require('url');
var logger = require('./logging');

http.globalAgent.maxSockets = 100;

function loadResponse(def, retry) {
	return function loadResponseClosure(resp) {
		if (resp.statusCode != 200) {
			console.log('Load error');
			retry(new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href)); 
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
	load: function(href, errCount) {
		if (!errCount) {
			errCount = 0;
		}	

		var def = deferred();

		var options = url.parse(href);
		//options.agent = false;

		var retry = function(e) {
			errCount++;
			logger.verbose('Communication Error: ' + errCount + ': ' + e);

			if (errCount >= 5) {
				throw new Error(e);
			}

			exportObj.load(href, errCount)
			.then(function(body) {
				def.resolve(body);
			})
			.done();
		}

		http.get(options, loadResponse(def, retry))
		.on("error", retry);	

		return def.promise;
	}
};

module.exports = exportObj;