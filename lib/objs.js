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
  this.lazy = opts.lazy || {}
  this.args = opts.args || []
  this.pre = opts.pre || []

  this.uses = (opts.uses || []).reduce(function(uses, name) {
    if (name.indexOf(' ') >= 0) {
      let [ns, n] = name.split(' ')
      uses[n] = ns + '_' + n
    } else {
      uses[name] = name
    }
    return uses
  }, {})
}


Fn.prototype.type = 'fn'


Fn.prototype.forEachDependency = function(cb) {
  let call_cb = unique(cb)
  forOwn(this.uses, (mapping, name) => call_cb(mapping))
  this.pre.forEach(call_cb)
  this.args.forEach(call_cb)
}


function unique(cb) {
  let seen = {}
  return function(i) {
    if (seen[i]) return
    seen[i] = true
    cb(i)
  }
}


Fn.prototype.forEachPre = function(cb) {
  this.pre.forEach(unique(cb))
}


Fn.prototype.forEachArgument = function(cb) {
  this.args.forEach(unique(cb))
}


function Const(name, value) {
  this.name = name
  this.value = value
}


Const.prototype.type = 'const'


Const.prototype.forEachDependency = function(cb) {}