// Tools > Flow Graph Editor: opens the hosted Flow Graph Editor in an editor window (see
// windows/flow-graph-editor.cjs for why it is the website).
const { join } = require('path');
const { registerToolsMenuItem } = require('../lib/tools-menu.cjs');
const { openToolWindow } = require('../lib/tool-window.cjs');

const WINDOW = join(__dirname, '..', 'windows', 'flow-graph-editor.cjs');

function install() {
  return registerToolsMenuItem({ label: 'Flow Graph Editor (online)', action: () => openToolWindow(WINDOW) });
}

module.exports = { name: 'Flow Graph Editor', install };
