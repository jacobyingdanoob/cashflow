const { app, BrowserWindow, Menu, net, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const origin = "cashflow://app";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "cashflow",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

// Keep the same save directory and origin when the portable EXE is moved or updated.
app.setName("Cashflow");
app.setAppUserModelId("com.cashflow.game");
const saveDirectory =
  app.commandLine.getSwitchValue("user-data-dir") ||
  path.join(app.getPath("appData"), "Cashflow");
fs.mkdirSync(saveDirectory, { recursive: true });
app.setPath("userData", saveDirectory);

function openSource(url) {
  try {
    if (new URL(url).protocol === "https:") void shell.openExternal(url);
  } catch {
    // Ignore invalid links rather than handing them to the operating system.
  }
}

async function serveGame(request) {
  const url = new URL(request.url);
  if (url.hostname !== "app") return new Response("Not found", { status: 404 });
  const root = path.join(app.getAppPath(), "dist");
  let file;
  try {
    file = path.resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!file.startsWith(root + path.sep))
    return new Response("Forbidden", { status: 403 });
  try {
    const response = await net.fetch(pathToFileURL(file).href);
    const headers = new Headers(response.headers);
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

let gameWindow;
function createWindow() {
  gameWindow = new BrowserWindow({
    title: "Cashflow",
    width: 1440,
    height: 1000,
    minWidth: 800,
    minHeight: 620,
    backgroundColor: "#f6f6f2",
    icon: path.join(__dirname, "icon.ico"),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  gameWindow.webContents.setWindowOpenHandler(({ url }) => {
    openSource(url);
    return { action: "deny" };
  });
  gameWindow.webContents.on("will-navigate", (event, url) => {
    const destination = new URL(url);
    if (
      destination.protocol !== "cashflow:" ||
      destination.hostname !== "app"
    ) {
      event.preventDefault();
      openSource(url);
    }
  });
  gameWindow.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  gameWindow.once("ready-to-show", () => gameWindow.show());
  gameWindow.on("closed", () => {
    gameWindow = null;
  });
  void gameWindow.loadURL(origin + "/");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (gameWindow) {
      if (gameWindow.isMinimized()) gameWindow.restore();
      gameWindow.show();
      gameWindow.focus();
    }
  });
  app.whenReady().then(() => {
    protocol.handle("cashflow", serveGame);
    Menu.setApplicationMenu(null);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
