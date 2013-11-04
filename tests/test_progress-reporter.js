var Progress = require('../app/Trip').Progress;
var reporter = require('../app/progress-reporter');
var assert = require('node-assertthat');

function complete() {
	var c = new Progress();
	c.IsComplete = true;
	return c;
}

function incomplete() {
	var i = new Progress();
	return i;
}

var input = new Progress('a');
input.AddChild(complete());
input.AddChild(incomplete());

reporter(input)
.then(function(total) {
	assert.that(total, is.equalTo(0.5));
})
.done();

var input2 = incomplete();
var child1 = incomplete();
child1.AddChild(complete());
child1.AddChild(incomplete());

input2.AddChild(child1)
input2.AddChild(complete())

reporter(input2)
.then(function(total) {
	assert.that(total, is.equalTo(0.75));
})
.done();