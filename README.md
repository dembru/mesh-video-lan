# Mesh Video LAN

Mesh Video LAN is a local-network video calling prototype built with Electron,
WebRTC, Socket.IO, and Simple Peer. It is designed for peer-to-peer audio/video
calls on a LAN, with a small signaling server and an Electron desktop client.

The desktop client also includes a simulated ECG/vitals monitor. In transmitter
mode it generates telemetry data and sends it over the WebRTC data channel; in
receiver mode it displays telemetry received from the connected peer.

## Features

- Peer-to-peer video and audio over WebRTC
- LAN-oriented signaling with Socket.IO
- Electron desktop client
- Room-based peer matching
- Simulated ECG waveform
- Simulated vitals: heart rate, SpO2, and blood pressure
- Transmitter and receiver startup modes
- No cloud service required
- No TURN server configured by default

## Project Structure

```text
mesh-video-lan/
  package.json              Root helper scripts
  start-all.bat             Windows helper to start server and client
  signaling-server/         Express + Socket.IO signaling server
    server.js
    rooms.js
    package.json
  desktop-app/              Electron WebRTC client
    main.js
    index.html
    renderer.js
    preload.js
    style.css
    ui/
      controls.js
      notifications.js
```

## Requirements

- Node.js
- npm
- A camera and microphone for video/audio calls
- Two clients on the same reachable network

## Install

Install dependencies for both parts of the project:

```bash
cd signaling-server
npm install

cd ../desktop-app
npm install
```

## Run

Start the signaling server:

```bash
cd signaling-server
npm start
```

Start the desktop client in another terminal:

```bash
cd desktop-app
npm start
```

From the root directory, you can also run:

```bash
npm run server
npm run client
```

On Windows, `start-all.bat` starts both parts in separate command windows.

## Client Modes

The desktop client supports two startup modes:

```bash
npm run tx
npm run rx
```

- `tx`: transmitter mode, generates and sends simulated ECG/vitals data.
- `rx`: receiver mode, displays ECG/vitals data received from the peer.

The role can also be toggled from the app UI.

## Connecting Peers

1. Start the signaling server.
2. Start the Electron client on each machine.
3. Make sure both clients are configured to reach the signaling server.
4. Enter the same room ID on both clients.
5. Click `JOIN`.

When a second peer joins the room, the clients exchange WebRTC signaling through
the server and then communicate peer-to-peer.

## Network Configuration

The signaling server listens on port `3000`:

```text
http://<server-ip>:3000
```

The current client code contains a hard-coded signaling server URL in
`desktop-app/renderer.js`. Update that URL to match the machine running the
signaling server before connecting from another device.

This project intentionally configures WebRTC with no STUN or TURN servers. That
keeps the prototype LAN-focused, but it means calls may fail across NATs,
different networks, VPNs, or restrictive firewalls.

## Notes

- This is an MVP/prototype, not a hardened production app.
- Electron is currently configured with Node integration enabled and context
  isolation disabled for simplicity.
- The ECG and vitals data are simulated and should not be used for medical
  purposes.
- There are no automated tests configured yet.

