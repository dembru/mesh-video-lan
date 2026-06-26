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

const serverUrlArg =
  process.argv.find(arg =>
    arg.startsWith(
      '--server-url='
    )
  )

const signalingServerUrl =
  serverUrlArg
    ? serverUrlArg.split('=')[1]
    : 'http://localhost:3000'

console.log('SIGNALING SERVER:', signalingServerUrl)

const socket = io(signalingServerUrl, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.3,
  timeout: 5000
})

let reconnecting = false
let signalingConnected = false
let roomJoinTimer = null
let joiningRoom = false
let joinedRoomId = null
let pendingSignals = []

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

  pollWanStatus()
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
  leaveRoom()
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

  pendingSignals = []

  remoteVideo.srcObject = null

  remoteEcgData = []
  remoteBpm = 0
  remoteSpo2 = 0
  remoteSystolic = 0
  remoteDiastolic = 0
  heartbeatFlash = 0
}

function clearRoomJoinTimer() {

  if (roomJoinTimer) {
    clearTimeout(roomJoinTimer)
    roomJoinTimer = null
  }
}

function updateUI() {

  if (reconnecting && !isConnected) {

    joinBtn.innerText = 'RECONNECT'
    leaveBtn.disabled = true
    return

  }

  if (isConnected) {

    joinBtn.classList.add('connected')

    joinBtn.innerText =
      signalingConnected
        ? 'CONNECTED'
        : 'SIGNAL LOST'

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

  if (
    peer &&
    peer.connected
  ) {

    try {
      peer.send(JSON.stringify({

        type: 'telemetry',

        ecg: point,

        bpm: bpm,

        spo2: spo2,

        systolic: systolic,

        diastolic: diastolic
      }))
    } catch (err) {
      console.warn('TELEMETRY SEND FAILED:', err)
    }
  }

}, 16)


function scheduleRoomJoin(delay = 1000) {

  clearRoomJoinTimer()

  if (!roomId) {
    return
  }

  roomJoinTimer = setTimeout(() => {
    joinCurrentRoom()
  }, delay)
}

function joinCurrentRoom() {

  if (
    !roomId ||
    !socket.connected ||
    joiningRoom ||
    joinedRoomId === roomId
  ) {
    return
  }

  joiningRoom = true

  socket.timeout(5000).emit(
    'join-room',
    roomId,
    (err, response) => {

      joiningRoom = false

      if (err || !response || !response.ok) {
        console.warn(
          'ROOM JOIN FAILED:',
          err || response
        )

        scheduleRoomJoin(1500)
        updateUI()
        return
      }

      roomId = response.roomId
      joinedRoomId = response.roomId
      roomInput.value = roomId
      reconnecting = false
      flushPendingSignals()

      // If peers are already in the room and we have no active connection, initiate
      if (
        response.peers &&
        response.peers.length > 1 &&
        (!peer || !peer.connected)
      ) {
        createPeer(true)
      }

      updateUI()
    }
  )
}

function emitSignal(data) {

  if (
    socket.connected &&
    joinedRoomId === roomId
  ) {
    socket.emit('signal', {
      roomId,
      data
    })
    return
  }

  pendingSignals.push(data)

  if (pendingSignals.length > 20) {
    pendingSignals.shift()
  }
}

function flushPendingSignals() {

  if (
    !socket.connected ||
    joinedRoomId !== roomId ||
    pendingSignals.length === 0
  ) {
    return
  }

  const signals = pendingSignals
  pendingSignals = []

  signals.forEach(data => {
    socket.emit('signal', {
      roomId,
      data
    })
  })
}

