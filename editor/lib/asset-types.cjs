// Project asset types added by the plugin (.ngeo, .nrg...): an "Add" entry in the assets
// browser's context menu, what a double click does, and extra context-menu items on the file.
//
// The assets browser renders files it doesn't know with its base item class, whose double click
// and context menu do nothing. Patching that base class (not the specialised items) reaches only
// unknown extensions, so the editor's own asset types are untouched.
const { extname } = require('path');
const { editorModule, editorRequire } = require('./editor-internals.cjs');
const { patchMethod } = require('./patch.cjs');

/**
 * @typedef {object} AssetType
 * @property {string} extension with the dot, lower case.
 * @property {string} label shown in "Add".
 * @property {(directory: string) => Promise<string>} create writes a new asset in the directory.
 * @property {(absolutePath: string) => void} open on double click.
 * @property {(absolutePath: string) => { label: string, action: () => any }[]} [menu] extra items.
 */

/** @type {Map<string, AssetType>} */
const types = new Map();

function registerAssetType(type) {
  types.set(type.extension, type);
  return () => {
    if (types.get(type.extension) === type) types.delete(type.extension);
  };
}

function typeOf(absolutePath) {
  return types.get(extname(absolutePath ?? '').toLowerCase()) ?? null;
}

function report(e, what) {
  console.error(e);
  editorModule('sonner').toast.error(`${what} failed: ${e?.message ?? e}`);
}

/** Patches the assets browser once; features then register their types. */
function installAssetTypes() {
  const React = editorModule('react');
  const h = React.createElement;
  const { AssetsBrowserItem } = editorRequire('build/src/editor/layout/assets-browser/items/item.js');
  const { EditorAssetsBrowser } = editorRequire('build/src/editor/layout/assets-browser.js');
  const { ContextMenuItem, ContextMenuSeparator } = editorRequire('build/src/ui/shadcn/ui/context-menu.js');

  const undo = [
    patchMethod(AssetsBrowserItem.prototype, 'onDoubleClick', (original) =>
      function onDoubleClick() {
        const type = typeOf(this.props.absolutePath);
        if (!type) return original.call(this);
        try {
          type.open(this.props.absolutePath);
        } catch (e) {
          report(e, `Opening ${this.props.absolutePath}`);
        }
      },
    ),
    patchMethod(AssetsBrowserItem.prototype, 'getContextMenuContent', (original) =>
      function getContextMenuContent() {
        const content = original.call(this);
        const type = typeOf(this.props.absolutePath);
        const items = type?.menu?.(this.props.absolutePath) ?? [];
        if (!items.length) return content;
        return h(
          React.Fragment,
          null,
          content,
          ...items.map((item) =>
            h(
              ContextMenuItem,
              {
                key: item.label,
                onClick: () => Promise.resolve().then(item.action).catch((e) => report(e, item.label)),
              },
              item.label,
            ),
          ),
          h(ContextMenuSeparator, { key: 'babylon-editor-tools-separator' }),
        );
      },
    ),
    patchMethod(EditorAssetsBrowser.prototype, '_getAssetsContextMenuItems', (original) =>
      function getAssetsContextMenuItems() {
        const content = original.call(this);
        if (!types.size) return content;
        return h(
          React.Fragment,
          null,
          content,
          h(ContextMenuSeparator, null),
          ...[...types.values()].map((type) =>
            h(
              ContextMenuItem,
              {
                key: type.extension,
                onClick: async () => {
                  const directory = this.state.browsedPath;
                  if (!directory) return;
                  try {
                    await type.create(directory);
                    await this._refreshItems(directory);
                  } catch (e) {
                    report(e, `Creating a ${type.label}`);
                  }
                },
              },
              type.label,
            ),
          ),
        );
      },
    ),
  ];
  return () => undo.forEach((u) => u());
}

module.exports = { registerAssetType, installAssetTypes };
