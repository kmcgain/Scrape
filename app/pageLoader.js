var http = require('follow-redirects').http;
var deferred = require('deferred');

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

		http.get(href, loadResponse(def))
		.on("error", function(e) {
			console.log(e);
			throw new Error(e);
		});	

		return def.promise;
	}
};