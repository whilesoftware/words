"use strict";

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const fs = require('fs');
//var SUPERSECRETKEY = fs.readFileSync(__dirname + '/config/secret');
 
var next_playerid = 0;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var letters = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
];

var groups = {
  colors: [
    'red',
    'green',
    'blue',
    'white',
    'black',
    'yellow',
    'orange',
    'purple',
    'brown',
    'grey',
    'pink'
  ],
  numbers: [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten'
  ],
  animals: [
    'dog',
    'cat',
    'cow',
    'monkey',
    'bull',
    'bear',
    'zebra',
    'giraffe',
    'horse',
  ],
  planets: [
    'earth',
    'mars',
    'jupiter',
    'venus',
    'neptune',
    'pluto'
  ]
};

var players = {};
var active_connections = {};

var board = {
  state: 'init',
  width: 11,
  height: 11,
  start: Date.now(),
  category: 'none',
  values: {},
  words: [
  ],
  captures: {}
};

function update_board() {
  switch (board.state) {
    case 'init':
      // pick a category
      let categories = Object.keys(groups);
      let category = categories[getRandomInt(0,categories.length-1)];

      // make a copy
      let ccopy = [];
      for(var n=0; n < groups[category].length; n++) {
        ccopy.push(groups[category][n]);
      }

      board.category = category;
      board.values = {};
      board.words = [];
      board.captures = {};
      board.start = Date.now();

      // set everything to ' '
      for(var x=0; x < board.width; x++) {
        for(var y=0; y < board.height; y++) {
          board.values['' + x + ',' + y] = ' ';
        }
      }

      var howmanymore = 6;
      while(howmanymore > 0 && ccopy.length > 0) {
        // pick a word at random
        var index = getRandomInt(0,ccopy.length-1);
        var w = ccopy.splice(index,1)[0];
        var l = w.length;

        // pick an axis
        if (Math.random() >= 0.5) {
          // horizontal

          // check which lanes are available
          var lanes = [];
          for(var y=0; y < board.height; y++) {
            var longest = 0;
            var current = 0;
            var start = 0;
            var longest_start = 0;
            for(var x=0; x < board.width; x++) {
              var id = '' + x + ',' + y;
              var cval = board.values[id];

              if (cval == ' ') {
                current++;

                if (current == 1) {
                  start = x;
                }
              }else{
                current = 0;
              }

              if (current > longest) {
                longest = current;
                longest_start = start;
              }
            }

            if (longest >= l) {
              // this is a viable lane
              lanes.push({y:y,size:longest,start:longest_start});
            }
          }

          // if we didn't find a lane, bail and try again
          if (lanes.length == 0) {
            continue;
          }

          // pick one at random
          var lane = lanes[getRandomInt(0,lanes.length - 1)];

          // pick a random offset within that zone
          var offset = getRandomInt(0, lane.size - l);

          // put the letters in place
          if (Math.random() > 0.5) {
            for(var p=0; p < l; p++) {
              var id = '' + (lane.start + offset + l - p - 1) + ',' + lane.y;
              //console.log(id + ' - ' + w[p]);
              board.values[id] = w[p];
            }
          }else{
            for(var p=0; p < l; p++) {
              var id = '' + (lane.start + offset + p) + ',' + lane.y;
              //console.log(id + ' - ' + w[p]);
              board.values[id] = w[p];
            }
          }

          //console.log('wrote word: ' + w);

          board.words.push(w);
        }else{
          // vertical
          // check which lanes are available
          var lanes = [];
          for(var x=0; x < board.width; x++) {
            var longest = 0;
            var current = 0;
            var start = 0;
            var longest_start = 0;
            
            for(var y=0; y < board.height; y++) {
              var id = '' + x + ',' + y;
              var cval = board.values[id];
              if (cval == ' ') {
                current++;

                if (current == 1) {
                  start = y;
                }
              }else{
                current = 0;
              }
              if (current > longest) {
                longest = current;
                longest_start = start;
              }
            }
            if (longest >= l) {
              // this is a viable lane
              lanes.push({x:x,size:longest,start:longest_start});
            }
          }

          // if we didn't find a lane, bail and try again
          if (lanes.length == 0) {
            continue;
          }

          // pick one at random
          var lane = lanes[getRandomInt(0,lanes.length - 1)];

          // pick a random offset within that zone
          var offset = getRandomInt(0, lane.size - l);

          // put the letters in place
          if (Math.random() > 0.5) {
            for(var p=0; p < l; p++) {
              var id = '' + lane.x + ',' + (lane.start + offset + p);
              //console.log(id + ' - ' + w[p]);
              board.values[id] = w[p];
            }
          }else{
            for(var p=0; p < l; p++) {
              var id = '' + lane.x + ',' + (lane.start + offset + l - p - 1);
              //console.log(id + ' - ' + w[p]);
              board.values[id] = w[p];
            }
          }
          board.words.push(w);
        }

        howmanymore--;
      }

      // fill the empty spaces with random letters a-z
      for(var x=0; x < board.width; x++) {
        for(var y=0; y < board.height; y++) {
          var id = '' + x + ',' + y;
          if (board.values[id] == ' ') {
            board.values[id] = letters[getRandomInt(0,25)];
          }
        }
      }

      board.state = 'playing';

      // notify all connected players of the new board state
      var pids = Object.keys(active_connections);
      for(var p=0; p < pids.length; p++) {
        var pid = pids[p];
        send_board_definition_to(active_connections[pid].socket);
      }
      break;
    case 'playing':
      var ckeys = Object.keys(board.captures);
      var anyfailed = false;
      for(var i=0; i < board.words.length; i++) {
        if (!(ckeys.includes(board.words[i]))) {
          // not done yet
          anyfailed = true;
          break;
        }
      }
      if (!anyfailed) {
        // all of the words have been captured!
        notify_board_cleared();
        board.state = 'init';
        update_board();
      }

      break;
    case 'complete':
      break;
  }
}
update_board();

