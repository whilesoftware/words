var words = angular.module('words');

words.controller(
  'gameController',
  [
    '$scope',
    '$window',
    'Data',
    'Config',
    '$stateParams',
    '$timeout',
    '$document',
    function($scope, $window, Data, Config, $stateParams, $timeout, $document) {
      console.log('---> loading the game controller');

      //$scope.debugtext =  navigator.userAgent;;
      $scope.debugtext = '';
      $scope.debugtext2 = '';

      $scope.$on('dodebug', function(events,args) {
        $scope.debugtext += args[0];
      });

      $scope.force_cam_position_x = null;
      $scope.force_cam_position_y = null;

      $scope.scrub_start_time = 0;
      $scope.scrub_length = 1;
      $scope.scrubbing = false;

      $scope.time_origin = -1;

      $scope.get_time_origin = function() {
        if ($scope.time_origin == -1) {
          // update from the board
          $scope.time_origin = Data.boards[$scope.boardname].first_sample_time;
        }

        return $scope.time_origin;
      }

      var pressure_stroke_time = {
        type: "f",
        value: 0
      };

      $scope.render_strokes = {};

      // establish the rendering context
      $scope.scene = new THREE.Scene();
      $scope.renderer = new THREE.WebGLRenderer({ alpha: true , antialias: true, autoClear: true});
      $scope.camera = null;

      $scope.camera_offsetx = 0;
      $scope.camera_offsety = 0;

      $scope.is_dirty = true;
      function invalidate() {
        $scope.is_dirty = true;
      }
/*
      $scope.$on('replay', function(events, args) {
        console.log('scrub start');
        $scope.scrubbing = true;
        $scope.scrub_start_time = Date.now() - $scope.get_time_origin();
        invalidate();
      });
*/

      function updateCameraPosition() {
        $scope.camera.position.set(
          $window.innerWidth / 2 / Data.zoom + $scope.camera_offsetx,
          $window.innerHeight / -2 / Data.zoom + $scope.camera_offsety,
          0
        );
        invalidate();
      }

      function onwindowresize(){
        if ($scope.scene == null) {
          return;
        }
        let wasnull = $scope.camera == null;
        let vsize = $window.innerHeight / Data.zoom;
        let ratio = $window.innerWidth / $window.innerHeight;
        let new_cam_position = {x:0,y:0,z:0};
        let oldcamera = null;

        if (wasnull) {
          // position the camera with the upper left-hand corner at (0,0,0) + (camera_offsetx,camera_offsety,0)
          new_cam_position.x = $window.innerWidth / 2 / Data.zoom + $scope.camera_offsetx;
          new_cam_position.y = $window.innerHeight / -2 / Data.zoom + $scope.camera_offsety;
          new_cam_position.z = 0;

        }else{
          // first drop the old camera from the scene list
          // leave the camera where it currently is
          new_cam_position.x = $scope.camera.position.x;
          new_cam_position.y = $scope.camera.position.y;
          new_cam_position.z = $scope.camera.position.z;

          oldcamera = $scope.camera;

          $scope.camera_offsetx = new_cam_position.x - $window.innerWidth / 2 / Data.zoom;
          $scope.camera_offsety = new_cam_position.y - $window.innerHeight / -2 / Data.zoom;
        }

        // if we have instructions to override the camera position, enforce that here
        if ($scope.force_cam_position_x != null && $scope.force_cam_position_y != null) {
          new_cam_position.x = $scope.force_cam_position_x;
          new_cam_position.y = $scope.force_cam_position_y;
          $scope.camera_offsetx = new_cam_position.x - $window.innerWidth / 2 / Data.zoom;
          $scope.camera_offsety = new_cam_position.y - $window.innerHeight / -2 / Data.zoom;
          $scope.force_cam_position_x = null;
          $scope.force_cam_position_y = null;
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

        invalidate();
      }

      // attach the renderer to the DOM
      angular.element(document.querySelector( '#rendertarget' )).append($scope.renderer.domElement);

      const MAX_POINTS = 512 * 8;
      const CURVE_MULTIPLIER = 4; // # samples between control points

      function PressureStroke(context, strokeid) {
        this.context = context;
        this.strokeid = strokeid;
        this.stroke = context.strokes[this.strokeid];

        this.init = function() {
          this.geometry = new THREE.BufferGeometry();
          this.cpositions = [];
          this.ctimestamps = [];
          this.last_cpos = -1;

          if (this.stroke.is_final) {
            this.positions = new Float32Array(this.stroke.samples.length * 3 * CURVE_MULTIPLIER * 2);
            this.timestamps = new Float32Array(this.stroke.samples.length * CURVE_MULTIPLIER * 2);
          }else{
            this.positions = new Float32Array(MAX_POINTS * 3 * CURVE_MULTIPLIER * 2);
            this.timestamps = new Float32Array(MAX_POINTS * CURVE_MULTIPLIER * 2);
          }

          this.geometry.addAttribute('position', new THREE.BufferAttribute(this.positions, 3));
          this.geometry.addAttribute('timestamp', new THREE.BufferAttribute(this.timestamps, 1));
          //this.material = new THREE.MeshBasicMaterial({color: this.stroke.color, transparent: true, opacity: 1});

          let red = ((this.stroke.color & 0xff0000 ) >> 16) / 255;
          let green = ((this.stroke.color & 0x00ff00 ) >> 8) / 255;
          let blue = ((this.stroke.color & 0x0000ff ) ) / 255;

          this.uniforms = {
            time: pressure_stroke_time,
            color: { 
              type: "v4", 
              value: new THREE.Vector4(red,green,blue,1) 
            }
          };

          this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: $document[0].getElementById('vertexshader').textContent,
            fragmentShader: $document[0].getElementById('fragmentshader').textContent
          });
          this.mesh = new THREE.Mesh(this.geometry, this.material);
          this.mesh.drawMode = THREE.TriangleStripDrawMode;

          this.added_to_scene = false;
        };
        this.init();


        this.add_to_scene = function() {
          $scope.scene.add(this.mesh);
          this.added_to_scene = true;
        };
        this.remove_from_scene = function() {
          this.added_to_scene = false;
          $scope.scene.remove(this.mesh);
        };

        this.dispose = function() {
          // remove from scene
          if (this.added_to_scene) {
            this.remove_from_scene();
          }

          // free the buffergeometry and stuff
          this.geometry.dispose();
          this.material.dispose();
        };

        this.setOpacity = function(opacity) {
          //this.mesh.material = new THREE.MeshBasicMaterial({color: this.stroke.color, transparent: true, opacity: opacity});
        }

        this.updatePositions = function() {
          invalidate();

          // if this is a finalized stroke, first let's re-init using the known sample count
          if (this.stroke.is_final) {
            this.dispose();
            this.init();
          }

          let samples = this.stroke.samples;

          var nsamples = samples.length;

          if (this.added_to_scene == false && nsamples > 1) {
            this.add_to_scene();
          }

          if (nsamples < 4) {
            return;
          }

          //var positions = [];

          for(let i=this.last_cpos+1; i < nsamples; i++) {
            let newvec = new THREE.Vector3(samples[i].x, samples[i].y, samples[i].z);
            this.cpositions.push(newvec);
            let sample = samples[i].t - $scope.get_time_origin();
            //console.log('adding timestamp sample: ' + samples[i].t + ' - ' + $scope.get_time_origin());
            this.ctimestamps.push(sample);
          }

          function get_pressure_at(_p) {
            // what's the floating-point sample index?
            let _fi = _p * (nsamples - 1);
            // what's the integer index of the sample to the left?
            let _i = Math.floor(_fi);
            if (_fi <= 0) {
              return samples[0].p;
            }

            if (_fi >= nsamples - 1) {
              return samples[nsamples-1].p;
            }

            let _t = _fi - _i;
            return samples[_i].p + _t * (samples[_i+1].p - samples[_i].p);
          }

          //var curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 1);
          var curve = new THREE.CatmullRomCurve3(this.cpositions);

          const PRESSURE_MULTIPLIER = 4.2;

          var index = (this.last_cpos+1) * 6 * CURVE_MULTIPLIER;
          var tindex = (this.last_cpos+1) * 2 * CURVE_MULTIPLIER;
          for(let i=this.last_cpos+1; i < nsamples; i++) {

            // set time bounds for these samples
            let tstart = this.ctimestamps[i];
            let tend = tstart;
            if (i < nsamples - 1) {
              tend = this.ctimestamps[i+1];
            }
            let tdelta = (tend - tstart) / CURVE_MULTIPLIER;

            for(let j=0; j < CURVE_MULTIPLIER; j++) {
              // compute the position along the curve for this index
              let p = (i * CURVE_MULTIPLIER + j) / (nsamples * CURVE_MULTIPLIER - 1);

              let point = curve.getPoint(p);
              let tangent = curve.getTangent(p);
              let pressure = get_pressure_at(p);

              // 90 CCW
              this.positions[index++] = point.x + PRESSURE_MULTIPLIER * pressure * tangent.y * -1;
              this.positions[index++] = point.y + PRESSURE_MULTIPLIER * pressure * tangent.x;
              this.positions[index++] = point.z;


              // 90 CW
              this.positions[index++] = point.x + PRESSURE_MULTIPLIER * pressure * tangent.y;
              this.positions[index++] = point.y + PRESSURE_MULTIPLIER * pressure * tangent.x * -1;
              this.positions[index++] = point.z;

              this.timestamps[tindex++] = tstart + tdelta * j;
              this.timestamps[tindex++] = tstart + tdelta * j;
              //console.log('timestamp: ' + tindex + ' - ' + (tstart + tdelta * j));
            }
          }

          this.mesh.geometry.setDrawRange(0, nsamples * 2 * CURVE_MULTIPLIER);
          this.mesh.geometry.attributes.position.needsUpdate = true;
          this.mesh.geometry.attributes.timestamp.needsUpdate = true;
          this.mesh.geometry.computeBoundingSphere();

          this.last_cpos = nsamples-1;
        };
      }

      function get_mouse_world_coords(x, y, dodebug=false) {
        var _x = (x / $window.innerWidth) * 2 - 1;
        var _y = - ( y / $window.innerHeight) * 2 + 1;

        var now = new THREE.Vector3(_x, _y, 0);
        now.unproject($scope.camera);
        let dx = $window.innerWidth / 2 / Data.zoom;
        let dy = $window.innerHeight / 2 / Data.zoom;
        let left = $scope.camera.position.x - dx;
        let right = $scope.camera.position.x + dx;
        let bottom = $scope.camera.position.y - dy;
        let top = $scope.camera.position.y + dy;
        now.x = left + (_x + 1) / 2 * (right - left);
        now.y = bottom + (_y + 1) / 2 * (top - bottom);
        now.z = 0;

        //$scope.debugtext = " left: " + left.toFixed(2) + " right: " + right.toFixed(2) + " top: " + top.toFixed(2) + " bottom: " + bottom.toFixed(2);
        //$scope.debugtext = " left: " + left.toFixed(2) + " x: " + _x.toFixed(2) + " top: " + top.toFixed(2) + " y: " + _y.toFixed(2);
        //$scope.debugtext2 = JSON.stringify($scope.camera.position);

        return now;
      }

      // this identifies the active touch on mobile devices
      $scope.active_touchid = null;

      $scope.active_touches = {};

      function ondown(rawx,rawy,t,p) {
        $scope.$apply(function() {
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;

          if ($scope.sessionactive) {
            let board = Data.boards[$scope.boardname];
            board.update_session_cursor({
              c:true,
              x:x,
              y:y,
              z:z,
              p:p,
              t:t
            });
          }

          console.log('ondown: ' + x + ',' + y +',' + t + ',' + p);

          //local_create_stroke(t, Data.current_color, 1 / Data.zoom);
          //local_add_sample($scope.active_strokeid, new Data.Vector3(x,y,z), p, t);
        });
      }


      function onmove(rawx,rawy,t,p) {
        $scope.$apply(function() {
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;
          context.local_add_sample($scope.active_strokeid, new Data.Vector3(x,y,z), p, t);
        });
      }

      function onup(rawx,rawy,t) {
        $scope.$apply(function() { 
          var pos = get_mouse_world_coords(rawx, rawy);
          let x = pos.x;
          let y = pos.y;
          let z = pos.z;
          console.log('onup: ' + x + ',' + y +',' + t );

          $scope.active_context.local_add_sample($scope.active_strokeid, new Data.Vector3(x, y, z), 0, t);
          $scope.active_context.local_end_stroke($scope.active_strokeid, t);
        });
      }

      function onpointer(evt) {
        //$scope.debugtext2 = evt.type + ' - ' + evt.pointerType + ":" + evt.pointerId + '.' + evt.pressure;

        let pressure = evt.pressure;
        if (evt.pointerType == 'touch' && pressure == 0 && evt.type != 'pointerup' && evt.type != 'pointercancel') {
          pressure = 0.5;
        }

        let pointerid = evt.pointerId;

        switch(evt.type) {
          case "pointerdown":
            if (pointerid in $scope.active_touches) {
              console.error('got a pointerforn event for an id that was thought to already be active');
            }else{
              $scope.active_touches[pointerid] = {
                samples: [{
                  x: evt.clientX,
                  y: evt.clientY,
                  t: Date.now(),
                  p: pressure
                }]
              }
            }

            let _keys1 = Object.keys($scope.active_touches);
            let _touch1 = $scope.active_touches[_keys1[0]];
            if (_keys1.length == 1) {
              $scope.active_touchid = _keys1[0];
              ondown(_touch1.samples[0].x, _touch1.samples[0].y, Date.now(), _touch1.samples[0].p);
            }else{
              // if we have an active touchid, cancel it
              if ($scope.active_touchid !== null) {
                let len = _touch1.samples.length;
                onup(_touch1.samples[len-1].x, _touch1.samples[len-1].y, Date.now());
                $scope.active_touchid = null;
              }
            }
            break;
          case "pointermove":
            // how many active touches?
            let keys3 = Object.keys($scope.active_touches);

            switch(keys3.length) {
              case 1:
                // if this is the active touch, call onmove()
                if (pointerid == $scope.active_touchid) {
                  onmove(evt.clientX, evt.clientY, Date.now(), pressure);
                }
                break;
              default:
                // store pointer movement
                if (pointerid in $scope.active_touches) {
                  let _touch = $scope.active_touches[pointerid];
                  _touch.samples.push({
                    x: evt.clientX,
                    y: evt.clientY,
                    t: Date.now()
                  });
                }else{
                  //console.error('pointermove event for unknown pointerid: ' + pointerid);
                }

                // process changes to gesture
                ongesture();
                break;
            }
            break;
          case "pointerup":
            //if (!evt.isPrimary && evt.setPointerCapture != null) {
            //  evt.releasePointerCapture();
            //}
            //onup(evt.clientX, evt.clientY, Date.now());

            let keys2 = Object.keys($scope.active_touches);

            switch(keys2.length) {
              case 1:
                if (pointerid == $scope.active_touchid) {
                  onup(evt.clientX, evt.clientY, Date.now());
                  $scope.active_touchid = null;
                }
                delete $scope.active_touches[pointerid];
                break;
              default:
                // process change
                if (pointerid in $scope.active_touches) {
                  delete $scope.active_touches[pointerid];
                }else{
                  console.error('pointerup event for unknown pointerid: ' + pointerid);
                }

                // process changes to gesture
                ongesture();
                break;
            }
            break;
          case "pointercancel":
            //if (!evt.isPrimary && evt.setPointerCapture != null) {
            //  evt.releasePointerCapture();
            //}
            let keys4 = Object.keys($scope.active_touches);

            switch(keys4.length) {
              case 1:
                if (pointerid == $scope.active_touchid) {
                  onup(evt.clientX, evt.clientY, Date.now());
                  $scope.active_touchid = null;
                }
                delete $scope.active_touches[pointerid];
                break;
              default:
                // process change
                if (pointerid in $scope.active_touches) {
                  delete $scope.active_touches[pointerid];
                }else{
                  console.error('pointerup event for unknown pointerid: ' + pointerid);
                }

                // process changes to gesture
                ongesture();
                break;
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
              let touch1 = evt.changedTouches[n];
              if (touch1['identifier'] in $scope.active_touches) {
                console.error('got start event for existing touch :(');
                continue;
              }else{
                // add this touch to our list of active touches
                $scope.active_touches[touch1['identifier']] = {
                  samples: [{
                    x: touch1.clientX,
                    y: touch1.clientY,
                    t: Date.now(),
                    p: touch1['force']
                  }]
                };
              }
            }

            let _keys1 = Object.keys($scope.active_touches);
            let _touch1 = $scope.active_touches[_keys1[0]];
            if (_keys1.length == 1) {
              $scope.active_touchid = _keys1[0];
              ondown(_touch1.samples[0].x, _touch1.samples[0].y, Date.now(), _touch1.samples[0].p);
            }else{
              // if we have an active touchid, cancel it
              if ($scope.active_touchid !== null) {
                let len = _touch1.samples.length;
                onup(_touch1.samples[len-1].x, _touch1.samples[len-1].y, Date.now());
                $scope.active_touchid = null;
              }
            }
            break;
          case "touchmove":
            // how many active touches?
            let keys3 = Object.keys($scope.active_touches);
            let touch3 = evt.changedTouches[0];

            switch(keys3.length) {
              case 1:
                // if this is the active touch, call onmove()
                if (touch3['identifier'] == $scope.active_touchid) {
                  if (touch3['force'] == 0) {
                    onmove(touch3.clientX, touch3.clientY, Date.now(), 0.5);
                  }else{
                    onmove(touch3.clientX, touch3.clientY, Date.now(), touch3['force']);
                  }
                }
                break;
              default:
                // store touch movements
                for(var n=0; n < evt.changedTouches.length; n++) {
                  touch3 = evt.changedTouches[n];
                  if (touch3['identifier'] in $scope.active_touches) {
                    let _touch = $scope.active_touches[touch3['identifier']];
                    _touch.samples.push({
                      x: touch3.clientX,
                      y: touch3.clientY,
                      t: Date.now()
                    });
                  }else{
                    console.error('touchmove event for unknown touch id: ' + touch3['identifier']);
                    continue;
                  }
                }

                // process changes to gesture
                ongesture();
                break;
            }
            break;
          case "touchend":
            let keys2 = Object.keys($scope.active_touches);
            let touch2 = evt.changedTouches[0];

            switch(keys2.length) {
              case 1:
                if (touch2['identifier'] == $scope.active_touchid) {
                  onup(touch2.clientX, touch2.clientY, Date.now());
                  $scope.active_touchid = null;
                }
                delete $scope.active_touches[touch2['identifier']];
                break;
              default:
                // process all changes
                for(var n=0; n < evt.changedTouches.length; n++) {
                  touch2 = evt.changedTouches[n];
                  if (touch2['identifier'] in $scope.active_touches) {
                    delete $scope.active_touches[touch2['identifier']];
                  }else{
                    console.error('touchend event for unknown touch id: ' + touch2['identifier']);
                  }
                }

                // process changes to gesture
                ongesture();
                break;
            }
            break;
          case "touchcancel":
            let keys4 = Object.keys($scope.active_touches);
            let touch4 = evt.changedTouches[0];

            switch(keys4.length) {
              case 1:
                if (touch4['identifier'] == $scope.active_touchid) {
                  onup(touch4.clientX, touch4.clientY, Date.now());
                  $scope.active_touchid = null;
                }
                delete $scope.active_touches[touch4['identifier']];
                break;
              default:
                // process all changes
                for(var n=0; n < evt.changedTouches.length; n++) {
                  touch4 = evt.changedTouches[n];
                  if (touch4['identifier'] in $scope.active_touches) {
                    delete $scope.active_touches[touch4['identifier']];
                  }else{
                    console.error('touchcancel event for unknown touch id: ' + touch4['identifier']);
                    continue;
                  }
                }

                // process changes to gesture
                ongesture();
                break;
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

      var framecount=0;
      function animate() {
        requestAnimationFrame(animate);

        if (framecount==0) {
          framecount++;
          $scope.renderer.render($scope.scene, $scope.camera);
          return;
        }

        $scope.$apply(function() {
          if (!$scope.is_dirty) {
            return;
          }

          framecount++;
          console.log('rendering frame: ' + framecount.toString());

          if ($scope.scrubbing) {
            // set time according to scrubbing
            let portion = (Date.now() - $scope.get_time_origin() - $scope.scrub_start_time) / ($scope.scrub_length * 1000);

            portion = Math.max(Math.min(1,portion),0);

              if (portion == 1) {
                $scope.scrubbing = false;
              }

              let s0 = board.first_sample_time - $scope.get_time_origin();
              let s1 = board.last_sample_time - $scope.get_time_origin();

              pressure_stroke_time.value = s0 + portion * (s1 - s0);

              console.log('scrubbing: ' + portion + ' - ' + pressure_stroke_time.value);
            //});
          }

          $scope.renderer.render($scope.scene, $scope.camera);
          if (!$scope.scrubbing) {
            $scope.is_dirty = false;
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
      onwindowresize();

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

      monitor_window_dimensions();
     
      /*
      $window.addEventListener('resize', monitor_window_dimensions, false );
      $window.addEventListener('orientationchange', monitor_window_dimensions, false );
      */

      // the Data service will notify rootScope any time the zoom level changes
      $scope.$on('zoomChange', function() {
        onwindowresize();
      });


      // start the rendering loop
      animate();
      
    }
  ]
);
