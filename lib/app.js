const parseArguments = require('parse-fn-args')
const clone = require('lodash.clonedeep')
const isVarName = require('is-var-name')
const analyze = require('./ana')
const generate = require('./gen')
const rt = require('./rt')


exports = module.exports = App


function App() {
  this.defs = {}
}


App.prototype.set = function(name, value) {
  checkName(name)
  this.defs[name] = {value: value}
}


function checkName(name) {
  if (!isVarName(name)) throw new Error(`Bad name '${name}'. It's not a valid javascript identifier`)
  if (name == 'evaluate') throw new Error("Name 'evaluate' is reserved")
  if (name[0] == '_') throw new Error(`Bad name '${name}'. Names begining with underscore are reserved`)
  if (name[name.length - 1] == '$') throw new Error(
    `Bad name '${name}'. Names ending with underscore are reserved for lazy arguments`
  )
}


App.prototype.def = function(name, opts, fn) {
  checkName(name)

  if (typeof opts == 'function') {
    fn = opts
    opts = {}
  }

  if (Array.isArray(opts)) {
    opts = {args: opts}
  }

  opts = clone(opts || {})
  opts.fn = opts.fn || fn || function noop() {}
  opts.lazy = opts.lazy || {}

  opts.args = (opts.args || parseArguments(opts.fn)).map(function(arg) {
    if (arg[arg.length - 1] == '$') {
      arg = arg.slice(0, arg.length - 1)
      opts.lazy[arg] = true
    }
    return arg
  })

  this.defs[name] = opts
}


App.prototype.level = function(name, main, seeds) {
  checkName(name)

  this.defs[name] = {
    main: main,
    seeds: seeds || []
  }
}


App.prototype.install = function(ns, app) {
  if (arguments.length == 1) {
    app = ns
    ns = ''
  }

  let rename_dep = name => {
    let newName = add_namespace(ns, name)
    return app.defs[name] || this.defs[newName] ? newName : name
  }

  for (let key in app.defs) {
    let def = clone(app.defs[key])

    if (def.pre) def.pre = def.pre.map(rename_dep)
    if (def.args) def.args = def.args.map(rename_dep)

    if (def.uses) def.uses = def.uses.map(n => {
      if (n.indexOf(' ') >= 0) return add_namespace(ns, n)
      if (rename_dep(n) == n) return n
      return ns + ' ' + n
    })

    if (def.main) def.main = add_namespace(ns, def.main)
    if (def.seeds) def.seeds = def.seeds.map(n => add_namespace(ns, n))

    this.defs[add_namespace(ns, key)] = def
  }
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
  let fn = new Function('rt', 'defs', js)
  return fn(rt, app.defs)
}


App.prototype.run = function(main) {
  return this.compile(main)()
}


App.prototype.printJS = function(main) {
  let app = analyze(this.defs, main)
  let js = generate(app)
  console.log(js)
}
