// Tools > Inspector: Babylon.js Inspector V2 over the editor's scene (the one in Preview, or the
// played scene while playing), for what the editor's own inspector doesn't show: the scene's
// statistics, textures in GPU memory, frame graph, render targets, debug views...
//
// It must run in the main window, next to the scene it inspects. The bundle is loaded the first
// time it is opened, with the editor's Babylon.js (lib/tool-bundles.cjs).
const { editorModule } = require('../lib/editor-internals.cjs');
const { requireToolBundle } = require('../lib/tool-bundles.cjs');
const { registerToolsMenuItem } = require('../lib/tools-menu.cjs');

let token = null;

function close() {
  token?.dispose?.();
  token = null;
}

function toggle(editor) {
  if (token) {
    close();
  } else {
    const scene = editor.layout.preview.play?.scene ?? editor.layout.preview.scene;
    const { ShowInspector } = requireToolBundle('babylonjs-inspector');
    // Over the Preview panel only (without a container it covers the whole editor window). The
    // engine renders to a detached working canvas and the editor shows it on preview.canvas.
    const containerElement = editor.layout.preview.canvas?.parentElement ?? undefined;
    token = ShowInspector(scene, {
      containerElement,
      layoutMode: 'overlay',
      themeMode: 'dark',
      disableTeachingMoments: true,
    });
    token.onDisposed?.addOnce?.(() => {
      token = null;
      editor.forceUpdate?.();
    });
  }
  editor.forceUpdate?.();
}

function install(editor) {
  const unregister = registerToolsMenuItem({
    label: 'Inspector',
    checked: () => !!token,
    action: () => {
      try {
        toggle(editor);
      } catch (e) {
        console.error(e);
        editorModule('sonner').toast.error(`Inspector failed to open: ${e?.message ?? e}`);
      }
    },
  });
  return () => {
    unregister();
    close();
  };
}

module.exports = { name: 'Inspector V2', install };
