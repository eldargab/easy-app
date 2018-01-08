const forOwn = require('lodash.forown')

exports.Level = Level
exports.Fn = Fn
exports.Const = Const


function Level(name, opts) {
  this.name = name
  this.main = opts.main
  this.seeds = opts.seeds

  // Fields bellow are filled by analyzer
  this.defs = {}
  this.requires = {}
}


Level.prototype.type = 'level'


Level.prototype.has = function(name) {
  return this.defs[name] != null
}


Level.prototype.def = function(name) {
  return this.defs[name]
}


Level.prototype.isSeed = function(name) {
  return this.seeds.indexOf(name) >= 0
}


Level.prototype.forEachDependency = function(cb) {
  forOwn(this.requires, (def, name) => cb(name))
}


Level.prototype.forEachDefinition = function(cb) {
  forOwn(this.defs, (def, name) => cb(name, def))
}


function Fn(name, opts) {
  this.name = name
  this.args = opts.args
  this.fn = opts.fn
}


Fn.prototype.type = 'fn'


Fn.prototype.forEachDependency = function(cb) {
  this.args.forEach(cb)
}


function Const(name, value) {
  this.name = name
  this.value = value
}


Const.prototype.type = 'const'


Const.prototype.forEachDependency = function(cb) {}