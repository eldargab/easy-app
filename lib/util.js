
/**
 * Prefix a given `task` with `ns`
 *
 * Examples:
 *    nsconcat('hello', 'world') //=> 'hello_world'
 *    nsconcat('', 'world') //=> 'world'
 *
 * @api public
 */

exports.nsconcat = function(ns, task) {
  if (!ns) return task
  if (!task) return ns
  return ns + '_' + task
}

/**
 * Extract the suffix
 *
 * Examples:
 *    nssuffix('hello', 'hello_world') //=> 'world'
 *    nssuffix('foo', 'hello_world') //=> null
 *
 * @api public
 */

exports.nssuffix = function(ns, task) {
  if (!ns) return task
  if (!task) return task
  if (task.indexOf(ns + '_') != 0) return null
  return task.slice(ns.length + 1)
}

/**
 * Iterate over hashset entries
 *
 * @api private
 */

exports.forEachProp = function (obj, cb) {
  for (var key in obj) {
    if (key == '__owner') continue
    if (obj[key] === undefined) continue
    cb(key, obj[key])
  }
}

/**
 * @api private
 */

exports.Promise = Promise

function Promise() {}

Promise.prototype.ondone = function(cb) {
  this.callbacks = this.callbacks || []
  this.callbacks.push(cb)
}

Promise.prototype.resolve = function(err, val) {
  if (!this.callbacks) return
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i](err, val)
  }
}
