const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

const DEV_URL = process.env.SWAPPLAYS_DESKTOP_URL || "http://localhost:8082";
let staticServer;
let staticServerUrl;

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function serveDesktopBuild(rootDir) {
  return new Promise((resolve) => {
    if (staticServerUrl) {
      resolve(staticServerUrl);
      return;
    }

    staticServer = http.createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      const filePath = path.join(rootDir, cleanPath || "index.html");
      const safePath = filePath.startsWith(rootDir) ? filePath : path.join(rootDir, "index.html");
      const finalPath = fs.existsSync(safePath) && fs.statSync(safePath).isFile()
        ? safePath
        : path.join(rootDir, "index.html");
      const extension = path.extname(finalPath);

      response.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
      fs.createReadStream(finalPath)
        .on("error", () => {
          response.statusCode = 404;
          response.end("Not found");
        })
        .pipe(response);
    });

    staticServer.listen(0, "127.0.0.1", () => {
      const address = staticServer.address();
      staticServerUrl = `http://127.0.0.1:${address.port}/`;
      resolve(staticServerUrl);
    });
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#050506",
    title: "Swap Plays",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setMenuBarVisibility(false);

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const exportedIndex = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(exportedIndex)) {
    const desktopUrl = await serveDesktopBuild(path.dirname(exportedIndex));
    window.loadURL(desktopUrl);
  } else {
    window.loadURL(DEV_URL);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (staticServer) {
    staticServer.close();
    staticServer = undefined;
    staticServerUrl = undefined;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
