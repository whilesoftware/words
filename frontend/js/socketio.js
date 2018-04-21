words = angular.module('words');

words.factory(
  'socketio', 
  [
    '$rootScope',
    'auth',
    'BASEHREF', 
    function ($rootScope, auth, BASEHREF) {
      var self = {};
      self._socket = null;

      self.isConnected = function() {
        return self._socket.connected;
      };

      self.disconnect = function() {
        if (self._socket != null) {
          self._socket.emit('end');
          console.log('1st level disconnect');
          self._socket.disconnect();
          self._socket.close();
          if (self._socket.socket) {
            console.log('2nd level disconnect');
            self._socket.socket.disconnect();
          }
          self._socket = null;
        }
      };

      self.connect = function() {
        console.log('connecting to socketio');
        var options = {
          path: '/words/' + 'socket.io',
          query: {
            autoConnect: false,
            isdashboard: true,
            token: auth.getToken()
          }
        };
        self._socket = io('https://while.software', options);

        self._socket.on('connect', function() {
          console.log('connected to socketio');
          $rootScope.$broadcast('socketio_connect', '');
        });

        self._socket.on('disconnect', function() {
          console.log('disconnected from socketio');
          $rootScope.$broadcast('socketio_disconnect', '');
        });

        self._socket.open();
      };

      self.on = function (eventName, callback, targetobj) {
        self._socket.on(eventName, function () {  
          //console.log('rec: ' + eventName);
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(targetobj, args);
          });
        });
      };

      self.emit = function(name, data) {
        if (self._socket != null) {
          self._socket.emit(name, data, function () { console.log('ack')});
        }else{
          // TODO: queue event for sending as soon as we get our connection back
        }
      };

      return self;
    }
  ]
);
