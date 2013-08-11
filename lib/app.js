var parseFnArgs = require('parse-fn-args')
var util = require('./util')
var forEachProp = util.forEachProp
var nsconcat = util.nsconcat
var Promise = util.Promise

module.exports = App

function App() {}

/*
 * Call a plugin function to setup current container instance
 *
 * Examples:
 *    app.use(plugin, 'a', 'b') // plugin.call(app, app, 'a', 'b')
 *
 *  @api public
 */

App.prototype.use = function(plugin) {
  var fn = plugin
  arguments[0] = this
  fn.apply(this, arguments)
  return this
}

/**
 * Dictionary for storing task evaluation results
 *
 * @api private
 */

App.prototype.values = {__owner: App.prototype}

/**
 * Create/get `.values` for the current instance (layer)
 *
 * @api private
 */

App.prototype.thisValues = function() {
  if (this.values.__owner === this) return this.values
  return this.values = {
    __proto__: this.__proto__.thisValues(),
    __owner: this
  }
}

/**
 * Dictionary for storing promises for pending evaluations
 *
 * @api private
 */

App.prototype.promises = {__owner: App.prototype}

/**
 * Create/get `.promises` for the current instance (layer)
 *
 * @api private
 */

App.prototype.thisPromises = function() {
  if (this.promises.__owner === this) return this.promises
  return this.promises = {
    __proto__: this.__proto__.thisPromises(),
    __owner: this
  }
}

/**
 * Dictionary for storing task definitions
 *
 * @api private
 */

App.prototype.tasks = {__owner: App.prototype}

/**
 * Create/get `.tasks` for the current instance (layer)
 *
 * @api private
 */

App.prototype.thisTasks = function() {
  if (this.tasks.__owner === this) return this.tasks
  return this.tasks = {
    __proto__: this.__proto__.thisTasks(),
    __owner: this
  }
}

/**
 * Dictionary for storing aliases
 *
 * @api private
 */

App.prototype.aliases = {__owner: App.prototype}

/**
 * Create/get `.aliases` for the current instance (layer)
 *
 * @api private
 */

App.prototype.thisAliases = function() {
  if (this.aliases.__owner === this) return this.aliases
  return this.aliases = {
    __proto__: this.__proto__.thisAliases(),
    __owner: this
  }
}

/**
 * A set for storing import declarations
 *
 * @api private
 */

App.prototype._imports = {__owner: App.prototype}

/**
 * Create/get `._imports` for the current instance
 *
 * @api private
 */

App.prototype.thisImports = function() {
  if (this._imports.__owner === this) return this._imports
  return this._imports = {
    __proto__: this.__proto__.thisImports(),
    __owner: this
  }
}

/**
 * Declare missing tasks
 *
 * Examples:
 *    app.importing('foo')
 *    app.importing(['foo', 'bar'], 'baz')
 *
 * @api public
 */

App.prototype.importing = function() {
  var imports = [].concat.apply([], [].slice.call(arguments))
  for (var i = 0; i < imports.length; i++) {
    this.thisImports()[imports[i]] = true
  }
  return this
}

/**
 * Checks whether the app imports the given `task`
 * or returns a list of app imports
 *
 * Examples:
 *    app.importing('foo', 'bar')
 *    app.imports('foo') //=> true
 *    app.imports() //=> ['foo', 'bar']
 *
 *  @api public
 */

App.prototype.imports = function(task) {
  if (arguments.length == 1)
    return !!this._imports[task]

  var ret = []
  forEachProp(this._imports, function (imp) {
    ret.push(imp)
  })
  return ret
}

/**
 * Checks whether the given task is defined
 *
 * @param {String} Task name
 * @return {Boolean}
 * @api public
 */

App.prototype.defined = function(task) {
  return this.values[task] !== undefined
    || !!this.tasks[task]
    || !!this.aliases[task]
}

/**
 * Deletes definition of the given task
 *
 * @param {String} Task name
 * @return {App} this
 * @api public
 */

App.prototype.undefine = function(task) {
  this.thisValues()[task] = undefined
  this.thisTasks()[task] = undefined
  this.thisAliases()[task] = undefined
}

/**
 * Sets a value (evaluation result) for the given task
 *
 * @param {String} Task name
 * @param {Mixed} Value
 * @return {App} this
 * @api public
 */

App.prototype.set = function(name, val) {
  this.thisValues()[name] = val
  return this
}

/**
 * Gets a value of the given task (if available)
 *
 * @param {String} Task name
 * @return {Mixed} Value
 * @api public
 */

App.prototype.get = function(name) {
  var val = this.values[name]
  if (val !== undefined) return val
  if (this.aliases[name]) return this.get(this.aliases[name])
}

/**
 * Create an alias for a task
 *
 * @param {String} from
 * @param {String} to
 * @return {App} this
 * @api public
 */

App.prototype.alias = function(from, to) {
  this.undefine(from)
  this.thisAliases()[from] = to
  return this
}

