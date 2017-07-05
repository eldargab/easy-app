const fnargs = require('parse-fn-args')
const clone = require('lodash.clonedeep')
//const go = require('go-async')
const analyze = require('./ana')
const generate = require('./gen')


exports = module.exports = App


function App() {
  this.defs = {}
}


App.prototype.set = function(name, value) {
  this.defs[name] = {value: value}
}


App.prototype.def = function(name, opts, fn) {
  if (name == 'evaluate') throw new Error('`evaluate` is a reserved name')
  if (name[0] == '_') throw new Error("Task name can't start with underscore")

  if (typeof opts == 'function') {
    fn = opts
    opts = {}
  }

  opts = clone(opts || {})
  opts.fn = opts.fn || fn || function noop() {}
  opts.args = opts.args || fnargs(opts.fn)

  this.defs[name] = opts

  return this
}


App.prototype.level = function(name, main, seeds) {
  this.defs[name] = {
    main: main,
    seeds: seeds || []
  }
  return this
}


App.prototype.install = function(ns, app) {
  if (arguments.length == 1) {
    app = ns
    ns = ''
  }

  function rename_dep(name) {
    return app.defs[name] ? add_namespace(name) : name
  }

  for(let key in app.defs) {
    let def = clone(app.defs[key])

    if (def.uses) def.uses = def.uses.map(rename_dep)
    if (def.pre) def.pre = def.pre.map(rename_dep)
    if (def.args) def.args = def.args.map(rename_dep)
    if (def.main) def.main = rename_dep(def.main)
    if (def.seeds) def.seeds = def.seeds.map(rename_dep)

    this.defs[add_namespace(ns, key)] = def
  }

  return this
}


function add_namespace(ns, name) {
  if (!ns) return name
  return ns + '_' + name
}


App.prototype.copy = function() {
  return clone(this)
}


App.prototype.compile = function(main) {
  let app = analyze(this.defs, main)
  let js = generate(app)
  let fn = new Function("_toError", "_defs", js)
  return fn(app.defs)
}


App.prototype.toJS = function(main) {
  let app = analyze(this.defs, main)
  return generate(app)
}
