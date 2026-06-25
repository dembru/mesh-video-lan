const rooms = {}

function joinRoom(roomId, socketId) {
  if (!rooms[roomId]) {
    rooms[roomId] = []
  }

  rooms[roomId].push(socketId)
}

function leaveRoom(roomId, socketId) {
  if (!rooms[roomId]) return

  rooms[roomId] = rooms[roomId].filter(id => id !== socketId)

  if (rooms[roomId].length === 0) {
    delete rooms[roomId]
  }
}

module.exports = {
  rooms,
  joinRoom,
  leaveRoom
}