/**
 * Define a task.
 *
 * Signature:
 *    app.def([layer], task, [deps], fn)
 *
 * @param {String} layer
 * @param {String} Task name
 * @param {Array} Optional list of dependencies. If not given will be inferred.
 * @param {Function} fn
 * @return {App} this
 * @api public
 */

App.prototype.def = function(layer, task, deps, fn) {
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
    layer: layer || this._at_layer
  })

  return this
}

App.prototype._def = function(t) {
  this.ontask(t)
  this.undefine(t.name)
  this.thisTasks()[t.name] = t
}

/**
 * Hook method. Will be called before task creation.
 *
 * @api public, but not yet released (task structure is going to change)
 */

App.prototype.ontask = function(t) {

}

/**
 * Mass layer assignment
 *
 * Examples:
 *    app.at('app', function() {
 *      app.def('foo', foo)
 *    })
 *
 *    //Equivalent to
 *
 *    app.def('app', 'foo', foo)
 *
 * @api public
 */

App.prototype.at = function(layer, fn) {
  var prev = this._at_layer
  this._at_layer = layer
  try {
    fn.call(this, this)
  } finally {
    this._at_layer = prev
  }
  return this
}

/**
 * Install tasks from the `app` at namespace `ns` and setup `aliases`.
 *
 * Signature:
 *    app.install([ns], app, [aliases])
 *
 * Examples:
 *
 *    var subapp = App()
 *      .set('foo', 'foo')
 *      .def('bar', ['qux'], bar)
 *
 *    app.install('sub', subapp, {
 *      'qux': 'QUX'
 *    })
 *
 *    // Is equivalent to
 *
 *    app.set('sub_foo', 'foo')
 *    app.def('sub_bar', ['sub_qux'], bar)
 *    app.alias('sub_qux', 'QUX')
 *
 * @api public
 */

App.prototype.install = function(ns, app, aliases) {
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
    // autoalias missing tasks
    app.imports().forEach(function(imp) {
      var from = nsconcat(ns, imp)
      if (!self.defined(from)) self.alias(from, imp)
    })
  }

  return this
}

/**
 * Hook method. Will be called after subapp installation
 * but before auto-aliasing
 *
 * @api public
 */
App.prototype.onsubapp = function(ns, app) {

}

/**
 * Assign a name to the current layer
 *
 * @param {String} name
 * @api public
 */

App.prototype.layer = function(name) {
  this._layer = name
  return this
}

/**
 * Create next level instance
 *
 * @api public
 */

App.prototype.run = function() {
  return { __proto__: this }
}

/**
 * Eval the given `task`
 *
 * @param {String} Task name
 * @param {Function} callback
 * @api public
 */

App.prototype.eval = function(task, cb) {
  cb = cb || noop

  var val = this.values[task]
  if (val !== undefined) {
    val instanceof Error
      ? cb(val)
      : cb(null, val)
    return
  }

  var alias = this.aliases[task]
  if (alias) {
    var self = this
    this.eval(alias, function(err, val) {
      self.thisTasks()[task] = err || val
      cb(err, val)
    })
    return
  }

  var promise = this.promises[task]
  if (promise) return promise.ondone(cb)

  var t = this.tasks[task]
  if (!t) return cb(new Error('Task ' + task + ' is not defined'))

  evaluate(this, t, cb)
}

function evaluate(app, t, cb) {
  if (t.layer) app = find(app, t.layer)

  var done = false
    , promise
    , name = t.name

  function ondone(err, val) {
    if (done) return printDoubleCallbackWarning(name, err)
    done = true

    if (err != null) {
      if (!(err instanceof Error)) {
        var orig = err
        err = new Error('None error object was throwed: ' + orig)
        err.orig = orig
      }
      if (val != '__DEP__') {
        err._task = name
        err._layer = app._layer
      }
      val = err
    }

    if (val === undefined) val = null

    app.thisValues()[name] = val

    cb(err, val)

    if (promise) {
      promise.resolve(err, val)
      app.promises[name] = null // cleanup
    }
  }

  evalWithDeps(app, t, new Array(t.deps.length), 0, ondone)

  if (!done) {
    app.thisPromises()[name] = promise = new Promise
  }
}

function find(app, layer) {
  var top = app
  while (app._layer && (app._layer != layer || !app.hasOwnProperty('_layer'))) {
    app = app.__proto__
  }
  return app._layer == layer ? app : top
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
      deps[i] = createEval(t.namespace, app)
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
      evalWithDeps(app, t, deps, i + 1, ondone)
    })
    sync = done
    if (!sync) return
  }
  exec(app, t, deps, ondone)
}

function createEval(ns, app) {
  return function(task, cb) {
    task = nsconcat(ns, task)
    app.eval(task, function(err, val) {
      if (err) val = '__DEP__'
      cb && cb(err, val)
    })
  }
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

function noop() {}
