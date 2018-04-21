"use strict";

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const fs = require('fs');
//var SUPERSECRETKEY = fs.readFileSync(__dirname + '/config/secret');
 


io.use(function(socket, next) {
  next();
}).on('connection', function(socket) {

  //socket.emit('authComplete', 'go girl');

  socket.on('touch', (payload) => {
    socket.broadcast.emit('touch', payload);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
