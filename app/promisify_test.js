var deferred = require('deferred');
var assert = require('node-assertthat');
var request = require('request');

deferred.promisify(request)
	('http://www.google.com.au')
	.then(function (args) {
		var resp = args[0],
			body = args[1];
		assert.that(resp, is.not.null());
		assert.that(body, is.not.null());
		assert.that(resp, is.not.undefined());	
		assert.that(body, is.not.undefined());
	})
	.done();
