// @flow

const path = require("path");

const { app, BrowserWindow, protocol } = require("electron");
const isDev = require("electron-is-dev");
const { dialog, ipcMain } = require("electron");
const { resolve } = require("path");
const fsSync = require("fs");
const fs = require("fs").promises;
const { createLogger, format, transports } = require("winston");
const FileType = require("file-type");

require("winston-daily-rotate-file");

const APP_DATA =
  process.env.APPDATA ||
  (process.platform == "darwin"
    ? process.env.HOME + "/Library/Preferences"
    : process.env.HOME + "/.local/share");

const LOG_ROOT = path.join(APP_DATA, "Shabshow", "logs");
const SEEN_HISTORY = path.join(LOG_ROOT, "seen_history.log");
// Guard against infinite loop, try this number of times before giving up
// and sending a known-bad image
const LOOP_GUARD = 250;

let potentialImages = [];
let seenHistory = {};
let nextPhotoIdx = 0;

if (!fsSync.existsSync(LOG_ROOT)) {
  fsSync.mkdirSync(LOG_ROOT, { recursive: true });
}

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "shabshow" },
  transports: [
    new transports.File({
      filename: path.join(LOG_ROOT, "errors.log"),
      level: "error",
      maxSize: "20m",
    }),
    new transports.DailyRotateFile({
      filename: path.join(LOG_ROOT, "/slideshowfiles-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new transports.Console(),
  ],
});

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    setAutoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  // win.loadFile("index.html");
  const mainUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;
  win.loadURL(mainUrl);
  win.on("close", (event) => {
    fsSync.writeFileSync(SEEN_HISTORY, JSON.stringify(seenHistory));
  });

  if (fsSync.existsSync(SEEN_HISTORY)) {
    try {
      seenHistory = JSON.parse(fsSync.readFileSync(SEEN_HISTORY));
    } catch (e) {
      logger.error("couldn't read seen history file", { e });
    }
  }

  logger.info("Opening main page", { mainUrl });

  protocol.registerFileProtocol("atom", (request, callback) => {
    let url = request.url.replace(/^atom:\/\//, "");
    let decoded = "";
    try {
      decoded = decodeURI(url);
    } catch (e) {
      logger.error("sending null due to decode failure", { url });
      callback({ error: -2 });
      return;
    }
    callback({ path: decoded });
  });

  ipcMain.on("select-dir", async (event, arg) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    logger.info("Selected directory", { "result.filePaths": result.filePaths });
    if (result.filePaths.length > 0) {
      win.webContents.send("message", {
        type: "selected-dir",
        payload: result.filePaths[0],
      });
    }
  });

  ipcMain.on("start-slideshow", async (event, directory) => {
    logger.info("Starting slideshow", { directory });
    if (!directory || typeof directory !== "string") {
      dialog.showErrorBox(
        "Couldn't Start Slideshow",
        `Directory not found (${directory})`
      );
      logger.error("Couldn't Start Slideshow, Directory not found", {
        directory,
      });
      return;
    }
    try {
      const dirStat = await fs.stat(directory);
      if (!dirStat.isDirectory()) {
        dialog.showErrorBox(
          "Couldn't Start Slideshow",
          `Provided path is not a directory (${directory})`
        );
        logger.error("Provided path is not a directory", { directory });
        return;
      }
    } catch (e) {
      dialog.showErrorBox(
        "Couldn't Start Slideshow",
        `Provided path is not a directory (${directory})`
      );
      logger.error("Caught: Provided path is not a directory", { directory });
      return;
    }

    potentialImages = await getFiles(directory);
    logger.info("Num potential images: " + potentialImages.length, {
      directory,
    });
    logger.info("Sending slideshow ready indicator", { isDev });
    win.webContents.send("message", {
      type: "slideshow-ready",
    });
  });

  ipcMain.on("report-error", async (event, arg) => {
    logger.error("Error reported loading image", { arg });
  });

  ipcMain.on("mark-seen", async (event, arg) => {
    seenHistory[arg] = Date.now();
  });

  ipcMain.on("request-image", async (event, arg) => {
    if (potentialImages.length == 0) {
      dialog.showErrorBox(
        "Couldn't Start Slideshow",
        `No directory selected, or no images found in directory`
      );
      logger.error("No directory selected, or no images found in directory", {
        potentialImages,
      });
      return;
    }

    let shouldShow = 0;
    let selectionIdx = nextPhotoIdx;
    let file = "";
    while (shouldShow < LOOP_GUARD) {
      if (selectionIdx >= potentialImages.length) {
        logger.info("shuffling array", { selectionIdx, length: potentialImages.length });
        selectionIdx = 0;
        nextPhotoIdx = 0;
        potentialImages = shuffleArray(potentialImages);
      }

      file = potentialImages[selectionIdx];
      const fileInfo = await FileType.fromFile(file);

      try {
        decodeURI(file);
      } catch (e) {
        logger.info(
          "skipping file due to decode failure",
          { fileInfo },
          { file }
        );
      }

      if (fileInfo && fileInfo.mime && fileInfo.mime.startsWith("image")) {
        logger.info(fileInfo);
        break;
      } else {
        logger.info(
          "skipping file due to bad mime type",
          { fileInfo },
          { file }
        );
        shouldShow++;
      }
      selectionIdx++;
    }

    nextPhotoIdx = selectionIdx + 1;

    const lastSeen = file in seenHistory ? seenHistory[file] : 0;
    const lastSeenDelta = Date.now() - lastSeen;
    logger.info("Displaying slideshow file", {
      file,
      selectionIdx,
      totalFiles: potentialImages.length,
      lastSeen: lastSeen,
      lastSeenDelta: lastSeenDelta,
    });

    if (win !== null) {
      try {
        win.webContents.send("message", {
          type: "change-img",
          payload: file,
          lastSeen: lastSeen,
        });
      } catch (e) {
        logger.error("error sending file", {
          error: e,
          file: file,
        });
      }
    } else {
      logger.error("Window is null");
    }
  });

  // Open the DevTools.
  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

async function getFiles(dir) {
  const files = await getFilesImpl(dir);
  return shuffleArray(files);
}

async function getFilesImpl(dir) {
  const imageExts = [".jpeg", ".jpg", ".png", ".webp", ".svg", ".bmp", ".gif"];
  const dirents = await fs.readdir(dir);
  const files = await Promise.all(
    dirents.map(async (dirent) => {
      try {
        const resolved = resolve(dir, dirent);
        const stat = await fs.stat(resolved);
        if (stat.isDirectory()) {
          return getFilesImpl(resolved);
        } else {
          const ext = path.extname(dirent).toLowerCase();
          return imageExts.includes(ext) ? resolved : null;
        }
      } catch (e) {
        logger.error("err detecting / stating file:", {
          dir: resolve(dir, dirent),
        });
      }
    })
  );
  return Array.prototype.concat(...files).filter(Boolean);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  return arr;
}
