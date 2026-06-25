const io = require('socket.io-client')
const Peer = require('simple-peer')

const controls = require('./ui/controls')

const startupArg =
  process.argv.find(arg =>
    arg.startsWith(
      '--startup-mode='
    )
  )

const startupMode =
  startupArg
    ? startupArg.split('=')[1]
    : 'tx'

// CHANGE SERVER IP
const socket = io('http://100.108.242.36:3000', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  timeout: 5000
})

let reconnecting = false

const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')

const joinBtn = document.getElementById('joinBtn')
const muteBtn = document.getElementById('muteBtn')
const cameraBtn = document.getElementById('cameraBtn')
const leaveBtn = document.getElementById('leaveBtn')

const roomInput = document.getElementById('roomInput')

const canvas = document.getElementById('ecgCanvas')
const ctx = canvas.getContext('2d')

const ecgBtn =
  document.getElementById('ecgBtn')

const fullscreenBtn =
  document.getElementById('fullscreenBtn')

const roleBtn =
  document.getElementById('roleBtn')


let localEcgData = []
let remoteEcgData = []

let ecgEnabled = true

let fullscreenEcg = false

let isTransmitter =
  startupMode === 'tx'

let bpm = 72

let spo2 = 98

let systolic = 120

let diastolic = 80

let remoteBpm = 0

let remoteSpo2 = 0

let remoteSystolic = 0

let remoteDiastolic = 0

let heartbeatFlash = 0

let previousLocalPoint = 0

let previousRemotePoint = 0

const horizontalScale =
  fullscreenEcg
    ? 4
    : 2.5

function updateVitals() {

  bpm +=
    (Math.random() - 0.5) * 2

  bpm =
    Math.max(60,
      Math.min(90, bpm))

  spo2 +=
    (Math.random() - 0.5) * 0.2

  systolic =
    118 + Math.floor(Math.random() * 8)

  diastolic =
    78 + Math.floor(Math.random() * 6)
}

setInterval(() => {

  updateVitals()

}, 3000)

function resizeCanvas() {

  canvas.width = canvas.clientWidth

  canvas.height = canvas.clientHeight

  drawECG()
}

resizeCanvas()

window.addEventListener('resize', resizeCanvas)

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

roleBtn.onclick = () => {

  isTransmitter = !isTransmitter

  localEcgData = []
  remoteEcgData = []

  updateUI()
}

ecgBtn.onclick = () => {

  ecgEnabled = !ecgEnabled

  updateUI()
}

fullscreenBtn.onclick = () => {

  fullscreenEcg = !fullscreenEcg

  document.body.classList.toggle(
    'fullscreen-ecg',
    fullscreenEcg
  )

  setTimeout(() => {

    resizeCanvas()

    drawECG()

  }, 50)
}

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

  remoteEcgData = []
  remoteBpm = 0
  remoteSpo2 = 0
  remoteSystolic = 0
  remoteDiastolic = 0
  heartbeatFlash = 0
}

function updateUI() {

  if (reconnecting) {

    joinBtn.innerText = 'RECONNECT'
    leaveBtn.disabled = true
    return

  }

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

  document.title =
    isTransmitter
      ? 'Mesh Monitor TX'
      : 'Mesh Monitor RX'

  ecgBtn.innerText =
    ecgEnabled ? 'ECG ON' : 'ECG OFF'

  roleBtn.innerText =
    isTransmitter
      ? 'MODE: TX'
      : 'MODE: RX'
}

function generateECGPoint(t) {

  const fps = 60

  const samplesPerBeat =
    (60 / bpm) * fps

  const phase =
    t % samplesPerBeat

  function gaussian(
    x,
    center,
    width,
    amplitude
  ) {
    return amplitude *
      Math.exp(
        -Math.pow(x - center, 2) /
        (2 * width * width)
      )
  }

  // Normalize positions
  const pPos =
    samplesPerBeat * 0.20

  const qPos =
    samplesPerBeat * 0.40

  const rPos =
    samplesPerBeat * 0.45

  const sPos =
    samplesPerBeat * 0.50

  const tPos =
    samplesPerBeat * 0.70

  const p =
    gaussian(phase, pPos, 4, 4)

  const q =
    gaussian(phase, qPos, 2, -8)

  const r =
    gaussian(phase, rPos, 1.5, 35)

  const s =
    gaussian(phase, sPos, 2, -12)

  const tw =
    gaussian(phase, tPos, 8, 10)

  const baseline =
    Math.sin(t * 0.01) * 1.2

  const noise =
    (Math.random() - 0.5) * 0.5

  return (
    p +
    q +
    r +
    s +
    tw +
    baseline +
    noise
  )
}

