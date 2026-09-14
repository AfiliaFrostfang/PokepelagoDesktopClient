const { app, BrowserWindow } = require('electron')
const path = require('path')
const { PROTOCOL, connectionSearchFromUrl, findProtocolUrl } = require('./protocol.cjs')

const DEV_SERVER = 'http://localhost:5173'

let mainWindow = null
let pendingUrl = null

function loadContent(win, search) {
  if (process.argv.includes('--dev')) {
    win.loadURL(DEV_SERVER + (search || ''))
    return
  }
  // loadFile's `search` option appends the query string to the app's file URL.
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), search ? { search } : undefined)
}

function createWindow(search = '') {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadContent(mainWindow, search)

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  return mainWindow
}

function focusWithUrl(rawUrl) {
  const search = connectionSearchFromUrl(rawUrl)
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadContent(mainWindow, search)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    return true
  }
  if (app.isReady()) {
    createWindow(search)
    return true
  }
  pendingUrl = rawUrl
  return false
}

// Register pokepelago:// so the OS can route slot links here.
try {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
} catch (error) {
  console.warn(`Could not register the ${PROTOCOL}:// protocol`, error)
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = findProtocolUrl(commandLine)
    if (url) {
      focusWithUrl(url)
      return
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // macOS delivers protocol links through open-url rather than argv.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (!focusWithUrl(url)) pendingUrl = url
  })

  app.whenReady().then(() => {
    const initial = findProtocolUrl(process.argv)
    createWindow(initial ? connectionSearchFromUrl(initial) : '')

    if (pendingUrl) {
      focusWithUrl(pendingUrl)
      pendingUrl = null
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
