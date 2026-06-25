const {
  app,
  BrowserWindow
} = require('electron')

function createWindow() {

  const args = process.argv

  const isTx =
    args.includes('--tx')

  const isRx =
    args.includes('--rx')

  let startupMode = 'tx'

  if (isRx) {
    startupMode = 'rx'
  }

  const serverUrlArg =
    args.find(arg =>
      arg.startsWith('--server-url=')
    )

  const additionalArguments = [
    `--startup-mode=${startupMode}`
  ]

  if (serverUrlArg) {
    additionalArguments.push(serverUrlArg)
  }

  const win = new BrowserWindow({
    width: 1400,
    height: 900,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,

      additionalArguments
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)
