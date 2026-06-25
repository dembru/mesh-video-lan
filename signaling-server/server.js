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

  socket.on('join-room', (roomId, ack) => {

    if (!roomId || typeof roomId !== 'string') {
      if (ack) {
        ack({
          ok: false,
          error: 'roomId is required'
        })
      }

      return
    }

    const nextRoomId = roomId.trim()

    if (!nextRoomId) {
      if (ack) {
        ack({
          ok: false,
          error: 'roomId is required'
        })
      }

      return
    }

    if (
      socket.roomId &&
      socket.roomId !== nextRoomId
    ) {
      leaveRoom(socket.roomId, socket.id)
      socket.leave(socket.roomId)
    }

    socket.roomId = nextRoomId

    const peers =
      joinRoom(nextRoomId, socket.id)

    socket.join(nextRoomId)

    socket.to(nextRoomId).emit('peer-joined', {
      peerId: socket.id
    })

    if (ack) {
      ack({
        ok: true,
        roomId: nextRoomId,
        peers
      })
    }

    console.log(socket.id, 'joined', nextRoomId)
  })

  socket.on('signal', payload => {
    if (!payload || !payload.roomId || !payload.data) {
      return
    }

    socket.to(payload.roomId).emit('signal', {
      from: socket.id,
      data: payload.data
    })
  })

  socket.on('leave-room', ack => {

    if (socket.roomId) {
      const previousRoomId = socket.roomId

      leaveRoom(previousRoomId, socket.id)

      socket.leave(previousRoomId)

      socket.to(previousRoomId).emit('peer-left', {
        peerId: socket.id,
        intentional: true
      })

      socket.roomId = null
    }

    if (ack) {
      ack({
        ok: true
      })
    }
  })

  socket.on('disconnect', () => {

    if (socket.roomId) {
      leaveRoom(socket.roomId, socket.id)
    }

    if (socket.roomId) {
      socket.to(socket.roomId).emit('peer-left', {
        peerId: socket.id,
        intentional: false
      })
    }

    console.log('DISCONNECTED', socket.id)
  })
})


server.listen(3000, '0.0.0.0', () => {
  console.log('SERVER RUNNING ON 3000')
})
