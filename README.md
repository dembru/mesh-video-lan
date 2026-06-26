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
- Resilient signaling reconnect with room rejoin
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

By default, the client connects to:

```text
http://localhost:3000
```

For a client running on another LAN machine, pass the signaling server address:

```bash
npm start -- --server-url=http://<server-ip>:3000
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

## Connection Resilience

The signaling server is only used to discover peers and exchange WebRTC session
messages. After the WebRTC peer connection is established, media and telemetry
continue peer-to-peer.

The client is designed to tolerate temporary signaling link loss:

- Socket.IO reconnects indefinitely with capped retry delay and jitter.
- A live WebRTC peer is preserved when the signaling socket disconnects.
- The UI shows `SIGNAL LOST` when peer media may still be alive but signaling is
  temporarily unavailable.
- After signaling reconnects, the client rejoins the previous room with an
  acknowledgement and retries if the room join times out.
- Pending WebRTC signaling messages are queued while room membership is not yet
  confirmed, then flushed after rejoin.
- Intentional room leaves are separated from accidental disconnects so a short
  server outage does not force both clients to tear down an active call.

If the WebRTC peer connection itself fails, the app can renegotiate when both
clients are back in the same room.

- When a peer rejoins after a network disruption, it initiates a new WebRTC
  offer if existing peers are already in the room but no active connection
  exists.
- The `peer-joined` handler detects stale ICE connections (disconnected, failed,
  or closed) and tears them down to force renegotiation, ensuring the local side
  reconnects even if Simple Peer still reports the old peer as connected.

## Network Configuration

The signaling server listens on port `3000`:

```text
http://<server-ip>:3000
```

The desktop client defaults to `http://localhost:3000`. When the signaling
server is on another machine, start the client with
`--server-url=http://<server-ip>:3000`.

This project intentionally configures WebRTC with no STUN or TURN servers. That
keeps the prototype LAN-focused, but it means calls may fail across NATs,
different networks, VPNs, or restrictive firewalls.

## Development Checks

There is no full automated test suite yet. For a quick syntax check of the
authored JavaScript files, run:

```bash
node --check signaling-server/server.js
node --check signaling-server/rooms.js
node --check desktop-app/main.js
node --check desktop-app/renderer.js
node --check desktop-app/ui/controls.js
```

## Notes

- This is an MVP/prototype, not a fully hardened production app.
- Electron is currently configured with Node integration enabled and context
  isolation disabled for simplicity.
- The ECG and vitals data are simulated and should not be used for medical
  purposes.
- There are no automated tests configured yet.
