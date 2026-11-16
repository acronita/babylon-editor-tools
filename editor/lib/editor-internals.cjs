// Access to the Babylon.js Editor's own modules from a project plugin.
//
// A plugin is required by the editor's renderer, but from the project's node_modules, so a bare
// `require("react")` would not find the editor's copy. Requiring the editor's files by their
// absolute path inside app.asar returns the very module instances the editor uses (Node caches
// modules by resolved file name), so React elements, toasts and the layout all interoperate.
const { join } = require('path');
const fs = require('fs');

const ASAR = join(process.resourcesPath, 'app.asar');

function editorRequire(relativePath) {
  return require(join(ASAR, relativePath));
}

/** A package the editor depends on, resolved as the editor's own code resolves it ("exports" included). */
function editorModule(name) {
  return require(require.resolve(name, { paths: [join(ASAR, 'build', 'src')] }));
}

const textCache = new Map();

/** Reads a text file shipped inside the editor (UMD bundles of the web tools), once per session. */
function readEditorText(relativePath) {
  let text = textCache.get(relativePath);
  if (text === undefined) {
    text = fs.readFileSync(join(ASAR, relativePath), 'utf8');
    textCache.set(relativePath, text);
  }
  return text;
}

function editorVersion() {
  try {
    return editorRequire('package.json').version;
  } catch {
    return 'unknown';
  }
}

module.exports = { ASAR, editorRequire, editorModule, readEditorText, editorVersion };
