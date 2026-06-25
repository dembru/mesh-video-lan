const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { joinRoom, leaveRoom } = require('./rooms')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

io.on('connection', socket => {

  console.log('CONNECTED', socket.id)

  socket.on('join-room', roomId => {

    socket.roomId = roomId

    joinRoom(roomId, socket.id)

    socket.join(roomId)

    socket.to(roomId).emit('peer-joined')

    console.log(socket.id, 'joined', roomId)
  })

  socket.on('signal', payload => {
    socket.to(payload.roomId).emit('signal', payload.data)
  })

  socket.on('disconnect', () => {

    if (socket.roomId) {
      leaveRoom(socket.roomId, socket.id)
    }

    if (socket.roomId) {
      socket.to(socket.roomId).emit('peer-left')
    }

    console.log('DISCONNECTED', socket.id)
  })
})


server.listen(3000, '0.0.0.0', () => {
  console.log('SERVER RUNNING ON 3000')
})
