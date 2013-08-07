var util = require('./lib/util')
var App = require('./lib/app')

exports = module.exports = function() {
  return new App
}

exports.nsconcat = util.nsconcat

exports.nssuffix = util.nssuffix
