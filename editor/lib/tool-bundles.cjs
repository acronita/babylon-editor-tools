// Loads a Babylon.js tool bundle (babylonjs-node-geometry-editor, ...) against the editor's own
// Babylon.js.
//
// The tool packages depend on "babylonjs" (and some on babylonjs-gui, -loaders...), so npm installs
// copies next to them. Two Babylon.js copies in one renderer means two EngineStores, two class
// identities (instanceof fails across them) and twice the memory. While the bundle loads, every
// "babylonjs*" request that the editor also ships is answered with the editor's module; only what
// the editor lacks (babylonjs-serializers) comes from the plugin's node_modules.
//
// The UMD bundles also require namespaces as "package::BABYLON.Name.Space" (what the global build
// reads as window.BABYLON.Name.Space): that is the package's export at that path.
//
// In the main window the editor itself (build/src/editor/overrides.js) answers any request that
// starts with "babylonjs" with its own babylonjs, so packages the editor lacks are loaded by their
// absolute path from the plugin's node_modules.
const Module = require('module');
const { join } = require('path');
const { ASAR } = require('./editor-internals.cjs');

const editorPaths = [join(ASAR, 'build', 'src')];
const cache = new Map();

function editorResolution(request) {
  if (!/^babylonjs(-[a-z0-9-]+)?$/.test(request)) return null;
  try {
    return require.resolve(request, { paths: editorPaths });
  } catch {
    return null;
  }
}

function pluginResolution(request) {
  if (!request.startsWith('babylonjs')) return null;
  try {
    return require.resolve(request);
  } catch {
    return null;
  }
}

/** Requires `packageName` from the plugin's dependencies, sharing the editor's Babylon.js. */
function requireToolBundle(packageName) {
  if (cache.has(packageName)) return cache.get(packageName);
  const load = Module._load;
  Module._load = function loadShared(request, parent, isMain) {
    const separator = request.indexOf('::');
    if (separator >= 0) {
      let value = loadShared.call(this, request.slice(0, separator), parent, isMain);
      // "BABYLON.Debug" -> exports.Debug (the first segment is the global namespace itself).
      for (const key of request.slice(separator + 2).split('.').slice(1)) value = value?.[key];
      return value;
    }
    return load.call(this, editorResolution(request) ?? pluginResolution(request) ?? request, parent, isMain);
  };
  try {
    const result = require(require.resolve(packageName));
    cache.set(packageName, result);
    return result;
  } finally {
    Module._load = load;
  }
}

module.exports = { requireToolBundle };