function drawECG() {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )

  // GRID

  ctx.strokeStyle = '#113311'
  ctx.lineWidth = 1


  for (let x = 0; x < canvas.width; x += 25) {

    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }


  const uiScale =
    fullscreenEcg
      ? 1.8
      : canvas.height / 300

  ctx.lineWidth =
    fullscreenEcg
      ? 3
      : 2

  for (let y = 0; y < canvas.height; y += 25) {

    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(
      canvas.width,
      y
    )
    ctx.stroke()
  }

  const scale =
    canvas.height / 120

  const centerY = canvas.height / 2

  const data =
    isTransmitter
      ? localEcgData
      : remoteEcgData

  ctx.beginPath()

  ctx.strokeStyle =
    isTransmitter
      ? '#00ff00'
      : '#ffaa00'

  ctx.lineWidth = 2

  ctx.fillStyle = '#00ff00'
  ctx.font = '20px Arial'

  /*  ctx.fillText(
      isTransmitter
        ? 'LOCAL ECG'
        : 'REMOTE ECG',
      20,
      30
    )*/
  ctx.fillStyle = '#00ff00'

  ctx.font =
    `${18 * uiScale}px Arial`

  const displayBpm =
    isTransmitter ? bpm : remoteBpm

  const displaySpo2 =
    isTransmitter ? spo2 : remoteSpo2

  const displaySys =
    isTransmitter
      ? systolic
      : remoteSystolic

  const displayDia =
    isTransmitter
      ? diastolic
      : remoteDiastolic

  ctx.fillText(
    `HR ${Math.round(displayBpm)} BPM`,
    20 * uiScale,
    30 * uiScale
  )

  ctx.fillText(
    `SpO2 ${Math.round(displaySpo2)}%`,
    20 * uiScale,
    60 * uiScale
  )

  ctx.fillText(
    `BP ${Math.round(displaySys)}/${Math.round(displayDia)}`,
    20 * uiScale,
    90 * uiScale
  )



  ctx.shadowColor = '#00ff00'
  ctx.shadowBlur = 10

  ctx.save()

  const radius =
    10 + heartbeatFlash * 8

  ctx.beginPath()

  ctx.arc(
    canvas.width - 40,
    40,
    radius,
    0,
    Math.PI * 2
  )

  ctx.fillStyle =
    `rgba(0,255,0,${0.3 + heartbeatFlash
    })`

  ctx.shadowColor = '#00ff00'

  ctx.shadowBlur =
    10 + heartbeatFlash * 20

  ctx.fill()

  ctx.restore()

  ctx.fillStyle = '#888'

  ctx.font = '16px Arial'

  ctx.fillText(
    new Date().toLocaleTimeString(),
    canvas.width - 120,
    30
  )
  for (let i = 0; i < data.length; i++) {


    const x = i * horizontalScale

    const y =
      centerY -
      data[i] * scale


    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()

}

let t = 0

setInterval(() => {

  heartbeatFlash *= 0.90

  drawECG()

  if (!ecgEnabled) {
    return
  }

  if (!isTransmitter) {
    return
  }

  const point = generateECGPoint(t)

  if (
    point > 25 &&
    previousLocalPoint <= 25
  ) {
    heartbeatFlash = 1
  }

  previousLocalPoint = point

  t++

  localEcgData.push(point)

  if (
    localEcgData.length >
    canvas.width /
    (
      fullscreenEcg
        ? 4
        : 2.5
    )
  ) {
    localEcgData.shift()
  }

  if (peer) {

    peer.send(JSON.stringify({

      type: 'telemetry',

      ecg: point,

      bpm: bpm,

      spo2: spo2,

      systolic: systolic,

      diastolic: diastolic
    }))
  }

}, 16)


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


  peer.on('data', raw => {

    const msg = JSON.parse(raw)

    if (msg.type === 'telemetry') {

      remoteEcgData.push(msg.ecg)

      if (
        msg.ecg > 25 &&
        previousRemotePoint <= 25
      ) {
        heartbeatFlash = 1
      }

      previousRemotePoint = msg.ecg

      if (remoteEcgData.length > canvas.width /
        (
          fullscreenEcg
            ? 4
            : 2.5
        )) {
        remoteEcgData.shift()
      }

      remoteBpm = msg.bpm
      remoteSpo2 = msg.spo2
      remoteSystolic = msg.systolic
      remoteDiastolic = msg.diastolic



    }
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


socket.on('disconnect', () => {

  reconnecting = true
  isConnected = false

  cleanupPeer()

  updateUI()
})

socket.on('connect', () => {

  reconnecting = false

  if (roomId) {
    socket.emit('join-room', roomId)
  }

  updateUI()
})

setInterval(() => {

  if (
    reconnecting &&
    roomId &&
    socket.connected &&
    !peer
  ) {

    socket.emit(
      'join-room',
      roomId
    )
  }

}, 3000)

window.addEventListener('beforeunload', () => {

  cleanupPeer()

  socket.disconnect()
})