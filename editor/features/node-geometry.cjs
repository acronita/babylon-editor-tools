// Node Geometry assets (.ngeo): procedural meshes edited in the Node Geometry Editor.
//
// - Assets browser > Add > Node Geometry creates one; a double click opens the editor window.
// - "Add to Scene" on the file builds a mesh from it. The mesh remembers its source
//   (metadata.nodeGeometry), and saving in the Node Geometry Editor rebuilds every such mesh, like
//   a Unity prefab updating its instances.
// - The mesh keeps its baked geometry in the scene, so the game needs nothing at runtime.
const { join, basename, relative, dirname } = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const { editorModule, editorRequire } = require('../lib/editor-internals.cjs');
const { registerAssetType } = require('../lib/asset-types.cjs');
const { openToolWindow } = require('../lib/tool-window.cjs');

const EXTENSION = '.ngeo';
const UPDATE_TYPE = 'node-geometry';
const WINDOW = join(__dirname, '..', 'windows', 'node-geometry-editor.cjs');

const toPosix = (path) => path.split('\\').join('/');

function projectRelative(absolutePath) {
  const { projectConfiguration } = editorRequire('build/src/project/configuration.js');
  return toPosix(relative(dirname(projectConfiguration.path), absolutePath));
}

function buildGeometry(json) {
  const BABYLON = editorModule('babylonjs');
  const geometry = BABYLON.NodeGeometry.Parse(json);
  geometry.build();
  return geometry;
}

async function create(directory) {
  const BABYLON = editorModule('babylonjs');
  const { findAvailableFilename } = editorRequire('build/src/tools/fs.js');
  const geometry = new BABYLON.NodeGeometry('New Node Geometry');
  geometry.setToDefault();
  // serialize() lists the blocks a build attached; before build() it writes none.
  geometry.build();
  const fileName = await findAvailableFilename(toPosix(directory), 'New Node Geometry', EXTENSION);
  await fs.promises.writeFile(join(directory, fileName), `${JSON.stringify(geometry.serialize(), null, '\t')}\n`);
  geometry.dispose();
  return fileName;
}

async function addToScene(editor, absolutePath) {
  const { configureAddedMesh } = editorRequire('build/src/project/add/configure.js');
  const json = JSON.parse(await fs.promises.readFile(absolutePath, 'utf8'));
  const geometry = buildGeometry(json);
  const mesh = geometry.createMesh(basename(absolutePath, EXTENSION), editor.layout.preview.scene);
  geometry.dispose();
  if (!mesh) throw new Error('The node geometry built no mesh (is its output connected?).');
  mesh.metadata = { ...(mesh.metadata ?? {}), nodeGeometry: projectRelative(absolutePath) };
  configureAddedMesh(editor, mesh);
}

/** Rebuilds every scene mesh made from the saved file. */
function refreshMeshes(editor, absolutePath, json) {
  const source = projectRelative(absolutePath);
  const meshes = editor.layout.preview.scene.meshes.filter((m) => m.metadata?.nodeGeometry === source);
  if (!meshes.length) return;
  const geometry = buildGeometry(json);
  const vertexData = geometry.vertexData;
  for (const mesh of meshes) {
    if (vertexData) vertexData.applyToMesh(mesh, true);
    mesh.refreshBoundingInfo?.();
  }
  geometry.dispose();
  editorModule('sonner').toast.success(`Rebuilt ${meshes.length} mesh${meshes.length === 1 ? '' : 'es'} from ${basename(absolutePath)}.`);
}

function install(editor) {
  const unregister = registerAssetType({
    extension: EXTENSION,
    label: 'Node Geometry',
    create,
    open: (absolutePath) => openToolWindow(WINDOW, { filePath: absolutePath }),
    menu: (absolutePath) => [{ label: 'Add to Scene', action: () => addToScene(editor, absolutePath) }],
  });

  const onUpdated = (_, type, data) => {
    if (type !== UPDATE_TYPE) return;
    try {
      refreshMeshes(editor, data.filePath, data.json);
    } catch (e) {
      console.error(e);
      editorModule('sonner').toast.error(`Rebuilding meshes from ${basename(data.filePath)} failed: ${e?.message ?? e}`);
    }
  };
  ipcRenderer.on('editor:asset-updated', onUpdated);

  return () => {
    unregister();
    ipcRenderer.off('editor:asset-updated', onUpdated);
  };
}

module.exports = { name: 'Node Geometry Editor', install, EXTENSION, UPDATE_TYPE };
