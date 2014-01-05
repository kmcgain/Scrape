"use strict";

var http = require('follow-redirects').http;
var deferred = require('deferred');
var url = require('url');
var logger = require('./logging');

http.globalAgent.maxSockets = 100;

function deRef(str) {
	return (str + ' ').substring(0, str.length);
}

function loadResponseHandler(def, href, resp, errCount) {
	if (resp.statusCode != 200) {
		console.log('Load error');
		retry(new Error("We didn't get 200, we got " + resp.statusCode + " while loading " + href), href, def, errCount); 
	}

	var respParts = [];
	resp.on("data", function(chunk) {
		respParts.push(chunk);
	});

	resp.on('end', function() {
		def.resolve(deRef(respParts.join('')));
	});
}

function retry(error, href, def, errCount) {
	// TODO: Some errors aren't retryable? Some aren't really errors either.
	errCount++;
	logger.verbose('Communication Error: ' + errCount + ': ' + error);

	if (errCount >= 5) {
		throw new Error(error);
	}

	exportObj.load(href, errCount)
	.then(function(body) {
		def.resolve(body);
	})
	.done();
}

var exportObj = {
	load: function load(href, errCount) {
		if (!errCount) {
			errCount = 0;
		}	

		var def = deferred();

		var options = url.parse(href);
		//options.agent = false;

		http.get(options, function httpGetHandler(resp) {
			loadResponseHandler(def, href, resp, errCount);
		})
		.on("error", function(error) {
			retry(error, href, def, errCount);
		});

		return def.promise;
	}
};

module.exports = exportObj;