function send_board_definition_to(socket) {
  socket.emit('setboard', JSON.stringify(board));
}

function send_event_to_all(e) {
  var pids = Object.keys(active_connections);
  for(var p=0; p < pids.length; p++) {
    var pid = pids[p];
    active_connections[pid].socket.emit('boardevent', e);
  }
}

function notify_board_cleared() {
  var pids = Object.keys(active_connections);
  for(var p=0; p < pids.length; p++) {
    var pid = pids[p];
    active_connections[pid].socket.emit('boardcleared', '[]');
  }
}


io.use(function(socket, next) {
  next();
}).on('connection', function(socket) {

  console.log('user connected');
  var id = next_playerid++;

  active_connections[id] = {
    socket: socket,
    score: 0
  };

  socket.on('setplayer', (payload) => {
    var jpay = JSON.parse(payload);
    jpay['i'] = id;
    socket.broadcast.emit('setplayer', JSON.stringify(jpay));
  });

  socket.on('boardevent', (payload) => {
    var jpay = JSON.parse(payload);

    console.log('boardevent: ' + payload);
    console.log('board words: ' + JSON.stringify(board.words));

    switch(jpay.e) {
      case 'selection':
        // is this selection still up for grabs?
        if (board.words.includes(jpay.word)) {
          console.log('real word');
          // this is a real word

          var skeys = Object.keys(board.captures);

          if (skeys.includes(jpay.word)) {
            console.log('fail');
            // but someone else already found it
            socket.emit('failure', payload);
          }else{
            // and this person just got it!
            console.log('success');
            socket.emit('success', payload);
            board.captures[jpay.word] = jpay;
            console.log(JSON.stringify(board.captures));
            send_event_to_all(payload);
            update_board();
          }
        }
        
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    socket.broadcast.emit('playerdisconnect', JSON.stringify({
      id: id
    }));
  });

  send_board_definition_to(socket);
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
