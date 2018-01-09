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


Level.prototype.forEachDependency = function(cb) {
  forOwn(this.requires, (def, name) => cb(name))
}


Level.prototype.has = function(name) {
  return this.defs[name] != null
}


Level.prototype.def = function(name) {
  return this.defs[name]
}


Level.prototype.isSeed = function(name) {
  return this.seeds.indexOf(name) >= 0
}


Level.prototype.forEachDefinition = function(cb) {
  forOwn(this.defs, (def, name) => cb(name, def))
}


function Fn(name, opts) {
  this.name = name
  this.fn = opts.fn
  this.args = opts.args || []
  this.pre = opts.pre || []
  this.uses = this.pre.concat(this.args).concat(opts.uses || []).reduce(function(m, name) {
    if (name == 'evaluate') return m
    m[name] = true
    return m
  }, {})
}


Fn.prototype.type = 'fn'


Fn.prototype.forEachDependency = function(cb) {
  forOwn(this.uses, (_, name) => cb(name))
}


Fn.prototype.forEachPreAndArgument = function(cb) {
  let seen = {}

  function call_cb(name) {
    if (seen[name]) return
    seen[name] = true
    cb(name)
  }

  this.pre.forEach(call_cb)
  this.args.forEach(call_cb)
}


function Const(name, value) {
  this.name = name
  this.value = value
}


Const.prototype.type = 'const'


Const.prototype.forEachDependency = function(cb) {}