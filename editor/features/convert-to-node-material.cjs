// "Convert to Node Material" button in the inspector of Standard and PBR materials.
//
// Builds the equivalent node material, saves it as a .material asset (so the inspector's
// "Edit..." and a double click open it in the Node Material Editor), and puts it on every mesh
// that used the original. Undo puts the original back.
const { join, dirname } = require('path');
const fs = require('fs');
const { editorModule, editorRequire } = require('../lib/editor-internals.cjs');
const { patchMethod } = require('../lib/patch.cjs');
const { createNodeMaterialFrom, CONVERTIBLE } = require('../lib/to-node-material.cjs');

const ASSETS_SUBFOLDER = 'materials';

function slotsUsing(scene, material) {
  const slots = [];
  for (const mesh of scene.meshes) {
    if (mesh.material === material) slots.push({ owner: mesh, set: (m) => (mesh.material = m) });
    const multi = mesh.material;
    if (multi?.getClassName?.() === 'MultiMaterial') {
      multi.subMaterials.forEach((sub, index) => {
        if (sub === material) slots.push({ owner: multi, set: (m) => (multi.subMaterials[index] = m) });
      });
    }
  }
  return slots;
}

async function convert(editor, source) {
  const BABYLON = editorModule('babylonjs');
  const { toast } = editorModule('sonner');
  const { findAvailableFilename } = editorRequire('build/src/tools/fs.js');
  const { projectConfiguration } = editorRequire('build/src/project/configuration.js');
  const { registerUndoRedo, onRedoObservable } = editorRequire('build/src/tools/undoredo.js');

  const scene = editor.layout.preview.scene;
  const { material, notes } = createNodeMaterialFrom(BABYLON, source, scene);
  material.id = BABYLON.Tools.RandomId();

  const folder = join(dirname(projectConfiguration.path), 'assets', ASSETS_SUBFOLDER);
  await fs.promises.mkdir(folder, { recursive: true });
  const safeName = (source.name || 'Material').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const fileName = await findAvailableFilename(folder.split('\\').join('/'), safeName, '.material');
  const data = material.serialize();
  data.uniqueId = material.uniqueId;
  await fs.promises.writeFile(join(folder, fileName), `${JSON.stringify(data, null, '\t')}\n`);

  const slots = slotsUsing(scene, source);
  registerUndoRedo({
    executeRedo: true,
    undo: () => slots.forEach((slot) => slot.set(source)),
    redo: () => slots.forEach((slot) => slot.set(material)),
  });
  onRedoObservable.notifyObservers();
  editor.layout.inspector?.forceUpdate?.();
  editor.layout.assets?.refresh?.();

  const where = `assets/${ASSETS_SUBFOLDER}/${fileName}`;
  const used = `${slots.length} mesh${slots.length === 1 ? '' : 'es'}`;
  if (notes.length) {
    toast.warning(`Converted to ${where} (${used}). Not carried over: ${notes.join(', ')}.`, { duration: 10000 });
  } else {
    toast.success(`Converted to ${where} (${used}).`);
  }
}

function install(editor) {
  const React = editorModule('react');
  const h = React.createElement;
  const { Button } = editorRequire('build/src/ui/shadcn/ui/button.js');
  const { EditorMaterialInspectorUtilsComponent } = editorRequire(
    'build/src/editor/layout/inspector/material/components/utils.js',
  );

  return patchMethod(EditorMaterialInspectorUtilsComponent.prototype, 'render', (original) =>
    function render() {
      const content = original.call(this);
      const material = this.props.material;
      if (!material || !CONVERTIBLE.has(material.getClassName())) return content;
      return h(
        'div',
        { className: 'flex flex-col gap-2 w-full' },
        content,
        h(
          Button,
          {
            variant: 'secondary',
            className: 'w-full',
            onClick: () =>
              convert(editor, material).catch((e) => {
                console.error(e);
                editorModule('sonner').toast.error(`Conversion failed: ${e?.message ?? e}`);
              }),
          },
          'Convert to Node Material',
        ),
      );
    },
  );
}

module.exports = { name: 'Convert to Node Material', install, convert };
