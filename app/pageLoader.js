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

module.exports = {
	load: function(href, bodyCB) {	
		var def = deferred();

		var options = url.parse(href);
		//options.agent = false;

		http.get(options, loadResponse(def))
		.on("error", function(e) {
			console.log(e);
			load(href, bodyCB)
			.then(function(body) {
				def.resolve(body);
			})
			.done();

		});	

		return def.promise;
	}
};