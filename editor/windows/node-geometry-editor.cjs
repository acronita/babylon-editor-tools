// Node Geometry Editor window (opened by features/node-geometry.cjs), editing one .ngeo file.
const fs = require('fs');
const { basename } = require('path');
const { ipcRenderer } = require('electron');
const { editorModule } = require('../lib/editor-internals.cjs');
const { requireToolBundle } = require('../lib/tool-bundles.cjs');
const { createToolWindow } = require('../lib/window-shell.cjs');

exports.default = createToolWindow({
  title: 'Node Geometry Editor',
  async mount({ host, props }) {
    const BABYLON = editorModule('babylonjs');
    const { toast } = editorModule('sonner');
    const { NodeGeometryEditor } = requireToolBundle('babylonjs-node-geometry-editor');

    const geometry = BABYLON.NodeGeometry.Parse(JSON.parse(await fs.promises.readFile(props.filePath, 'utf8')));

    async function save() {
      try {
        geometry.build();
        const json = geometry.serialize();
        await fs.promises.writeFile(props.filePath, `${JSON.stringify(json, null, '\t')}\n`);
        ipcRenderer.send('editor:asset-updated', 'node-geometry', { filePath: props.filePath, json });
        toast.success(`Saved ${basename(props.filePath)}`);
      } catch (e) {
        console.error(e);
        toast.error(`Saving failed: ${e?.message ?? e}`);
      }
    }

    NodeGeometryEditor.Show({ nodeGeometry: geometry, hostElement: host, customSave: { label: 'Save', action: save } });
    return { save };
  },
});
