var parseFnArgs = require('parse-fn-args')
var Emitter = require('hooks-emitter')

exports = module.exports = Container

function Container() {
  if (!(this instanceof Container)) {
    return new Container
  }
}

Emitter(Container.prototype)

Container.prototype.use = function(plugin) {
  var fn = plugin
  arguments[0] = this
  fn.apply(this, arguments)
  return this
}

function defThis(name, obj) {
  obj[name] = {__owner: obj}
  obj['this' + name[0].toUpperCase() + name.slice(1)] = function thisObj() {
    if (this[name].__owner === this) return this[name]
    this[name] = {__proto__: thisObj.call(this.__proto__)}
    this[name].__owner = this
    return this[name]
  }
}

defThis('values', Container.prototype)
defThis('tasks', Container.prototype)
defThis('aliases', Container.prototype)
defThis('_imports', Container.prototype)

Container.prototype.importing = function() {
  var imports = [].concat.apply([], [].slice.call(arguments))
  for (var i = 0; i < imports.length; i++) {
    this.this_imports()[imports[i]] = true
  }
  return this
}

Container.prototype.imports = function(task) {
  if (arguments.length == 1)
    return !!this._imports[task]

  var ret = []
  forEachProp(this._imports, function (imp) {
    ret.push(imp)
  })
  return ret
}

Container.prototype.defined = function(task) {
  return this.values[task] !== undefined
    || !!this.tasks[task]
    || !!this.aliases[task]
}

Container.prototype.undefine = function(task) {
  this.thisValues()[task] = undefined
  this.thisTasks()[task] = undefined
  this.thisAliases()[task] = undefined
}

Container.prototype.set = function(name, val) {
  this.thisValues()[name] = val
  return this
}

Container.prototype.get = function(name) {
  var val = this.values[name]
  if (val !== undefined) return val
  if (this.aliases[name]) return this.get(this.aliases[name])
}

Container.prototype.alias = function(from, to) {
  this.undefine(from)
  this.thisAliases()[from] = to
  return this
}

Container.prototype.def = function(layer, task, deps, fn) {
  if (typeof task != 'string') { // allow layer omission
    fn = deps
    deps = task
    task = layer
    layer = null
  }

  if (typeof deps == 'function') { // allow implicit deps
    fn = deps
    deps = fn.deps || parseFnArgs(fn)
  }

  this._def({
    name: task,
    namespace: '',
    fn: fn,
    deps: deps,
    sync: !~deps.indexOf('done'),
    layer: layer || this._layer
  })

  return this
}

Container.prototype._def = function(t) {
  this.undefine(t.name)
  this.ontask(t)
  this.thisTasks()[t.name] = t
}

Container.prototype.ontask = function(t) {

}

Container.prototype.at = function(layer, fn) {
  var prev = this._layer
  this._layer = layer
  try {
    fn.call(this, this)
  } finally {
    this._layer = prev
  }
  return this
}

Container.prototype.install = function(ns, app, aliases) {
  if (typeof ns == 'object' && ns) {
    aliases = app
    app = ns
    ns = ''
  }

  var self = this

  forEachProp(app.values, function(name, val) {
    self.set(nsconcat(ns, name), val)
  })

  forEachProp(app.tasks, function(name, t) {
    self._def({
      name: nsconcat(ns, name),
      namespace: nsconcat(ns, t.namespace),
      fn: t.fn,
      sync: t.sync,
      layer: t.layer,
      deps: t.deps.map(function(dep) {
        if (dep == 'done') return 'done'
        if (dep == 'eval') return 'eval'
        return nsconcat(ns, dep)
      })
    })
  })

  forEachProp(app.aliases, function(from, to) {
    from = nsconcat(ns, from)
    to = nsconcat(ns, to)
    self.alias(from, to)
  })

  forEachProp(aliases, function(from, to) {
    self.alias(nsconcat(ns, from), to)
  })

  this.onsubapp(ns, app)

  if (ns) {
    app.imports().forEach(function(imp) {
      var from = nsconcat(ns, imp)
      if (!self.defined(from)) self.alias(from, imp)
    })
  }

  return this
}

