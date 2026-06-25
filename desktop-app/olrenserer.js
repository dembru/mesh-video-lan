const io = require('socket.io-client')
const Peer = require('simple-peer')

const controls = require('./ui/controls')

// CHANGE SERVER IP
const socket = io('http://100.108.242.36:3000')

const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')

const joinBtn = document.getElementById('joinBtn')
const muteBtn = document.getElementById('muteBtn')
const cameraBtn = document.getElementById('cameraBtn')
const leaveBtn = document.getElementById('leaveBtn')

const roomInput = document.getElementById('roomInput')

let localStream
let peer = null
let roomId = null

let isMuted = false
let isCameraOff = false
let isConnected = false

async function initMedia() {

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })

  localVideo.srcObject = localStream
}

initMedia()


leaveBtn.disabled = true
updateUI()
leaveBtn.onclick = () => {
  cleanupPeer()
}

muteBtn.onclick = () => {

  controls.toggleMute(localStream)

  isMuted = !isMuted

  updateUI()
}

cameraBtn.onclick = () => {

  controls.toggleCamera(localStream)

  isCameraOff = !isCameraOff

  updateUI()
}

function cleanupPeer() {

  if (peer) {

    peer.removeAllListeners()

    peer.destroy()

    peer = null

    isConnected = false
    updateUI()
  }

  remoteVideo.srcObject = null
}

function updateUI() {

  if (isConnected) {

    joinBtn.classList.add('connected')

    joinBtn.innerText = 'CONNECTED'

    leaveBtn.disabled = false

  } else {

    joinBtn.classList.remove('connected')

    joinBtn.innerText = 'JOIN'

    leaveBtn.disabled = true
  }

  if (isMuted) {
    muteBtn.classList.add('toggled-off')
  } else {
    muteBtn.classList.remove('toggled-off')
  }

  if (isCameraOff) {
    cameraBtn.classList.add('toggled-off')
  } else {
    cameraBtn.classList.remove('toggled-off')
  }
}

function createPeer(initiator) {

  cleanupPeer()

  peer = new Peer({
    initiator,
    trickle: false,
    stream: localStream,

    config: {
      iceServers: []
    }
  })

  peer.on('signal', data => {

    socket.emit('signal', {
      roomId,
      data
    })
  })



  peer.on('stream', stream => {

    console.log('REMOTE STREAM RECEIVED')

    remoteVideo.srcObject = stream

    isConnected = true

    updateUI()
  })

  peer.on('close', () => {

    console.log('PEER CLOSED')

    cleanupPeer()
  })

  peer.on('error', err => {

    console.error('PEER ERROR:', err)

    cleanupPeer()
  })
}

joinBtn.onclick = () => {

  roomId = roomInput.value

  cleanupPeer()

  socket.emit('join-room', roomId)

  console.log('JOINED ROOM:', roomId)
}

socket.off('peer-joined')

socket.on('peer-joined', () => {

  console.log('PEER JOINED')

  if (!peer) {
    createPeer(true)
  }
})

socket.off('signal')

socket.on('signal', data => {

  console.log('SIGNAL RECEIVED')

  if (!peer) {
    createPeer(false)
  }

  try {
    peer.signal(data)
  } catch (err) {

    console.error('SIGNAL ERROR:', err)

    cleanupPeer()
  }
})

socket.on('peer-left', () => {

  console.log('PEER LEFT')

  cleanupPeer()
})

window.addEventListener('beforeunload', () => {

  cleanupPeer()

  socket.disconnect()
})