var toError = require('go-async').toError
var notReady = new Error('NOT READY')


exports.throwNotReady = function(wait) {
  notReady.wait = wait
  throw notReady
}


exports.poll = poll


function poll(future) {
  try {
    future.done(null, this.get_main())
  } catch(e) {
    if (e === notReady) {
      handleNotReady(future, this)
    } else {
      future.done(toError(e))
    }
  }
}


function handleNotReady(future, self) {
  var wait = notReady.wait
  notReady.wait = null
  wait.get(function() {
    self.poll(future)
  })
}