Container.prototype.onsubapp = function(ns, app) {

}

Container.prototype.layer = function(name) {
  this.name = name
  return this
}

Container.prototype.run = function() {
  return {__proto__: this}
}

Container.prototype.eval = function(task, cb) {
  cb = cb || noop

  var val = this.values[task]
  if (val !== undefined) {
    val instanceof Error
      ? cb(val)
      : cb(null, val)
    return
  }

  if (this.aliases[task]) {
    var self = this
    this.eval(this.aliases[task], function(err, val) {
      self.thisTasks()[task] = err || val
      cb(err, val)
    })
    return
  }

  var ondone = this['_ondone_' + task]
  if (ondone) return ondone(cb)

  var t = this.tasks[task]
  if (!t) return cb(new Error('Task ' + task + ' is not defined'))

  evaluate(this, t, cb)
}

function evaluate(app, t, cb) {
  if (t.layer) app = find(app, t.layer)

  var done = false
    , callbacks
    , name = t.name

  function ondone(err, val) {
    if (done) return printDoubleCallbackWarning(name, err)
    done = true
    if (err != null) {
      if (!(err instanceof Error)) {
        var orig = err
        err = new Error('None error object was throwed')
        err.orig = orig
      }
      if (val != '__DEP__') {
        err._task = name
        err._layer = app.name
      }
      val = err
    }
    if (val === undefined) val = null
    app.thisValues()[name] = val
    app['_ondone_' + name] = null // cleanup
    cb(err, val)
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i](err, val)
      }
    }
  }

  evalWithDeps(app, t, new Array(t.deps.length), 0, ondone)

  if (!done) {
    app['_ondone_' + name] = function(fn) {
      (callbacks || (callbacks = [])).push(fn)
    }
  }
}

function find(app, layer) {
  var top = app
  while (app.name && (app.name != layer || !app.hasOwnProperty('name'))) {
    app = app.__proto__
  }
  return app.name == layer ? app : top
}

function evalWithDeps(app, t, deps, start, ondone) {
  var sync = true
  for (var i = start; i < t.deps.length; i++) {
    var dep = t.deps[i]

    if (dep == 'done') {
      deps[i] = ondone
      continue
    }

    if (dep == 'eval') {
      deps[i] = function(task, fn) {
        fn = fn || noop
        task = nsconcat(t.namespace, task)
        app.eval(task, function(err, val) {
          if (err) val = '__DEP__'
          fn(err, val)
        })
      }
      continue
    }

    var val = app.values[dep]
    if (val !== undefined) {
      if (val instanceof Error) return ondone(val, '__DEP__')
      deps[i] = val
      continue
    }

    var done = false

    app.eval(dep, function(err, val) {
      if (err) return ondone(err, '__DEP__')
      done = true
      deps[i] = val
      if (sync) return
      evalWithDeps(app, t, deps, i, ondone)
    })
    sync = done
    if (!sync) return
  }
  exec(app, t, deps, ondone)
}

function exec(app, t, deps, ondone) {
  var ret
  try {
    ret = t.fn.apply(app, deps)
  } catch (e) {
    ondone(e)
    return
  }
  if (t.sync) ondone(null, ret)
}

function printDoubleCallbackWarning(task, err) {
  var msg = 'Callback for the task `' + task + '` was called two times'
  if (err) {
    msg += '\n'
    msg += 'Perhaps it is happened due to exception in an eval callback'
    msg += '\n' + String(err)
  }
  console.error(msg)
}

function forEachProp(obj, cb) {
  for (var key in obj) {
    if (key == '__owner') continue
    if (obj[key] === undefined) continue
    cb(key, obj[key])
  }
}

function noop() {}

function nsconcat(ns, task) {
  if (!ns) return task
  if (!task) return ns
  return ns + '_' + task
}

function nssuffix(ns, task) {
  if (!ns) return task
  if (!task) return task
  if (task.indexOf(ns + '_') != 0) return task
  return task.slice(ns.length + 1)
}

exports.nsconcat = nsconcat

exports.nssuffix = nssuffix
