// Flow Graph Editor window: the hosted editor (flowgraph.babylonjs.com) in an editor window.
//
// It ships only as a website (no npm package) and is built against Babylon.js's development
// version, so it runs online, in a cross-origin frame without Node access, and talks to the
// project only through its own Load/Save file dialogs.
const { createToolWindow } = require('../lib/window-shell.cjs');

const URL = 'https://flowgraph.babylonjs.com';

exports.default = createToolWindow({
  title: 'Flow Graph Editor',
  async mount({ host }) {
    const frame = document.createElement('iframe');
    frame.src = URL;
    frame.title = 'Flow Graph Editor';
    frame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#1e1e1e';
    host.appendChild(frame);
    return {
      dispose() {
        frame.remove();
      },
    };
  },
});
