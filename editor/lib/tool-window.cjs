// Opens a tool in its own editor window, the way the editor opens its Node Material, GUI and Node
// Particle editors.
//
// The editor's "window:open" message takes the window's entry module as a path relative to the
// editor's app path (app.asar) and requires `<app path>/<entry>` in a fresh window that has Node
// access, then renders the module's default export (a React component) with the given options.
// A path that climbs out of app.asar with "../" reaches a module of this plugin, even on another
// drive. The editor posix-joins the app path as Electron returns it, with native separators: on
// Windows "D:\...\app.asar" is a single posix segment, so one "../" climbs out of it, and
// posix-joining it with "../C:/x" gives "C:/x". On macOS/Linux there is one segment per folder.
//
// A separate window is a separate renderer process: a tool that crashes or leaks cannot take the
// editor's main window with it. The window talks back with "editor:asset-updated", which the
// editor relays to its other windows.
const { ipcRenderer } = require('electron');
const { ASAR } = require('./editor-internals.cjs');

const toPosix = (path) => path.split('\\').join('/');

function windowEntryPath(absoluteFile) {
  // ASAR is built like Electron's app.getAppPath() (native separators); count segments the way
  // path.posix does, splitting on "/" only.
  const depth = ASAR.split('/').filter(Boolean).length;
  return '../'.repeat(depth) + toPosix(absoluteFile).replace(/^\/+/, '');
}

/**
 * @param {string} absoluteFile the window module (exports default a React component).
 * @param {object} options props given to that component (must be serializable).
 */
function openToolWindow(absoluteFile, options = {}) {
  ipcRenderer.send('window:open', windowEntryPath(absoluteFile), options);
}

module.exports = { openToolWindow, windowEntryPath };
