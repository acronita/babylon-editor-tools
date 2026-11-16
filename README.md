# babylon-editor-tools

A [Babylon.js Editor](https://editor.babylonjs.com) (5.5) plugin that brings the Babylon.js web
tools the editor does not ship into it, wired to the project's assets and scene.

The editor already has the Node Material Editor, the GUI Editor and the Node Particle Editor. This
plugin adds what is missing (see [Status](#status)).

## Install

In the editor's project:

```bash
npm i -D github:acronita/babylon-editor-tools
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
- Tool bundles are the official Babylon.js packages, pinned to the Babylon.js version of the editor,
  and loaded against the editor's own Babylon.js (no second copy in memory).
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
| Node Render Graph Editor | `.nrg` assets: Assets > Add > Node Render Graph, double click opens the editor in a window. The editor's viewport keeps its own rendering; the game applies the graph (below). |
| Flow Graph Editor | Tools > Flow Graph Editor (online): the hosted editor in an editor window. It only ships as a website, built on Babylon.js's development version, so it needs internet and loads/saves through its own file dialogs. |
| Inspector V2 | Tools > Inspector V2: Babylon.js Inspector V2 over the Preview panel, on the edited scene (or the played one while playing). Toggle it from the same menu item. |

### Using a render graph in the game

The editor's viewport keeps its usual rendering (its gizmos and picking rely on it). In the game:

```ts
import { NodeRenderGraph } from "@babylonjs/core";

const json = await (await fetch("/scene/assets/my-graph.nrg")).json();
const graph = NodeRenderGraph.Parse(json, scene);
await graph.buildAsync(false, true, true); // build, wait for readiness, set as scene.frameGraph
```

## Debugging

Tool windows have no developer tools. Their errors and warnings are appended to
`babylon-editor-tools.log` in the system temp folder.
