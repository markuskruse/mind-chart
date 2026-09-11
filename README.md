# Mind Chart

A Tauri 2 desktop mind-map editor with React, TypeScript, Vite, and React Flow.

## Development

Install Node.js, Rust, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system, then:

```sh
npm install
npm run tauri dev
```

To build native Linux packages (`.deb` and AppImage):

```sh
npm run build:linux
```

For the other desktop platforms, run the build on that platform:

```sh
# Windows: MSI and NSIS installer
npm run build:windows

# macOS: application bundle and DMG
npm run build:macos

# The default targets for the current platform
npm run build:desktop
```

Native Tauri bundles should be built on their target operating system. The frontend, Rust shell, file dialogs, filesystem access, window controls, and close handling use Tauri APIs supported on Windows, macOS, and Linux.

### GitHub Actions builds

The `Build desktop apps` workflow builds installers for Linux, Windows, Intel macOS, and Apple Silicon macOS. Run it manually from the repository's **Actions** tab, then download the bundles from the run's **Artifacts** section.

Pushing a version tag also creates a published GitHub Release and attaches the bundles:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Keep the tag in sync with the version in `src-tauri/tauri.conf.json` before releasing. macOS and Windows builds are unsigned until signing credentials are configured, so their operating systems may show a warning when they are installed.

For browser-only UI development, run `npm run dev` and open http://localhost:1420.

## Checks and builds

```sh
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

The last command builds native application bundles for the current platform.

## Editor

- Hold **Spread** or **Closer** to smoothly move node centers farther from or nearer to the map center. Release to stop; node sizes stay unchanged.
- Click **Frame** to pan and zoom to fit all nodes with a small margin.
- Hold **Organize** (mouse, touch, or Space/Enter) to animate a force layout: nodes repel, connections pull. Release to stop; it also stops when movement settles.
- Hold **Relax** to slowly and gently even out connection lengths. Release to stop; it also stops when the map settles. Unconnected nodes stay put. This refines a rough layout rather than arranging a map from scratch.
- Close the desktop window using its normal window controls. If the map has unsaved changes, an in-app dialog lets you Save, Discard, or Cancel.
- Double-click empty workspace to create an idea.
- Drag nodes to move them; connected lines slide around the node borders to stay between the nodes. When sliding reaches a node side, all anchors already on that side are spaced evenly and ordered toward their other nodes, including connections whose other node did not move. Drag the background to pan and scroll to zoom.
- Select a node and drag from any point on its border onto another node to connect them. The line stays attached at the chosen point.
- Select a node to edit its name, type, description, and background color (16 pastels) in the node editor.
- Toggle **Arrow at start** and **Arrow at end** in the connection editor for no arrows, one arrow, or arrows at both ends.
- Choose from 10 dark connection colors and switch each connection between solid/dashed and thin/thick. New connections default to black, solid, and thin.
- Drag either endpoint of a selected connection along its node border to reposition the attachment.
- Select a connection to edit its text in the right panel. Text is empty by default and appears at the center of the line.
- Select nodes or connections and press Delete/Backspace to remove them.

Open the **File** menu for Load, Load last, Save, and Save as. Save selects a JSON file on the first save and updates that file on subsequent saves. Save as always opens the file picker. Load last reopens the last successfully saved or opened map, remembered per user in `~/.mind-chart/settings.json`. Load validates and opens a saved map; subsequent saves update the loaded file. Unsaved changes are indicated in the status bar, and loading another map asks before replacing them. File operations are available in the desktop app.

Open the **Export** menu and choose **Export PDF** to write a PDF rendering of the current map. The export includes nodes, connection lines, labels, colors, line styles, and arrows.

Documents include node properties and positions, connection text, arrows, attachment points, and the viewport. Undo and Redo retain up to 10 full-document edit snapshots. Dragging and editing a text field are grouped into one step. Consecutive holds of the same layout button also collapse into one step; switching layout buttons or making another edit starts a new one. Selection and pan/zoom alone do not create steps; loading a document starts a fresh history.

`src/App.tsx` contains the initial editor, `src/App.css` its styles, and `src-tauri/` the native app shell.
