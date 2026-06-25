function toggleMute(stream) {
  stream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled
  })
}

function toggleCamera(stream) {
  stream.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled
  })
}

module.exports = {
  toggleMute,
  toggleCamera
}
