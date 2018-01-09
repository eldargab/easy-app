var toError = require('go-async').toError
var notReady = new Error('NOT READY')


exports.throwNotReady = function(wait) {
  notReady.wait = wait
  throw notReady
}


exports.poll = poll


function poll(future, self, getter) {
  try {
    future.done(null, getter ? getter.call(self) : self.get_main())
  } catch(e) {
    if (e === notReady) {
      handleNotReady(future, self, getter)
    } else {
      future.done(toError(e))
    }
  }
}


function handleNotReady(future, self, getter) {
  var wait = notReady.wait
  notReady.wait = null
  wait.get(function() {
    poll(future, self, getter)
  })
}
