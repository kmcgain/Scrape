console.log('loading logging');
var logger = null;
var winston = require('winston');
var logger = new (winston.Logger)({
	levels: {progress: 0, verbose: 1, error: 2},
	transports: [
		//new winston.transports.File({filename: 'progress.log', level: 'progress'}),
		new winston.transports.File({filename: 'verbose.log', level: 'verbose'})
	]
});

module.exports = logger;