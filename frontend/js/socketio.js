words = angular.module('words');

words.factory(
  'Socketio', 
  [
    '$rootScope',
    function ($rootScope) {
      var self = {};
      self.socket = null;

      self.isConnected = function() {
        return self.socket.connected;
      };

      self.connect = function() {
        console.log('connecting to socketio');
        var options = {
          path: '/words/socket.io',
          query: {
            autoConnect: true
          }
        };
        self.socket = io('https://while.software', options);

        self.socket.on('connect', function() {
          console.log('connected to socketio');
          $rootScope.$broadcast('socketio_connect', '');
        });

        self.socket.on('disconnect', function() {
          console.log('disconnected from socketio');
          $rootScope.$broadcast('socketio_disconnect', '');
        });

        self.socket.open();
      };

      self.on = function (eventName, callback, targetobj) {
        self.socket.on(eventName, function () {  
          //console.log('rec: ' + eventName);
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(targetobj, args);
          });
        });
      };

      self.emit = function(name, data) {
        if (self.socket != null) {
          self.socket.emit(name, data, function () { /*console.log('ack'); */ });
        }else{
          // TODO: queue event for sending as soon as we get our connection back
        }
      };

      return self;
    }
  ]
);
