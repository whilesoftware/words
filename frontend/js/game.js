var words = angular.module('words');

words.controller(
  'gameController',
  [
    '$scope',
    '$window',
    '$stateParams',
    '$timeout',
    '$document',
    'Socketio',
    function($scope, $window, $stateParams, $timeout, $document, Socketio) {
      console.log('---> loading the game controller');

      //$scope.debugtext =  navigator.userAgent;;
      $scope.debugtext = '';
      $scope.debugtext2 = '';

      $scope.state = 'LOADING';

      $scope.write_word_horizontal_at = function(word, x, y, type='character') {
        for(var n=0; n < word.length; n++) {
          var id = '' + (x+n) + ',' + y;

          if (id in $scope.grid.samples) {
            $scope.grid.samples[id].set_type(type);
            $scope.grid.samples[id].set_letter(word[n]);
          }
        }
      };

      $scope.setstate = function(newstate) {
        if (newstate == $scope.state) {
          // we're already there!
          return;
        }

        console.log('setting new state: ' + newstate);

        // clean up old state
        switch($scope.state) {
          case 'LOADING':
          break;
        }

        // apply new state
        $scope.state = newstate;
        var gkeys = Object.keys($scope.grid.samples);
        switch($scope.state) {
          case 'CONNECTING':
            for(var n=0; n < gkeys.length; n++) {
              var gkey = gkeys[n];
              $scope.grid.samples[gkey].set_type('empty');
            }
            $scope.write_word_horizontal_at('CONNECTING', -4, -2);
            break;
          case 'WELCOME':
            for(var n=0; n < gkeys.length; n++) {
              var gkey = gkeys[n];
              $scope.grid.samples[gkey].set_type('empty');
            }
            $scope.write_word_horizontal_at('WORDS', -4, 3);
            $scope.write_word_horizontal_at('WITH', -4, 2);
            $scope.write_word_horizontal_at('STRANGERS', -4, 1);
            $scope.write_word_horizontal_at('PLAY', -4, -2, 'action');
            break;
          case 'PLAYING':
            // clear the grid
            for(var n=0; n < gkeys.length; n++) {
              var gkey = gkeys[n];
              $scope.grid.samples[gkey].set_type('empty');
            }

            $scope.grid.draw_playfield();

            // draw the category
            $scope.write_word_horizontal_at(
              $scope.grid.category.toUpperCase(),
              $scope.grid.left,
              $scope.grid.bottom + $scope.grid.active_height + 1);
            break;
        }
      };

      $scope.zoom = 1;

      $scope.$on('dodebug', function(events,args) {
        $scope.debugtext += args[0];
      });

      var pressure_stroke_time = {
        type: "f",
        value: 0
      };

      // establish the rendering context
      $scope.scene = new THREE.Scene();
      $scope.renderer = new THREE.WebGLRenderer({ alpha: true , antialias: true, autoClear: true});
      $scope.camera = null;

      $scope.camera_offsetx = 0;
      $scope.camera_offsety = 0;

      var gridsize = 42;

      $scope.letter_geometries = {
        'A':null,
        'B':null,
        'C':null,
        'D':null,
        'E':null,
        'F':null,
        'G':null,
        'H':null,
        'I':null,
        'J':null,
        'K':null,
        'L':null,
        'M':null,
        'N':null,
        'O':null,
        'P':null,
        'Q':null,
        'R':null,
        'S':null,
        'T':null,
        'U':null,
        'V':null,
        'W':null,
        'X':null,
        'Y':null,
        'Z':null,
        ' ':null,
        '-':null,
        '.':null,
        ':':null,
        '0':null,
        '1':null,
        '2':null,
        '3':null,
        '4':null,
        '5':null,
        '6':null,
        '7':null,
        '8':null,
        '9':null
      };

      function Square(x,y, a, b) {
        this.x = x;
        this.y = y;
        this.a = a;
        this.b = b;

        this.group = new THREE.Group();
        this.group.position.set(x,y,0);

        this.type = 0;
        this.state = 0;
        this.touchcount = 0;
        this.touching = 0;
        this.selected = 0;

        this.set_touching = function(newval) {
          if (newval) {
            this.touching = 1;
          }else{
            this.touching = 0;
          }
          this.update_uniforms();
        };

        this.set_selected = function(newval) {
          if (newval) {
            this.selected = 1;
          }else{
            this.selected = 0;
          }
          this.update_uniforms();
        };

        this.set_state = function(newstate) {
          switch(newstate) {
            case 'inert':
              this.state = 0;
              break;
          }
          this.update_uniforms();
        }

        this.set_type = function(newtype) {
          switch(newtype) {
            case 'empty':
              this.type = 0;
              this.set_letter(' ');
              break;
            case 'character':
              this.type = 1;
              break;
            case 'heading':
              this.type = 2;
              break;
            case 'action':
              this.type = 3;
              break;
            case 'border':
              this.type = 4;
              this.set_letter(' ');
              break;
          }
          this.update_uniforms();
        }

        this.add_external_touch = function() {
          this.touchcount++;
          this.update_uniforms();
        };
        this.del_external_touch = function() {
          this.touchcount--;
          this.update_uniforms();
        };

        this.uniforms = {
          type: {
            type: "f",
            value: this.type
          },
          state: {
            type: "f",
            value: this.state
          },
          touchcount: {
            type: "f",
            value: this.touchcount
          },
          touching: {
            type: "f",
            value: this.touching
          },
          selected: {
            type: "f",
            value: this.selected
          },
          basecolor: { 
            type: "v4", 
            value: new THREE.Vector4(0.9,0.9,0.9,1)
          },
          touchedcolor: { 
            type: "v4", 
            value: new THREE.Vector4(0.8,0.3,0.3,1)
          },
          actioncolor: {
            type: "v4",
            value: new THREE.Vector4(0.1,0.1,0.9,1)
          }
        };

        this.update_uniforms = function() {
          this.uniforms.state.value = this.state;
          this.uniforms.type.value = this.type;
          this.uniforms.touchcount.value = this.touchcount;
          this.uniforms.touching.value = this.touching;
          this.uniforms.selected.value = this.selected;
        };

        // a background square/box
        this.box_geometry = new THREE.BoxGeometry(gridsize * 0.95, gridsize * 0.95, gridsize/10);
        this.box_material = new THREE.ShaderMaterial({
          uniforms: this.uniforms,
          vertexShader: $document[0].getElementById('boxvertexshader').textContent,
          fragmentShader: $document[0].getElementById('boxfragmentshader').textContent
        });

        this.box_mesh = new THREE.Mesh(this.box_geometry, this.box_material);
        this.group.add(this.box_mesh);

        this.letter_material = new THREE.ShaderMaterial({
          uniforms: this.uniforms,
          vertexShader: $document[0].getElementById('lettervertexshader').textContent,
          fragmentShader: $document[0].getElementById('letterfragmentshader').textContent
        });


        this.letter = null;
        this.letter_mesh = null;

        this.set_letter = function(newletter) {
          this.letter = newletter;

          if (this.letter_mesh != null) {
            this.group.remove(this.letter_mesh);
          }

          this.letter_mesh = new THREE.Mesh($scope.letter_geometries[this.letter], this.letter_material);
          this.letter_mesh.position.set(-gridsize/4,-gridsize/4,gridsize/10 + 0.1);
          this.letter_mesh.scale.set(0.5,0.5,1);
          this.group.add(this.letter_mesh);
        };

        $scope.scene.add(this.group);
      }

      function Grid() {
        this.active_width = 0;
        this.active_height = 0;

        this.bottom = 0;
        this.left = 0;

        this.samples = {};

        this.fill_screen = function() {
          // the total number of grid samples needed to cover the whole window (always an odd number)
          this.width = 2 * Math.ceil($window.innerWidth / gridsize / 2) + 1;
          this.height = 2 * Math.ceil($window.innerHeight / gridsize / 2) + 1;

          var hw = (this.width - 1) / 2;
          var hh = (this.height -1) / 2;

          for(var a=-hw; a <= hw; a++) {
            for(var b=-hh; b <= hh; b++) {
              var x = a * gridsize;
              var y = b * gridsize;
              var id = '' + a + ',' + b;

              // if this id isn't in our list of samples, create it
              if (!(id in this.samples)) {
                var square = new Square(x,y,a,b);
                this.samples[id] = square;
              }
            }
          }
        };

        this.is_match = function(lower) {
          for(var n=0; n < this.words.length; n++) {
            if (lower == this.words[n]) {
              return true;
            }
          }
          return false;
        };

        this.draw_playfield = function() {
          // set the border cells
          console.log('drawing playfield');
          console.log('w: ' + this.active_width);
          console.log('h: ' + this.active_height);

          // fill the playfield cells with their letters
          for(var x=0; x < this.active_width; x++) {
            for(var y=0; y < this.active_height; y++) {
              var id = '' + (this.left + x) + ',' + (this.bottom + y);
              var lid = '' + x + ',' + y;
              //console.log('setting: ' + id + ' - ' + this.values[lid]);
              this.samples[id].set_letter(this.values[lid].toUpperCase());
              this.samples[id].set_type('character');
            }
          }

          // mark any existing selections (from anyone)
        };

        this.get_id_from_world = function(x,y) {
          // which cell id is associated with this world coordinate?
          return '' + Math.round(x / gridsize) + ',' + Math.round(y / gridsize);
        };

        this.set = function(udata) {
          console.log('configuring board: ');
          console.log(udata);
          this.active_width = udata.width;
          this.active_height = udata.height;
          this.left = (udata.width - 1) / -2;
          this.bottom = (udata.height - 1) / -2;
          this.values = udata.values;
          this.words = udata.words;
          this.category = udata.category;
          this.captures = udata.captures;
        };
      }

      function onwindowresize(){
        // make sure we're showing enough grid samples to cover the whole screen
        $scope.grid.fill_screen();

        let wasnull = $scope.camera == null;
        let vsize = $window.innerHeight / $scope.zoom;
        let ratio = $window.innerWidth / $window.innerHeight;
        let new_cam_position = {x:0,y:0,z:0};
        let oldcamera = null;

        if (wasnull) {
          // position the camera with the upper left-hand corner at (0,0,0) + (camera_offsetx,camera_offsety,0)
          new_cam_position.x = 0; //$window.innerWidth / 2 / $scope.zoom + $scope.camera_offsetx;
          new_cam_position.y = 0; //$window.innerHeight / -2 / $scope.zoom + $scope.camera_offsety;
          new_cam_position.z = 0;

        }else{
          // first drop the old camera from the scene list
          // leave the camera where it currently is
          new_cam_position.x = $scope.camera.position.x;
          new_cam_position.y = $scope.camera.position.y;
          new_cam_position.z = $scope.camera.position.z;

          oldcamera = $scope.camera;

          $scope.camera_offsetx = new_cam_position.x - $window.innerWidth / 2 / $scope.zoom;
          $scope.camera_offsety = new_cam_position.y - $window.innerHeight / -2 / $scope.zoom;
        }

        // create the camera at (0,0,0)
        $scope.camera = new THREE.OrthographicCamera( 
          -ratio * vsize / 2, 
          ratio * vsize / 2, 
          vsize / 2, -vsize / 2, -1000, 1000);

        // add it to the scene
        $scope.scene.add($scope.camera);

        // set position
        $scope.camera.position.x = new_cam_position.x;
        $scope.camera.position.y = new_cam_position.y;
        $scope.camera.position.z = new_cam_position.z;

        if (oldcamera !== null) {
          $scope.camera.view = oldcamera.view === null ? null : Object.assign( {}, oldcamera.view);
          $scope.camera.updateProjectionMatrix();
          $scope.scene.remove(oldcamera);
        }

        // ensure that the renderer is covering the whole window
        $scope.renderer.setSize( $window.innerWidth, $window.innerHeight );
      }

      // attach the renderer to the DOM
      angular.element(document.querySelector( '#rendertarget' )).append($scope.renderer.domElement);

      const MAX_POINTS = 512 * 8;
      const CURVE_MULTIPLIER = 4; // # samples between control points

      function get_mouse_world_coords(x, y, dodebug=false) {
        var _x = (x / $window.innerWidth) * 2 - 1;
        var _y = - ( y / $window.innerHeight) * 2 + 1;

        var now = new THREE.Vector3(_x, _y, 0);
        now.unproject($scope.camera);
        let dx = $window.innerWidth / 2 / $scope.zoom;
        let dy = $window.innerHeight / 2 / $scope.zoom;
        let left = $scope.camera.position.x - dx;
        let right = $scope.camera.position.x + dx;
        let bottom = $scope.camera.position.y - dy;
        let top = $scope.camera.position.y + dy;
        now.x = left + (_x + 1) / 2 * (right - left);
        now.y = bottom + (_y + 1) / 2 * (top - bottom);
        now.z = 0;
        return now;
      }

      // this identifies the active touch on mobile devices
      $scope.active_touchid = null;

      $scope.active_gridid = null;

      $scope.select_start = {
        id : null,
        x : null,
        y : null,
        rawx: null,
        rawy: null
      };

      $scope.select_direction = 'none';
      $scope.selected = [];
      $scope.selection = '';

      function ondown(rawx,rawy,t,p) {
        $scope.$apply(function() {
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;
          //console.log('ondown: ' + x + ',' + y);

          $scope.connection.broadcast_status_change(x,y,true);

          // touch this grid sample
          $scope.active_gridid = $scope.grid.get_id_from_world(x,y);
         
          // store this root location for our new selection
          $scope.select_start.id = $scope.active_gridid;
          $scope.select_start.x = parseInt($scope.active_gridid.split(',')[0]);
          $scope.select_start.y = parseInt($scope.active_gridid.split(',')[1]);
          $scope.select_start.rawx = x;
          $scope.select_start.rawy = y;

          $scope.grid.samples[$scope.active_gridid].set_touching(true);
        });
      }


      function onmove(rawx,rawy,t,p) {
        $scope.$apply(function() {
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;
          //console.log('onmove: ' + x + ',' + y);
          $scope.connection.broadcast_status_change(x,y,true);
          var new_gridid = $scope.grid.get_id_from_world(x,y);

          var new_select_x = parseInt(new_gridid.split(',')[0]);
          var new_select_y = parseInt(new_gridid.split(',')[1]);

          var rdx = x - $scope.select_start.rawx;
          var rdy = y - $scope.select_start.rawy;
          var dx = new_select_x - $scope.select_start.x;
          var dy = new_select_y - $scope.select_start.y;

          var select_type = 'unknown';

          if (new_gridid == $scope.select_start.id) {
            select_type = 'single';
          }else{
            if (dx == 0) {
              if (dy > 0) {
                select_type = 'up';
              }else{
                select_type = 'down';
              }
            }else if (dy == 0) {
              if (dx > 0) {
                select_type = 'right';
              }else{
                select_type = 'left';
              }
            }else{
              if (Math.abs(dx) == Math.abs(dy)) {
                if (dx > 0) {
                  if (dy > 0) {
                    select_type = 'up_right';
                  }else{
                    select_type = 'down_right';
                  }
                }else{
                  if (dy > 0) {
                    select_type = 'up_left';
                  }else{
                    select_type = 'down_left';
                  }
                }
              }else{
                // no obvious match :(
                select_type = 'single';
              }
            }
          }

          $scope.select_direction = select_type;

          dx = Math.abs(dx);
          dy = Math.abs(dy);

          // loop over the previously selected items and deselect them
          for(var n=0; n < $scope.selected.length; n++) {
            var current = $scope.selected[n];
            $scope.grid.samples[current].set_selected(false);
          }

          $scope.selected = [];
          switch(select_type) {
            case 'single':
              $scope.selected.push($scope.select_start.id);
              break;
            case 'up':
              for(var n=0; n <= dy; n++) {
                var id = '' + $scope.select_start.x + ',' + ($scope.select_start.y + n);
                $scope.selected.push(id);
              }
              break;
            case 'down':
              for(var n=0; n <= dy; n++) {
                var id = '' + $scope.select_start.x + ',' + ($scope.select_start.y - n);
                $scope.selected.push(id);
              }
              break;
            case 'left':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x - n) + ',' + $scope.select_start.y;
                $scope.selected.push(id);
              }
              break;
            case 'right':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x + n) + ',' + $scope.select_start.y;
                $scope.selected.push(id);
              }
              break;
            case 'up_right':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x + n) + ',' + ($scope.select_start.y + n);
                $scope.selected.push(id);
              }
              break;
            case 'down_right':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x + n) + ',' + ($scope.select_start.y - n);
                $scope.selected.push(id);
              }
              break;
            case 'up_left':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x - n) + ',' + ($scope.select_start.y + n);
                $scope.selected.push(id);
              }
              break;
            case 'down_left':
              for(var n=0; n <= dx; n++) {
                var id = '' + ($scope.select_start.x - n) + ',' + ($scope.select_start.y - n);
                $scope.selected.push(id);
              }
              break;
          }

          $scope.selection = '';
          for(var n=0; n < $scope.selected.length; n++) {
            var thisone = $scope.grid.samples[$scope.selected[n]];
            $scope.selection += thisone.letter;
            thisone.set_selected(true);
          }

          if ($scope.active_gridid != new_gridid) {
            $scope.grid.samples[$scope.active_gridid].set_touching(false);
            $scope.active_gridid = new_gridid;
            $scope.grid.samples[$scope.active_gridid].set_touching(true);
          }
        });
      }

      function onup(rawx,rawy,t) {
        $scope.$apply(function() { 
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;
          //console.log('onup: ' + x + ',' + y);
          $scope.connection.broadcast_status_change(x,y,false);
          $scope.grid.samples[$scope.active_gridid].set_touching(false);

          console.log('selected word: ' + $scope.selection);

          if ($scope.selection.length < 3) {
            // all words are at least 3 characters long
          }else{
            // check to see if this is a real word
            switch($scope.state) {
              case 'WELCOME':
                if ($scope.selection == 'PLAY') {
                  $scope.setstate('PLAYING');
                }
                break;
              case 'PLAYING':
                // is this a word we're looking for?
                var lower = $scope.selection.toLowerCase();
                if ($scope.grid.is_match(lower)) {
                  // publish our event!
                  $scope.connection.publish_match(
                    lower, 
                    $scope.select_start.x - $scope.grid.left, 
                    $scope.select_start.y - $scope.grid.bottom, 
                    $scope.select_direction);
                }
                break;
            }
          }

          for(var n=0; n < $scope.selected.length; n++) {
            var current = $scope.selected[n];
            $scope.grid.samples[current].set_selected(false);
          }
          $scope.selected = [];

        });
      }

      function onpointer(evt) {
        let pressure = evt.pressure;
        if (evt.pointerType == 'touch' && pressure == 0 && evt.type != 'pointerup' && evt.type != 'pointercancel') {
          pressure = 0.5;
        }

        let pointerid = evt.pointerId;

        switch(evt.type) {
          case "pointerdown":
            if ($scope.active_touchid === null) {
              $scope.active_touchid = pointerid;
              ondown(evt.clientX, evt.clientY, Date.now(), pressure);
            }
            break;
          case "pointermove":
            if (pointerid == $scope.active_touchid) {
              onmove(evt.clientX, evt.clientY, Date.now(), pressure);
            }
            break;
          case "pointerup":
            if (pointerid == $scope.active_touchid) {
              onup(evt.clientX, evt.clientY, Date.now());
              $scope.active_touchid = null;
            }
            break;
          case "pointercancel":
            if (pointerid == $scope.active_touchid) {
              onup(evt.clientX, evt.clientY, Date.now());
              $scope.active_touchid = null;
            }
            break;
        }
      }

      function ontouch(evt) {
        // we want to consume all touch events locally, 
        // so make sure the browser doesn't *also* respond to this event
        evt.preventDefault();

        switch(evt.type) {
          case "touchstart":
            for(var n=0; n < evt.changedTouches.length; n++) {
              var touch = evt.changedTouches[n];
              if ($scope.active_touchid === null) {
                $scope.active_touchid = touch['identifier'];
                ondown(touch.clientX, touch.clientY, Date.now(), touch['force']);
              }
            }
            break;
          case "touchmove":
            for(var n=0; n < evt.changedTouches.length; n++) {
              var touch = evt.changedTouches[n];
              if (touch['identifier'] == $scope.active_touchid) {
                onmove(touch.clientX, touch.clientY, Date.now(), touch['force']);
              }
            }
            break;
          case "touchend":
            for(var n=0; n < evt.changedTouches.length; n++) {
              var touch = evt.changedTouches[n];
              if (touch['identifier'] == $scope.active_touchid) {
                onup(touch.clientX, touch.clientY, Date.now());
                $scope.active_touchid = null;
              }
            }
            break;
          case "touchcancel":
            for(var n=0; n < evt.changedTouches.length; n++) {
              var touch = evt.changedTouches[n];
              if (touch['identifier'] == $scope.active_touchid) {
                onup(touch.clientX, touch.clientY, Date.now());
                $scope.active_touchid = null;
              }
            }
            break;
        }
      }

      function onmousedown(evt) {
        if (evt.which == 3) {
          return;
        }
        ondown(evt.x, evt.y, Date.now(), 1);
      }

      function onmousemove(evt) {
        onmove(evt.x, evt.y, Date.now(), 1);
      }

      function onmouseup(evt) {
        onup(evt.x, evt.y, Date.now());
      }

      var framecount=-1;
      function animate() {
        requestAnimationFrame(animate);
        framecount++;

        if (framecount == 0) {
          return;
        }
        $scope.$apply(function() {
          $scope.renderer.render($scope.scene, $scope.camera);
          if (framecount == 2 ) {
            console.log($scope.scene);
          }
        });
      }

      // use pointer events when they are available
      if ($window.PointerEvent) {
        $scope.renderer.domElement.addEventListener('pointerdown', onpointer);
        $scope.renderer.domElement.addEventListener('pointermove', onpointer);
        $scope.renderer.domElement.addEventListener('pointerup', onpointer);
        $scope.renderer.domElement.addEventListener('pointercancel', onpointer);
      }else{
        // mouse
        $scope.renderer.domElement.addEventListener('mousemove', onmousemove);
        $scope.renderer.domElement.addEventListener('mousedown', onmousedown);
        $scope.renderer.domElement.addEventListener('mouseup', onmouseup);

        // touch
        $scope.renderer.domElement.addEventListener('touchstart', ontouch, false);
        $scope.renderer.domElement.addEventListener('touchmove', ontouch, false);
        $scope.renderer.domElement.addEventListener('touchend', ontouch, false);
        $scope.renderer.domElement.addEventListener('touchcancel', ontouch, false);
      }

      $scope.last_window_width = $window.innerWidth;
      $scope.last_window_height = $window.innerHeight;

      var loader = new THREE.FontLoader();
      loader.load('fonts/ubuntu-mono-bold.json', function(font) {
        var keys = Object.keys($scope.letter_geometries);
        for(var n=0; n < keys.length; n++) {
          var key = keys[n];
          $scope.letter_geometries[key] = new THREE.TextGeometry(key, {
            font: font,
            size: gridsize * 1.25,
            height: 0.1,
            curveSegments: 16,
            bevelEnabled: false
          });
        }

        // when the font stuff is loaded we're ready to init the grid
        $scope.grid = new Grid();
        onwindowresize();
        // start the rendering loop
        $scope.setstate('CONNECTING');
        animate();
        monitor_window_dimensions();
        $scope.connection = new Connection();
      });

      // call this whenever a dimension/orientation change is detected.
      // we'll keep monitoring the state of the $window.innerHeight, and ensure
      // that onwindowresize() gets called when the change occurs
      function monitor_window_dimensions() {
        // have the window dimensions changed?
        if ($scope.last_window_width != $window.innerWidth || $scope.last_window_height != $window.innerHeight) {
          console.log('triggering window resize');
          $scope.last_window_width = $window.innerWidth;
          $scope.last_window_height = $window.innerHeight;
          onwindowresize();
          $timeout(monitor_window_dimensions, 500);
        }else{
          $timeout(monitor_window_dimensions, 50);
        }
      }

      function Connection() {
        this.broadcast_status_change = function(x,y,isdown) {
          if (Socketio.isConnected()) {
            Socketio.emit('setplayer', JSON.stringify({
              x:x,
              y:y,
              d:isdown,
              t:Date.now()
            }));
          }
        };

        this.other_players = { };

        this.publish_match = function(lower, sx, sy, direction) {
          if (Socketio.isConnected()) {
            Socketio.emit('boardevent', JSON.stringify({
              e: 'selection',
              word: lower,
              sx: sx,
              sy: sy,
              direction: direction
            }));
          }
        };

        function on_socketio_connect() {
          // set status to 'connected'
          $scope.setstate('WELCOME');
        }
        function on_socketio_disconnect() {
          // set status to 'offline'
          $scope.setstate('CONNECTING');
        }

        // subscribe to socket connection event
        $scope.$on('socketio_connect', function(event, data) {
          on_socketio_connect();
        });

        // subscribe to socketio connection event
        $scope.$on('socketio_disconnect', function(event, data) {
          on_socketio_disconnect();
        });

        // connect to the backend
        Socketio.connect();

        Socketio.on('setplayer', function(data) {
          // another player's status has been updated
          var jpay = JSON.parse(data);
          if (!(jpay.i in this.other_players)) {
            this.other_players[jpay.i] = {
              touchedid: null
            };
          }
          var their = this.other_players[jpay.i];

          their['x'] = jpay.x;
          their['y'] = jpay.y;
          their['d'] = jpay.d;
          their['t'] = jpay.t;

          // which grid sample id are they over?
          var newid = $scope.grid.get_id_from_world(jpay.x,jpay.y);

          if (jpay.d) {
            if (their.touchedid == null) {
              // this is a new touch
              if (newid in $scope.grid.samples) {
                $scope.grid.samples[newid].add_external_touch();
              }
              their['touchedid'] = newid;
            }else{
              // we are updating an existing touch
              if (their.touchedid != newid) {
                if (their.touchedid in $scope.grid.samples) {
                  $scope.grid.samples[their.touchedid].del_external_touch();
                }
                if (newid in $scope.grid.samples) {
                  $scope.grid.samples[newid].add_external_touch();
                }
                their.touchedid = newid;
              }
            }
          }else{
            if (their.touchedid != null) {
              // this is the end of an existing touch
              if (their.touchedid in $scope.grid.samples) {
                $scope.grid.samples[their.touchedid].del_external_touch();
              }
              their.touchedid = null;
            }
          }

        },this);

        Socketio.on('setboard', function(data) {
          // all the data we need to establish the current board state
          var jpay = JSON.parse(data);
          $scope.grid.set(jpay);
        },this);
        Socketio.on('boardevent', function(data) {
          // a game event has occurred
          $scope.grid.event(JSON.parse(data));
        },this);

        if (Socketio.isConnected()) {
          on_socketio_connect();
        }
      }

    }
  ]
);
