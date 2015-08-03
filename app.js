'use strict'

let fnargs = require('parse-fn-args')
let cp = require('utils-copy')
let go = require('go-async')

exports = module.exports = App

function App() {
  this.defs = {}
  this.levels = {}
}

App.prototype.def = function(name, opts, fn) {
  if (typeof opts == 'function') {
    fn = opts
    opts = {}
  }
  opts = cp(opts || {})
  if (fn) {
    opts.args = opts.args || fnargs(fn).map(function(arg) {
      if (!/\$$/.test(arg)) return arg
      arg = arg.slice(0, arg.length - 1)
      opts.lazy = opts.lazy || {}
      opts.lazy[arg] = true
      return arg
    })
    opts.fn = fn
  }
  this.defs[name] = opts
  return this
}

App.prototype.set = function(name, val) {
  this.defs[name] = {value: val}
  return this
}

App.prototype.level = function(name, seeds) {
  let level = {seeds: {}}
  seeds.forEach(function(seed) {
    level.seeds[seed] = true
  })
  this.levels[name] = level
  return this
}

App.prototype.install = function(ns, app) {
  if (arguments.length == 1) {
    app = ns
    ns = ''
  }

  let seeds = {}

  for(let key in app.levels) {
    let level = cp(app.levels[key])
    let level_ns = namespace(key)
    for(let seed in level.seeds) {
      seeds[add_namespace(level_ns, seed)] = true
    }
    this.levels[add_namespace(ns, key)] = level
  }

  function cpdeps(deps) {
    return deps.map(function(name) {
      return app.defs[name] || seeds[name] || 'evaluate' == remove_namespace(name)
        ? add_namespace(ns, name)
        : name
    })
  }

  for(let key in app.defs) {
    let def = cp(app.defs[key])
    if (def.uses) def.uses = cpdeps(def.uses)
    if (def.pre) def.pre = cpdeps(def.pre)
    if (def.args) def.args = cpdeps(def.args)
    if (def.level && app.levels[def.level]) def.level = add_namespace(ns, def.level)
    this.defs[add_namespace(ns, key)] = def
  }

  return this
}

App.prototype.copy = function() {
  var app = new this.constructor
  app.defs = cp(this.defs)
  app.levels = cp(this.levels)
  return app
}

App.prototype.run = function(main) {
  main = main || 'main'
  let opts = compile(this, main)
  let app = new RT('app', opts, opts.values)
  return go(function*() {
    try {
      return (yield app.eval(main))
    } finally {
      app.close()
    }
  })
}

function RT(level, parent, values) {
  this.level = level
  this.parent = parent
  this.defs = parent.defs
  this.levels = parent.levels
  this.values = values
}

RT.prototype.close = function() {
  Object.keys(this.values).forEach(function(key) {
    let val = this.values[key]
    if (val instanceof go.Future) return val.future.abort()
    let close = this.defs[key].close
    if (!close) return
    safecall(function() {
      if (typeof close == 'function') {
        close(val)
      } else {
        val.close()
      }
    })
  }, this)
}

RT.prototype.eval = function(name, fromTask, uses) {
  if (this.values[name] instanceof Error) throw this.values[name]
  if (this.values[name] !== undefined) return this.values[name]

  let def = this.defs[name]
  if (!def) throw new Error('Task `' + name + '` is not defined')

  let self = this

  if (def.eval && !fromTask)
    throw new Error('Evaluate function may be requested only as a non-lazy task argument')

  if (def.eval) return function*(task) {
    task = add_namespace(def.ns, task)
    if (!uses[task])
      throw new Error('Attempt to evaluate  `'
        + task + "` from `" + fromTask + "`, while `" + task + "` is not listed as used")
    return self.eval(task)
  }

  if (def.main) return function*(obj) {
    let level = self.levels[def.level]
    let values = Object.create(self.values)

    for(let seed in level.seeds) {
      let val = obj[seed]
      if (val === undefined) throw new Error('`' + seed + '` is required')
      values[add_namespace(level.ns, seed)] = val
    }

    let app = new RT(name, self, values)

    try {
      return (yield evaluate(app, name, def))
    } finally {
      app.close()
    }
  }

  return evaluate(this, name, def)
}

RT.prototype.lazyEval = function*(name) {
  return this.eval(name)
}

function evaluate(app, name, def) {
  app = findLevel(app, def.level)

  if (!app) throw new Error(
    "Can't evaluate task `" + name + "` from level `" + def.level +
    "`, since `" + def.level + "` is not available"
  )

  return set(app, name, go(function*() {
    if (def.pre) {
      for(let x of def.pre) {
        yield app.eval(x)
      }
    }
    let deps = def.args || []
    let fn = def.fn || function noop() {}

    let args = new Array(deps.length)

    for(let i = 0; i < deps.length; i++) {
      let dep = deps[i]
      args[i] = def.lazy && def.lazy[dep] ? app.lazyEval(dep) : (yield app.eval(dep, name, def.uses))
    }

    let ret = yield fn.apply(null, args)
    return ret == null ? null : ret
  }))
}

