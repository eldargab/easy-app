'use strict'

var fnargs = require('parse-fn-args')
var cp = require('deepcopy')
var go = require('go-async')

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
    opts.args = opts.args || fnargs(fn)
    opts.fn = isGenerator(fn) ? go.fn(fn) : fn
  }
  this.defs[name] = opts
  return this
}

App.prototype.set = function(name, val) {
  this.defs[name] = {value: val}
  return this
}

App.prototype.level = function(name, seeds) {
  var level = {seeds: {}}
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

  var seeds = {}

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
      return app.defs[name] || seeds[name] ? add_namespace(ns, name) : name
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

App.prototype.run = function(main) {
  main = main || 'main'
  var opts = compile(this, main)
  var app = new RT('app', opts, opts.values)
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
    var val = this.values[key]
    if (val instanceof Future) return val.future.abort()
    var close = this.defs[key].close
    if (close) {
      if (typeof close == 'function') {
        close(val)
      } else {
        val.close()
      }
    }
  }, this)
}

RT.prototype.eval = function(name) {
  if (this.values[name] instanceof Error) throw this.values[name]
  if (this.values[name] !== undefined) return this.values[name]

  var def = this.defs[name]
  if (!def) throw new Error('Task ' + name + ' is not defined')

  var self = this

  if (def.eval) return function(task) {
    return go(function*() {
      var name = add_namespace(def.ns, task)
      return self.eval(name)
    })
  }

  if (def.main) return function(obj) {
    return go(function*() {
      var level = self.levels[def.level]
      var values = Object.create(self.values)

      for(var seed in level.seeds) {
        var val = obj[seed]
        if (val === undefined) throw new Error(seed + ' is required')
        values[add_namespace(level.ns, seed)] = val
      }

      var app = new RT(name, self, values)

      try {
        return (yield evaluate(app, name, def))
      } finally {
        app.close()
      }
    })
  }

  return evaluate(this, name, def)
}

function evaluate(app, name, def) {
  app = findLevel(app, def.level)

  if (!app) throw new Error(
    "Can't evaluate task " + name + " from level " + def.level +
    ", since " + def.level + " is not available"
  )

  return set(app, name, go(function*() {
    if (def.pre) {
      for(let x of def.pre) {
        yield app.eval(x)
      }
    }
    var deps = def.args || []
    var fn = def.fn || function noop() {}

    var args = new Array(deps.length)

    for(var i = 0; i < deps.length; i++) {
      args[i] = yield app.eval(deps[i])
    }

    var ret = yield fn.apply(null, args)
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
  var ret = new Future
  ret.future = f
  app.values[name] = ret
  f.get(function(err, val) {
    app.values[name] = err || val
    ret.done(err, val)
  })
  return ret
}

function Future() {
  this.ready = false
  this.aborted = false
}

Future.prototype.__proto__ = go.Future.prototype

Future.prototype.done = function(err, val) {
  if (this.aborted || this.ready) return
  this.ready = true
  this.error = err
  this.value = val
  var cbs = this.cbs
  if (!cbs) return
  this.cbs = null
  for(var i = 0; i < cbs.length; i++) {
    cbs[i](err, val)
  }
}

Future.prototype.get = function(cb) {
  if (this.ready) return cb(this.error, this.value)
  if (this.cbs) return this.cbs.push(cb)
  this.cbs = [cb]
}

Future.prototype.abort = function() {}

function compile(spec, main) {
  var defs = cp(spec.defs)
  var levels = cp(spec.levels)
  var app = {values: {}, defs: defs, levels: levels}

  // process predefined values
  for(let name in defs) {
    let def = defs[name]
    if (!('value' in def)) continue
    if (def.value === undefined)
      throw new Error(name +
        ' was set to undefined, but undefined values are not supported. Use null instead'
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
          seed + ' is used as a seed value for both ' + key +
          ' and ' + defs[seed].level
        )
      defs[seed] = {level: key, seed: true}
    }
  }

  var stack = ['app']

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
      var deps = dependencies(def)

      var depLevels = deps.map(function(dep) {
        return defs[dep]
      }).map(function(def, i) {
        var level = def.main ? def.mainLevel : def.level
        var idx = stack.indexOf(level)
        if (idx < 0)
          throw new Error(
            'Task ' + name + ' uses task ' + deps[i] +
            ' from level ' + level + ', but at the moment of call '+
            level + ' is not available'
          )
        return idx
      }).sort(function(a, b) {
        return b - a
      })

      var depLevelIdx = depLevels[0] || 0

      if (def.level) {
        let idx = stack.indexOf(def.level)
        if (idx < 0)
          throw new Error(
            'Task ' + name + ' was assigned to level ' + def.level +
            ', but at the moment of call ' + def.level + ' is not available'
          )
        if (idx < depLevelIdx)
          throw new Error(
            'Task ' + name + ' was assigned to level ' + def.level +
            ', but dependecies require existance of ' + stack[depLevelIdx]
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
    })

  return app
}

function traverse(defs, name, pre, post) {
  var visited = {}
  var stack = []

  ;(function visit(name, parent) {
    if (visited[name]) return

    if (stack.indexOf(name) >= 0)
      throw new Error('Cycle detected involving ' + stack.join(', '))

    if (name == 'eval' || /_eval$/.test(name)) {
      // special eval function requested
      // need to define corresponding task
      defs[name] = {eval: true, ns: namespace(name)}
    }

    var def = defs[name]

    if (!def) {
      if (parent) throw new Error('Task ' + name + ' is used by ' + parent + ', but not defined')
      throw new Error('Task ' + name + ' is not defined')
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
  var segs = name.split('_')
  segs.pop()
  return segs.join('_')
}

function isGenerator(fn) {
  return fn.constructor.name == 'GeneratorFunction';
}

function unique(arr) {
  var ret = []
  var pushed = {}
  for(var x of arr) {
    if (pushed[x]) continue
    pushed[x] = true
    ret.push(x)
  }
  return ret
}
