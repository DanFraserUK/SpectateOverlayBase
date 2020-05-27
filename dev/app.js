require('colors');
process.title = 'webUiGenerator';

var async = require('async');
var exec = require('child_process').exec;
var path = require('path');
var chokidar = require('chokidar');

// Read out an error. Obnoxious but should happen seldomly so not a big deal
process.addListener('uncaughtException', function (err) {
	console.log(new Date());
	exec('say "'+err.message+'"');
	console.log(('Caught exception: '+err+'\n'+err.stack).red);
	console.log('\u0007'); // Terminal bell
});

var assetsDir = path.resolve(__dirname + '/../assets');

// Initiate the httpd that serves assets and some logic for reloading
var httpServer = require('./lib/httpServer')(assetsDir);

// Enable generation of files on change
var assetGenerator = require('./lib/generateHandler')(httpServer, assetsDir);
chokidar.watch(assetsDir, {
	'ignored': /[\/\\]\./,
	'persistent': true
}).on('change', assetGenerator);

assetGenerator(null);