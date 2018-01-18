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
    future.done(null, getter ? getter.call(self) : self.get_main())
  } catch(e) {
    if (e === NOT_READY) {
      handleNotReady(future, self, getter)
    } else {
      future.done(go.toError(e))
    }
  }
}


function handleNotReady(future, self, getter) {
  var wait = NOT_READY.wait
  NOT_READY.wait = null
  wait.get(function() {
    poll(future, self, getter)
  })
}
