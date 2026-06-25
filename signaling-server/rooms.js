const rooms = {}

function joinRoom(roomId, socketId) {
  if (!rooms[roomId]) {
    rooms[roomId] = new Set()
  }

  rooms[roomId].add(socketId)

  return getRoomPeers(roomId, socketId)
}

function leaveRoom(roomId, socketId) {
  if (!rooms[roomId]) return

  rooms[roomId].delete(socketId)

  if (rooms[roomId].size === 0) {
    delete rooms[roomId]
  }
}

function getRoomPeers(roomId, socketId) {
  if (!rooms[roomId]) return []

  return Array.from(rooms[roomId])
    .filter(id => id !== socketId)
}

module.exports = {
  rooms,
  joinRoom,
  leaveRoom,
  getRoomPeers
}
