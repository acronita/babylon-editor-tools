// Node Render Graph Editor window (opened by features/node-render-graph.cjs), editing one .nrg file.
// Set up like nrge.babylonjs.com: a 1x1 engine and a scene with a camera and two lights host the
// graph; the editor draws its own preview.
const fs = require('fs');
const { basename } = require('path');
const { ipcRenderer } = require('electron');
const { editorModule } = require('../lib/editor-internals.cjs');
const { requireToolBundle } = require('../lib/tool-bundles.cjs');
const { createToolWindow } = require('../lib/window-shell.cjs');

exports.default = createToolWindow({
  title: 'Node Render Graph Editor',
  async mount({ host, props }) {
    const BABYLON = editorModule('babylonjs');
    const { toast } = editorModule('sonner');
    const { NodeRenderGraphEditor } = requireToolBundle('babylonjs-node-render-graph-editor');

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const engine = new BABYLON.Engine(canvas, false, { disableWebGL2Support: false });
    const scene = new BABYLON.Scene(engine);
    new BABYLON.Camera('camera', new BABYLON.Vector3(0, 0, 0), scene);
    new BABYLON.HemisphericLight('light #0', new BABYLON.Vector3(0, 1, 0), scene);
    new BABYLON.DirectionalLight('light #1', new BABYLON.Vector3(0, 1, 0), scene);

    const json = JSON.parse((await fs.promises.readFile(props.filePath, 'utf8')) || '{}');
    const graph = new BABYLON.NodeRenderGraph(basename(props.filePath, '.nrg'), scene);
    if (json.blocks?.length) {
      graph.parseSerializedObject(json);
    } else {
      graph.setToDefault();
    }
    try {
      await graph.buildAsync();
    } catch (e) {
      // Like the hosted editor: an unbuildable graph still opens, so it can be fixed.
      console.warn(e);
    }

    async function save() {
      try {
        const data = graph.serialize();
        await fs.promises.writeFile(props.filePath, `${JSON.stringify(data, null, '\t')}\n`);
        ipcRenderer.send('editor:asset-updated', 'node-render-graph', { filePath: props.filePath, json: data });
        toast.success(`Saved ${basename(props.filePath)}`);
      } catch (e) {
        console.error(e);
        toast.error(`Saving failed: ${e?.message ?? e}`);
      }
    }

    NodeRenderGraphEditor.Show({
      nodeRenderGraph: graph,
      hostElement: host,
      hostScene: scene,
      customSave: { label: 'Save', action: save },
    });

    return {
      save,
      dispose() {
        graph.dispose();
        scene.dispose();
        engine.dispose();
      },
    };
  },
});