function leaveRoom() {

  clearRoomJoinTimer()

  const hadRoom = Boolean(roomId)

  roomId = null
  joinedRoomId = null

  cleanupPeer()

  if (
    hadRoom &&
    socket.connected
  ) {
    socket.timeout(3000).emit(
      'leave-room',
      () => {}
    )
  }

  updateUI()
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

    emitSignal(data)
  })


  peer.on('data', raw => {

    let msg

    try {
      msg = JSON.parse(raw)
    } catch (err) {
      console.warn('INVALID PEER DATA:', err)
      return
    }

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

  peer.on('connect', () => {

    console.log('PEER DATA CHANNEL CONNECTED')

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

  const nextRoomId = roomInput.value.trim()

  if (!nextRoomId) {
    return
  }

  clearRoomJoinTimer()

  roomId = nextRoomId
  joinedRoomId = null

  cleanupPeer()

  if (socket.connected) {
    joinCurrentRoom()
  } else {
    socket.connect()
    scheduleRoomJoin(1500)
  }

  console.log('JOINED ROOM:', roomId)
}

socket.off('peer-joined')

socket.on('peer-joined', details => {

  console.log('PEER JOINED', details)

  if (!peer || !peer.connected) {
    createPeer(true)
    return
  }

  // Peer exists and reports connected — check if ICE is actually alive
  const iceState =
    peer._pc &&
    peer._pc.iceConnectionState

  if (
    iceState === 'disconnected' ||
    iceState === 'failed' ||
    iceState === 'closed'
  ) {
    console.warn('STALE PEER DETECTED, RENEGOTIATING')
    createPeer(true)
  }
})

socket.off('signal')

socket.on('signal', payload => {

  console.log('SIGNAL RECEIVED')

  const data =
    payload && payload.data
      ? payload.data
      : payload

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

socket.on('peer-left', details => {

  console.log('PEER LEFT', details)

  if (
    details &&
    details.intentional
  ) {
    cleanupPeer()
  }
})


socket.on('disconnect', reason => {

  reconnecting = true
  signalingConnected = false
  joinedRoomId = null

  console.warn('SIGNALING DISCONNECTED:', reason)
  updateUI()
})

socket.on('connect', () => {

  signalingConnected = true
  reconnecting = false

  if (roomId) {
    joinCurrentRoom()
  }

  updateUI()
})

socket.on('connect_error', err => {

  reconnecting = true
  signalingConnected = false

  console.warn('SIGNALING CONNECT ERROR:', err.message)

  updateUI()
})

socket.io.on('reconnect_attempt', attempt => {

  reconnecting = true
  signalingConnected = false

  console.log('SIGNALING RECONNECT ATTEMPT:', attempt)

  updateUI()
})

socket.io.on('reconnect', () => {

  signalingConnected = true
  reconnecting = false

  if (roomId) {
    joinCurrentRoom()
  }

  updateUI()
})

setInterval(() => {

  if (
    roomId &&
    socket.connected &&
    joinedRoomId !== roomId &&
    !joiningRoom
  ) {

    joinCurrentRoom()
  }

}, 1500)

window.addEventListener('beforeunload', () => {

  clearRoomJoinTimer()

  cleanupPeer()

  socket.disconnect()
})

// WAN status panel

const wanPanel = document.getElementById('wanPanel')
const routerUrl = 'http://192.168.0.1'
const routerAuth = 'admin:WA2108TA000261'

const wanDeviceMap = {
  'ethernet-wan': 'wanSatellite',
  'mdm-4614753b': 'wan5g',
  'wwan-2a:bf:c3:b0:38:fb:2_4G-1': 'wanWifi'
}

function updateWanPanel(devices) {
  for (const [devKey, elemId] of Object.entries(wanDeviceMap)) {
    const el = document.getElementById(elemId)
    const dev = devices[devKey]
    const indicator = el.querySelector('.wan-indicator')
    const statusEl = el.querySelector('.wan-status')

    indicator.className = 'wan-indicator'

    if (!dev) {
      statusEl.textContent = 'not found'
      indicator.classList.add('disconnected')
      continue
    }

    const state = dev.status && dev.status.connection_state
    const summary = dev.status && dev.status.summary

    statusEl.textContent = summary || state || '--'

    if (state === 'connected') {
      indicator.classList.add('connected')
    } else if (summary === 'available') {
      indicator.classList.add('available')
    } else {
      indicator.classList.add('disconnected')
    }
  }
}

async function pollWanStatus() {
  if (!isTransmitter) {
    wanPanel.style.display = 'none'
    return
  }

  wanPanel.style.display = ''

  try {
    const resp = await fetch(routerUrl + '/api/status/wan/devices', {
      headers: {
        'Authorization': 'Basic ' + btoa(routerAuth)
      }
    })

    const json = await resp.json()

    if (json.success && json.data) {
      updateWanPanel(json.data)
    }
  } catch (err) {
    // Router unreachable — mark all disconnected
    for (const elemId of Object.values(wanDeviceMap)) {
      const el = document.getElementById(elemId)
      el.querySelector('.wan-indicator').className = 'wan-indicator disconnected'
      el.querySelector('.wan-status').textContent = 'unreachable'
    }
  }
}

pollWanStatus()
setInterval(pollWanStatus, 5000)
