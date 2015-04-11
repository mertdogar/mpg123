var spawn = require('child_process').spawn
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var es = require('event-stream')
var through = require('through')

inherits(MpgPlayer, EventEmitter)

module.exports = MpgPlayer

function MpgPlayer() {
  var self = this;
  this.child = spawn('mpg123', ['-R']);
  this.child.stderr.on('data', function(data) {
    //console.log('Err: ' + data);
  });
  this.stream = this.child.stdin,
    this.child.stdout
    .pipe(es.split())
    .pipe(through(function(data) {
      var line = data.split(' ')
      var type = line.shift()

      if ('@P' === type) {
        var event = ['end', 'pause', 'resume', 'stop'][+line.shift()]

        if (self.waitCallback) {
          self.waitCallback(self.waitState.indexOf(event) < 0);
          delete self.waitCallback;
        }
        self.emit(event);
      } else if ('@E' == type) {
        var err = new Error(line.join(' '))
        err.type = 'mpg-player'

        if (self.waitCallback) {
          self.waitCallback(err);
          delete self.waitCallback;
        }
        self.emit('error', err)
      } else if ('@F' == type) {
        line.unshift('frame')
        self.emit.apply(self, line)
      }

    }))

}

var p = MpgPlayer.prototype

p._expect = function(state, cb) {
  this.waitCallback = cb;
  this.waitState = state;
}

p._cmd = function() {
  var args = [].slice.call(arguments)
  this.stream.write(args.join(' ') + '\n')
  return this
}

p.play = function(file, cb) {
  if (this.waitCallback) return cb(true);
  this._cmd('LOAD', file);
  this._expect(['resume'], cb);
}
p.pause = function(cb) {
  if (this.waitCallback) return cb(true);
  this._cmd('PAUSE')
  this._expect(['pause', 'play'], cb);
}
p.stop = function(cb) {
  if (this.waitCallback) return cb(true);
  this._cmd('STOP')
  this._expect(['stop'], cb);
}
p.gain = function(vol) {
  if (this.waitCallback) return;
  vol = Math.min(Math.max(Math.round(vol), 0), 100)
  return this._cmd('VOLUME', vol)
}

p.close = function() {
  this.child.kill()
}


if (!module.parent) {
  new MpgPlayer()
    .play(process.argv[2])
}
