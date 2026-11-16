// The frame of a tool window, matching the editor's own tool windows: its toolbar (title, window
// buttons, drag area), a host element for the tool, toasts, dark theme, Ctrl+S and closing.
// Runs in the tool window's renderer, not in the editor's main window.
const { basename } = require('path');
const { ipcRenderer } = require('electron');
const { editorModule, editorRequire } = require('./editor-internals.cjs');

/**
 * @param {object} config
 * @param {string} config.title shown in the window's toolbar.
 * @param {(args: { host: HTMLElement, props: object }) => Promise<{ save?: () => any, dispose?: () => void }>} config.mount
 */
function createToolWindow({ title, mount }) {
  const React = editorModule('react');
  const h = React.createElement;
  const { ToolbarComponent } = editorRequire('build/src/ui/toolbar.js');
  const { Toaster } = editorRequire('build/src/ui/shadcn/ui/sonner.js');

  return class ToolWindow extends React.Component {
    constructor(props) {
      super(props);
      this.host = null;
      this.session = null;
      this.state = { error: null };
      this.onSave = () => this.session?.save?.();
      this.onClose = () => ipcRenderer.send('window:close');
    }

    render() {
      const file = this.props.filePath ? basename(this.props.filePath) : null;
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'flex flex-col w-screen h-screen' },
          h(
            ToolbarComponent,
            null,
            h(
              'div',
              { className: 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
              h(
                'div',
                { className: 'flex items-center gap-1 font-semibold text-lg select-none' },
                title,
                file && h('div', { className: 'text-sm font-thin' }, `(${file})`),
              ),
            ),
          ),
          h(
            'div',
            { className: 'relative w-full h-full overflow-hidden' },
            h('div', {
              ref: (r) => {
                this.host = r;
              },
              className: 'absolute inset-0',
            }),
            this.state.error &&
              h(
                'pre',
                { className: 'absolute inset-0 p-4 overflow-auto text-xs text-red-400 bg-background whitespace-pre-wrap' },
                `${title} failed to open:\n\n${this.state.error}`,
              ),
          ),
        ),
        h(Toaster, null),
      );
    }

    async componentDidMount() {
      // The node editors only have a dark theme.
      document.body.classList.add('dark');
      ipcRenderer.on('save', this.onSave);
      ipcRenderer.on('editor:close-window', this.onClose);
      try {
        this.session = await mount({ host: this.host, props: this.props });
      } catch (e) {
        console.error(e);
        this.setState({ error: e?.stack ?? String(e) });
      }
    }

    componentWillUnmount() {
      ipcRenderer.off('save', this.onSave);
      ipcRenderer.off('editor:close-window', this.onClose);
      this.session?.dispose?.();
    }
  };
}

module.exports = { createToolWindow };
