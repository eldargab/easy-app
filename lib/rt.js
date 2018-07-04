const go = require('go-async')


const NOT_READY = new Error('NOT READY')


exports.toError = go.toError


exports.Future = go.Future


exports.throwNotReady = function(wait) {
  NOT_READY.wait = wait
  throw NOT_READY
}


exports.poll = poll


function poll(future, self, getter) {
  try {
    future.done(null, getter.call(self))
  } catch(e) {
    if (e === NOT_READY) {
      handleNotReady(future, self, getter)
    } else {
      future.done(go.toError(e))
    }
  }
}


function handleNotReady(future, self, getter) {
  let wait = NOT_READY.wait
  NOT_READY.wait = null
  wait.get(function() {
    if (future.aborted) return
    poll(future, self, getter)
  })
}


exports.closeAsync = function(self, future) {
  future.onabort = function() {
    if (self.waits) {
      for (let i = 0; i < self.waits.length; i++) {
        self.waits[i].abort()
      }
    }
    self.close()
  }

  future.get(function() {
    future.onabort = null
    self.close()
  })
}


exports.regFuture = function(self, future) {
  if (self.waits) {
    self.waits.push(future)
  } else {
    self.waits = [future]
  }
}


exports.unregFuture = function(self, future) {
  let idx = self.waits.indexOf(future)
  if (idx < 0) throw new Error('Attempt to unregister unregistered future')
  self.waits.splice(idx, 1)
}


exports.getEval = function getEval(self, forName) {
  let uses = self['_uses_' + forName]

  return function evaluate(name) {
    let actualName = uses[name]
    if (!actualName) throw new Error(`'${name}' is not declared as used from '${forName}'`)
    let getter = self['_get_' + actualName]
    let future = new go.Future
    poll(future, self, getter)
    return future
  }
}


exports.getLazy = function getLazy(self, getter) {
  return function() {
    let future = new go.Future
    poll(future, self, getter)
    return future
  }
}


exports.safecall = function(fn, arg) {
  try {
    fn(arg)
  } catch(e) {
    throwLater(e)
  }
}


function throwLater(e) {
  tick(function() {
    throw e
  })
}


function tick(f) {
  if (process && process.nextTick) {
    process.nextTick(f)
  } else {
    setTimeout(f)
  }
}
