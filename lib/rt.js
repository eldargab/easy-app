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
    poll(future, self, getter)
  })
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
