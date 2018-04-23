var words = angular.module('words');

words.factory(
  'Audio',
  [
    '$rootScope',
    '$timeout',
    '$window',
    function($rootScope, $timeout, $window) {
      var self = {};

      self.loop = null;
      self.snap = null;
      self.samples = [];

      self.diddy = [];
      self.diddy_promise = null;
      self.last_diddy_sound = null;
      self.diddy_word = null;
      self.diddy_index = null;

      self.listener = null;

      function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      function loadsample(i) {
        var loader = new THREE.AudioLoader();
        loader.load('audio/' + i + '.mp3', function(buffer) {
          var sample = self.samples[i];
          sample.setBuffer(buffer);
          sample.setLoop(false);
          sample.setVolume(1.0);
        });
      }

      function playSound() {
        var source = listener.context.createBufferSource();
        source.connect(listener.context.destination);
        source.start();
      }

      self.prepare = function(listener) {
        self.listener = listener;

        window.addEventListener('touchstate', playSound);

        var loader = new THREE.AudioLoader();

        // create a sound source for the background loop
        self.loop = new THREE.Audio(listener);
        
        loader.load('audio/loop.mp3', function(buffer) {
          self.loop.setBuffer(buffer);
          self.loop.setLoop(true);
          self.loop.setVolume(0.25);
          self.loop.play();
        });

        // create a new sound source for each of our samples
        for(var i=0; i < 15; i++) {
          var sample = new THREE.Audio(listener);
          self.samples.push(sample);
          loadsample(i);
        }

        var snaploader = new THREE.AudioLoader();
        self.snap = new THREE.Audio(listener);
        
        snaploader.load('audio/snap.mp3', function(buffer) {
          self.snap.setBuffer(buffer);
          self.snap.setLoop(false);
          self.snap.setVolume(0.3);
        });
      };

      self.thunk = function() {
        // play the index-th sample right away
        //self.loop.play();
        if (self.snap.isPlaying) {
          self.snap.stop();
        }
        self.snap.play();
      };

      function play_next_diddy_sample() {
        if (self.diddy.length == 0) {
          return;
        }
        var index = self.diddy.splice(0,1)[0];

        if (self.diddy_word != null && self.diddy_word != '') {
          $rootScope.$broadcast('diddysample', [self.diddy_word,self.diddy_index]);
          self.diddy_index++;
        }

        if (!(index in self.samples)) {
          console.log('index not found: ' + index);
          console.log(typeof index);
        }

        if (self.samples[index].isPlaying) {
          self.samples[index].stop();
        }
        self.samples[index].play();


        if (self.diddy.length > 0) {
          self.diddy_promise = $timeout(play_next_diddy_sample, 110);
        }
      }

      self.playdiddy = function(index,length,word,forward=true) {

        console.log('making a diddy: ' + index + ',' + length);

        if (self.diddy_promise != null) {
          $timeout.cancel(self.diddy_promise);
          self.diddy_promise = null;
        }
        if (self.last_diddy_sound != null) {
          if (self.samples[self.last_diddy_sound].isPlaying) {
            self.samples[self.last_diddy_sound].stop();
          }
          self.last_diddy_sound = null;
        }

        self.diddy = [];
        if (forward) {
          for(var n=0; n < length; n++) {
            // add the current index to the diddy
            self.diddy.push(index);

            // pick the next sample to add
            index = getRandomInt(Math.max(0,index-1), Math.min(index+2, self.samples.length-1));
          }
        }else{
          index = self.samples.length-1;
          for(var n=0; n < length; n++) {
            // add the current index to the diddy
            self.diddy.splice(0,0,[index]);

            // pick the next sample to add
            index = getRandomInt(Math.max(0,index-2), Math.min(index+1, self.samples.length-1));
          }
        }

        // set timeout to 0 and and start the chain
        self.diddy_word = word;
        self.diddy_index = 0;
        self.diddy_promise = $timeout(play_next_diddy_sample, 0);
      };

      return self;
    }
  ]
);
