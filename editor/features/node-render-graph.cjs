// Node Render Graph assets (.nrg): frame graphs (custom render pipelines) edited in the Node
// Render Graph Editor. Assets browser > Add > Node Render Graph creates one, a double click opens
// the editor window.
//
// The editor's own viewport keeps its renderer: a render graph replaces the scene's rendering and
// the editor's gizmos, picking and post-processes rely on it. The game applies the graph at
// runtime (see the README).
const { join } = require('path');
const fs = require('fs');
const { editorRequire } = require('../lib/editor-internals.cjs');
const { registerAssetType } = require('../lib/asset-types.cjs');
const { openToolWindow } = require('../lib/tool-window.cjs');

const EXTENSION = '.nrg';
const WINDOW = join(__dirname, '..', 'windows', 'node-render-graph-editor.cjs');

async function create(directory) {
  const { findAvailableFilename } = editorRequire('build/src/tools/fs.js');
  const fileName = await findAvailableFilename(directory.split('\\').join('/'), 'New Render Graph', EXTENSION);
  // Building a render graph needs an engine; the editor window fills an empty file with the
  // default graph the first time it opens it.
  await fs.promises.writeFile(join(directory, fileName), '{}\n');
  return fileName;
}

function install() {
  return registerAssetType({
    extension: EXTENSION,
    label: 'Node Render Graph',
    create,
    open: (absolutePath) => openToolWindow(WINDOW, { filePath: absolutePath }),
  });
}

module.exports = { name: 'Node Render Graph Editor', install, EXTENSION };
