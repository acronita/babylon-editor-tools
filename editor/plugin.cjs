// Babylon.js Editor (5.5) plugin: brings the Babylon.js web tools the editor lacks into it, wired
// to the project's assets and scene.
//
// Add it to project.bjseditor:  "plugins": [{ "nameOrPath": "babylon-editor-tools/editor" }]
// (installed in the project's node_modules), or with an absolute path to this folder (the editor
// then reloads the plugin when its files change).
//
// It relies on editor internals (module paths inside app.asar, React components of the layout,
// the "window:open" message), checked against Babylon.js Editor 5.5.3. On another version it still
// loads, says so in the console, and each feature that fails to install reports itself alone.
const { editorVersion } = require('./lib/editor-internals.cjs');

exports.title = 'Babylon Editor Tools';
exports.description = 'Babylon.js web tools the editor lacks, wired to the project.';

const TESTED_EDITOR_VERSION = '5.5.3';

// Each feature: { name, install(editor) => dispose }.
const FEATURES = [require('./features/convert-to-node-material.cjs')];

// One install per editor process, whichever copy of the plugin loads (or reloads) last.
const KEY = Symbol.for('babylon-editor-tools.disposers');

exports.main = function main(editor) {
  exports.close();
  const disposers = [];
  globalThis[KEY] = disposers;

  const version = editorVersion();
  if (version !== TESTED_EDITOR_VERSION) {
    editor.layout.console.warn(
      `Babylon Editor Tools: tested with editor ${TESTED_EDITOR_VERSION}, running ${version}. Features that fail are listed below.`,
    );
  }
  const installed = [];
  for (const feature of FEATURES) {
    try {
      disposers.push(feature.install(editor));
      installed.push(feature.name);
    } catch (e) {
      console.error(e);
      editor.layout.console.error(`Babylon Editor Tools: ${feature.name} is unavailable (${e?.message ?? e}).`);
    }
  }
  if (installed.length) editor.layout.console.log(`Babylon Editor Tools: ${installed.join(', ')}.`);
};

exports.close = function close() {
  const disposers = globalThis[KEY];
  globalThis[KEY] = null;
  for (const dispose of disposers ?? []) {
    try {
      dispose?.();
    } catch (e) {
      console.error(e);
    }
  }
};