function findLevel(app, level) {
  if (!app) return
  if (app.level == level) return app
  return findLevel(app.parent, level)
}

function set(app, name, f) {
  if (f.ready) {
    app.values[name] = f.error || f.value
    if (f.error) throw f.error
    return f.value
  }
  let ret = new go.Future
  ret.future = f
  app.values[name] = ret
  f.get(function(err, val) {
    app.values[name] = err || val
    ret.done(err, val)
  })
  return ret
}

function compile(spec, main) {
  let defs = cp(spec.defs)
  let levels = cp(spec.levels)
  let app = {values: {}, defs: defs, levels: levels}

  // process predefined values
  for(let name in defs) {
    let def = defs[name]
    if (!('value' in def)) continue
    if (def.value === undefined)
      throw new Error('`' + name +
        '` was set to undefined, but undefined values are not supported. Use null instead'
      )
    app.values[name] = def.value
    def.level = 'app'
  }

  // process seeds & levels
  for(let key in levels) {
    let level = levels[key]
    let ns = namespace(key)

    level.ns = ns

    for(let seed in level.seeds) {
      seed = add_namespace(ns, seed)
      if (defs[seed] && defs[seed].seed)
        throw new Error(
          '`' + seed + '` is used as a seed value for both `' + key +
          '` and `' + defs[seed].level + '`'
        )
      defs[seed] = {level: key, seed: true}
    }
  }

  let stack = ['app']

  traverse(defs, main,
    function pre(name, def) {
      if (levels[name]) {
        // this is a main of level `name`
        stack.push(name)
        def.main = true
        def.level = name
      }
    },
    function post(name, def) {
      let deps = dependencies(def)

      let depLevels = deps.map(function(dep) {
        return defs[dep]
      }).map(function(def, i) {
        let level = def.main ? def.mainLevel : def.level
        let idx = stack.indexOf(level)
        if (idx < 0)
          throw new Error(
            'Task `' + name + '` uses task `' + deps[i] +
            '` from level `' + level + '`, but at the moment of call `' +
            level + '` is not available'
          )
        return idx
      }).sort(function(a, b) {
        return b - a
      })

      let depLevelIdx = depLevels[0] || 0

      if (def.level) {
        let idx = stack.indexOf(def.level)
        if (idx < 0)
          throw new Error(
            'Task `' + name + '` was assigned to level `' + def.level +
            '`, but at the moment of call `' + def.level + '` is not available'
          )
        if (idx < depLevelIdx)
          throw new Error(
            'Task `' + name + '` was assigned to level `' + def.level +
            '`, but dependecies require existance of `' + stack[depLevelIdx] + '`'
          )
      } else {
        def.level = stack[depLevelIdx]
      }

      if (levels[name]) {
        def.mainLevel = stack[depLevelIdx] == name
          ? stack[unique(depLevels)[1] || 0]
          : stack[depLevelIdx]

        stack.pop()
      }

      def.uses = toSet(def.uses || [])
    })

  return app
}

function traverse(defs, name, pre, post) {
  let visited = {}
  let stack = []

  ;(function visit(name, parent) {
    if (visited[name]) return

    if (stack.indexOf(name) >= 0)
      throw new Error('Cycle detected involving ' + stack.join(', '))

    if ('evaluate' == remove_namespace(name)) {
      // special eval function requested
      // need to define corresponding task
      defs[name] = {eval: true, ns: namespace(name)}
    }

    let def = defs[name]

    if (!def) {
      if (parent) throw new Error('Task `' + name + '` is used by `' + parent + '`, but not defined')
      throw new Error('Task `' + name + '` is not defined')
    }

    pre && pre(name, def)

    dependencies(def).forEach(function(dep) {
      visit(dep, name)
    })

    post && post(name, def)

    visited[name] = true
  })(name)
}

function dependencies(def) {
  return (def.uses || []).concat(def.pre || []).concat(def.args || [])
}

function add_namespace(ns, name) {
  if (!ns) return name
  return ns + '_' + name
}

function namespace(name) {
  let segs = name.split('_')
  segs.pop()
  return segs.join('_')
}

function remove_namespace(name) {
  return name.split('_').pop()
}

function isGenerator(fn) {
  return fn.constructor.name == 'GeneratorFunction';
}

function unique(arr) {
  let ret = []
  let pushed = {}
  for(let x of arr) {
    if (pushed[x]) continue
    pushed[x] = true
    ret.push(x)
  }
  return ret
}

function toSet(arr) {
  let ret = {}
  for(let x of arr) {
    ret[x] = true
  }
  return ret
}

function safecall(cb, err, val) {
  try {
    cb(err, val)
  } catch(e) {
    process.nextTick(function() {
      throw e
    })
  }
}
