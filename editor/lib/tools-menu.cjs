// A "Tools" menu in the editor's menu bar, before "Help", for tools that are not assets
// (Flow Graph Editor, Inspector).
const { editorModule, editorRequire } = require('./editor-internals.cjs');
const { patchMethod } = require('./patch.cjs');

/** @type {{ label: string, action: () => any, checked?: () => boolean }[]} */
const items = [];

function registerToolsMenuItem(item) {
  items.push(item);
  return () => {
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);
  };
}

function installToolsMenu(editor) {
  const React = editorModule('react');
  const h = React.createElement;
  const menubar = editorRequire('build/src/ui/shadcn/ui/menubar.js');
  const { EditorToolbar } = editorRequire('build/src/editor/layout/toolbar.js');

  const toolsMenu = () =>
    h(
      menubar.MenubarMenu,
      { key: 'babylon-editor-tools' },
      h(menubar.MenubarTrigger, null, 'Tools'),
      h(
        menubar.MenubarContent,
        { className: 'border-black/50' },
        ...items.map((item) =>
          item.checked
            ? h(menubar.MenubarCheckboxItem, { key: item.label, checked: item.checked(), onClick: item.action }, item.label)
            : h(menubar.MenubarItem, { key: item.label, onClick: item.action }, item.label),
        ),
      ),
    );

  const undo = patchMethod(EditorToolbar.prototype, '_getToolbar', (original) =>
    function getToolbar() {
      const toolbar = original.call(this);
      const bar = toolbar?.props?.children;
      const children = bar?.props?.children;
      if (!items.length || !Array.isArray(children)) return toolbar;
      // The last menu is "Help".
      const next = [...children.slice(0, -1), toolsMenu(), children[children.length - 1]];
      return React.cloneElement(toolbar, null, React.cloneElement(bar, null, ...next));
    },
  );
  editor.forceUpdate?.();
  return () => {
    undo();
    editor.forceUpdate?.();
  };
}

module.exports = { registerToolsMenuItem, installToolsMenu };
