# babylon-editor-tools

A [Babylon.js Editor](https://editor.babylonjs.com) (5.5) plugin that brings the Babylon.js web
tools the editor does not ship into it, wired to the project's assets and scene.

The editor already has the Node Material Editor, the GUI Editor and the Node Particle Editor. This
plugin adds what is missing (see [Status](#status)).

## Install

In the editor's project:

```bash
npm i -D github:lucscout/babylon-editor-tools
```

Then list it in `project.bjseditor`:

```json
"plugins": [{ "nameOrPath": "babylon-editor-tools/editor" }]
```

While developing the plugin, use the absolute path of this repository's `editor` folder as
`nameOrPath` instead: the editor reloads a plugin from a local path when its files change.

## How it works

- Tools open in their own editor windows, the way the editor opens its node editors. A window is a
  separate renderer process, so a tool can't crash or slow down the main window.
- Tool bundles are the official Babylon.js packages, pinned to the Babylon.js version of the editor.
- The plugin patches a few editor classes (assets browser, inspector) to add menu items and
  buttons. Every patch is undone when the plugin closes or reloads.

It relies on editor internals and is checked against **Babylon.js Editor 5.5.3**. On another
version the plugin still loads and reports any feature that fails to install in the editor console.

## Status

| Tool | Status |
| --- | --- |
| Node Material Editor, GUI Editor, Node Particle Editor | Built into the editor |
| Convert to Node Material (PBR, Standard) | Inspector button on Standard and PBR materials: builds the equivalent graph, saves it to `assets/materials/<name>.material` and puts it on every mesh that used the original (undoable). Its inputs show in the inspector. |
| Node Geometry Editor | `.ngeo` assets: Assets > Add > Node Geometry, double click opens the editor in a window, "Add to Scene" on the file builds a mesh. Saving rebuilds every mesh made from that file. The geometry is baked in the scene (nothing needed at runtime). |
| Node Render Graph Editor | Planned |
| Flow Graph Editor | Planned |
| Inspector V2 | Planned |
