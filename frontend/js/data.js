var words = angular.module('words');

words.factory(
  'Data',
  [
    '$rootScope',
    '$timeout',
    '$window',
    'Audio',
    function($rootScope, $timeout, $window, Audio) {
      var self = {};

      self.Stroke = function(sid) {
        this.id = sid;
        this.samples = [];
        this.complete = false;
        this.start_time = null;
        this.end_time = null;
        this.color = 0;
        this.is_final = false;
      };

      self.Sample = function (x,y,z,t,p) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = t;
        this.p = p;
      };

      self.Vector3 = function(x,y,z) {
        this.x = x;
        this.y = y;
        this.z = z;
      };

      return self;

    } 
  ]
);
