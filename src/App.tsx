import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, serializeDocument, type IdeaNode, type IdeaData } from "./document";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, MarkerType, addEdge, useNodesState, useEdgesState, useReactFlow,
  type Connection, type NodeProps, type Edge, type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";
import { useDocumentHistory } from "./useDocumentHistory";
import { useOrganize } from "./useOrganize";
import { relaxNodes } from "./relax";
import { scaleNodePositions } from "./spacing";
import { BorderConnector, BorderLine, BorderConnectionContext, ConnectionPreview, useConnectionDraft } from "./connections";

const pastelColors = [
  { name: "Cream", value: "#F5EED6" },
  { name: "Butter", value: "#F7E6A6" },
  { name: "Peach", value: "#F6D5BC" },
  { name: "Apricot", value: "#F4C6A6" },
  { name: "Rose", value: "#F2C6CE" },
  { name: "Pink", value: "#F4D5E6" },
  { name: "Lilac", value: "#E6D5F1" },
  { name: "Lavender", value: "#D5CBEF" },
  { name: "Periwinkle", value: "#CDD7F3" },
  { name: "Sky", value: "#CAE5F5" },
  { name: "Ice", value: "#D8EEF0" },
  { name: "Aqua", value: "#C6E8E3" },
  { name: "Mint", value: "#D0EBD8" },
  { name: "Sage", value: "#DCE6CD" },
  { name: "Lime", value: "#E9EDBD" },
  { name: "Stone", value: "#E5E2DC" },
] as const;
const initialNodes: IdeaNode[] = [
  { id: "start", type: "idea", position: { x: 80, y: 180 }, data: { type: "Idea", backgroundColor: pastelColors[12].value, name: "A new idea", description: "Every map starts somewhere. What’s on your mind?" } },
  { id: "explore", type: "idea", position: { x: 440, y: 70 }, data: { type: "Idea", backgroundColor: pastelColors[12].value, name: "Explore possibilities", description: "Capture a thought, question, or possibility." } },
  { id: "connect", type: "idea", position: { x: 440, y: 310 }, data: { type: "Idea", backgroundColor: pastelColors[12].value, name: "Make connections", description: "Select a node, then drag from its border to another node." } },
];
const initialEdges: Edge[] = [
  { id: "start-explore", type: "border", label: "", source: "start", target: "explore" },
  { id: "start-connect", type: "border", label: "", source: "start", target: "connect" },
];
function IdeaCard({ id, data, selected }: NodeProps<IdeaNode>) {
  return <article className="idea-card" style={{ backgroundColor: data.backgroundColor }}>
    <Handle className="internal-handle" isConnectable={false} type="target" position={Position.Left} />
    <h3>{data.name || "Untitled idea"}{data.type && <span className="node-type"> ({data.type})</span>}</h3>
    <p>{data.description || "Add a description…"}</p>
    <Handle className="internal-handle" isConnectable={false} type="source" position={Position.Right} />
    <BorderConnector id={id} selected={Boolean(selected)} />
  </article>;
}
const nodeTypes = { idea: IdeaCard };
const edgeTypes = { border: BorderLine };

function Editor() {
  const organize = useOrganize();
  const [draft, setDraft] = useConnectionDraft();
  const [nodes, setNodes, onNodesChange] = useNodesState<IdeaNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const history = useDocumentHistory(nodes, edges, organize.organizing);
  const { screenToFlowPosition, deleteElements, getViewport, setViewport, fitView } = useReactFlow<IdeaNode>();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const fileLock = useRef(false);
  const [fileError, setFileError] = useState("");
  const [savedContent, setSavedContent] = useState("");
  // Pan/zoom is saved, but navigating the workspace does not mark content as edited.
  const content = serializeDocument(nodes, edges, { x: 0, y: 0, zoom: 1 });
  const dirty = content !== savedContent;
  async function rememberFile(path: string) {
    try { await invoke("remember_last_file", { path }); }
    catch (error) { setFileError(`Document opened or saved, but could not update settings: ${String(error)}`); }
  }
  async function saveDocument(saveAs = false): Promise<boolean> {
    if (fileLock.current) return false;
    fileLock.current = true;
    setFileBusy(true);
    setFileError("");
    try {
      const path = saveAs || !filePath ? await save({ title: "Save Mind Chart", defaultPath: filePath ?? "Untitled map.json", filters: [{ name: "Mind Chart JSON", extensions: ["json"] }] }) : filePath;
      if (!path) return false;
      await writeTextFile(path, serializeDocument(nodes, edges, getViewport()));
      setFilePath(path);
      setSavedContent(content);
      await rememberFile(path);
      return true;
    } catch (error) { setFileError(`Could not save: ${String(error)}`); }
    finally { fileLock.current = false; setFileBusy(false); }
    return false;
  }
  async function loadDocument(loadLast = false) {
    if (fileLock.current) return;
    fileLock.current = true;
    setFileBusy(true);
    setFileError("");
    try {
      const path = loadLast ? await invoke<string | null>("last_file") : await open({ title: "Load Mind Chart", multiple: false, directory: false, filters: [{ name: "Mind Chart JSON", extensions: ["json"] }] });
      if (!path) {
        if (loadLast) setFileError("No previous file yet. Open or save a map first.");
        return;
      }
      const document = parseDocument(await readTextFile(path));
      if (dirty && !await confirm("Replace the current map? Unsaved changes will be lost.", { title: "Load map", kind: "warning" })) return;
      history.reset(document);
      setDraft(null);
      setNodes(document.nodes);
      setEdges(document.edges);
      await setViewport(document.viewport);
      setFilePath(path);
      setSavedContent(serializeDocument(document.nodes, document.edges, { x: 0, y: 0, zoom: 1 }));
      await rememberFile(path);
    } catch (error) { setFileError(`Could not load: ${String(error)}`); }
    finally { fileLock.current = false; setFileBusy(false); }
  }

  const closing = useRef(false);
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (closing.current || !dirty) return;
      event.preventDefault();
      if (fileLock.current) return;
      const saveChanges = await confirm("Save changes before quitting?", {
        title: "Unsaved changes", kind: "warning",
      });
      if (saveChanges) {
        if (!await saveDocument()) return;
      } else {
        const discardChanges = await confirm("Discard unsaved changes and quit?", {
          title: "Unsaved changes", kind: "warning",
        });
        if (!discardChanges) return;
      }
      closing.current = true;
      await getCurrentWindow().close();
    }).then((remove) => { unlisten = remove; });
    return () => { unlisten?.(); };
  }, [dirty]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (!fileBusy && isTauri()) void saveDocument(event.shiftKey);
      } else if (key === "z") {
        event.preventDefault();
        if (!fileBusy && !organize.organizing) {
          setDraft(null);
          if (event.shiftKey) history.redo();
          else history.undo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fileBusy, history, organize.organizing, saveDocument, setDraft]);
  const selected = nodes.find((node) => node.selected);
  const selectedEdge = edges.find((edge) => edge.selected);
  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge(connection, current));
  }, [setEdges]);
  function addNode(position?: XYPosition) {
    const workspace = document.querySelector(".workspace")!.getBoundingClientRect();
    const newNode: IdeaNode = {
      id: crypto.randomUUID(), type: "idea", selected: true,
      position: position ?? screenToFlowPosition({ x: workspace.left + workspace.width / 2 - 120, y: workspace.top + workspace.height / 2 - 60 }),
      data: { type: "Idea", backgroundColor: pastelColors[12].value, name: "Untitled idea", description: "" },
    };
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode]);
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
  }
  function updateData(field: keyof IdeaData, value: string) {
    if (!selected) return;
    setNodes((current) => current.map((node) => node.id === selected.id
      ? { ...node, data: { ...node.data, [field]: value } } : node));
  }
  return <BorderConnectionContext.Provider value={setDraft}><div className="app">
    <header className="topbar">
      <div className="file-section">
        <div className="file-heading" title={filePath ?? "Untitled map.json"}>
          <span className="file-name">{filePath?.split(/[\\/]/).pop() ?? "Untitled map.json"}</span>
          {dirty && <span className="unsaved-label"> (unsaved)</span>}
        </div>
        <div className="toolbar-actions file-actions" role="toolbar" aria-label="File actions">
        <button className="quit-button" disabled={!isTauri() || fileBusy} onClick={() => void loadDocument()}>Load</button>
        <button className="quit-button" disabled={!isTauri() || fileBusy} onClick={() => void loadDocument(true)}>Load last</button>
        <button className="quit-button" disabled={!isTauri() || fileBusy} onClick={() => void saveDocument()}>Save</button>
        <button className="quit-button" disabled={!isTauri() || fileBusy} onClick={() => void saveDocument(true)}>Save as</button>
        <button className="quit-button" disabled={!history.canUndo || organize.organizing || fileBusy} onClick={() => { setDraft(null); history.undo(); }}>Undo</button>
        <button className="quit-button" disabled={!history.canRedo || organize.organizing || fileBusy} onClick={() => { setDraft(null); history.redo(); }}>Redo</button>
      </div>
      </div>
      <div className="toolbar-actions map-actions" role="toolbar" aria-label="Map actions">
        <button className="quit-button" onClick={() => setNodes((current) => relaxNodes(current, edges))} disabled={edges.length < 2} title="Gently even out connection lengths">Relax</button>
        <button className="quit-button organize-button" disabled={nodes.length < 2 || fileBusy}
          aria-pressed={organize.organizing} title="Hold to organize nodes; release to stop"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            organize.start();
          }}
          onPointerUp={organize.stop} onPointerCancel={organize.stop} onLostPointerCapture={organize.stop}
          onBlur={organize.stop}
          onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); organize.start(); } }}
          onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); organize.stop(); } }}
        >Organize</button>
        <button className="quit-button" onClick={() => void fitView({ padding: 0.02, minZoom: 0.000001, maxZoom: 100, duration: 250 })} disabled={nodes.length === 0} title="Fit all nodes into the workspace">Frame</button>
        <button className="quit-button" onClick={() => setNodes((current) => scaleNodePositions(current, 1.05))} disabled={nodes.length < 2} title="Spread nodes 5% farther from the map center">Spread</button>
        <button className="quit-button" onClick={() => setNodes((current) => scaleNodePositions(current, 1 / 1.05))} disabled={nodes.length < 2} title="Move nodes closer to the map center">Closer</button>
      </div>
    </header>
    {fileError && <div className="error-banner" role="alert">{fileError}</div>}
    <main>
      <section className="workspace" aria-label="Mind map workspace">
        <ReactFlow<IdeaNode>
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onPaneClick={(event) => { if (event.detail === 2) addNode(screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}
          defaultEdgeOptions={{ type: "default", style: { stroke: "#8d9d93", strokeWidth: 2 } }}
          fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.000001} maxZoom={100}
          zoomOnDoubleClick={false} deleteKeyCode={["Backspace", "Delete"]}
        >
          <ConnectionPreview draft={draft} />
          <Background color="#d7ddd6" gap={24} size={1.5} />
          <Controls showInteractive={false} />
          <MiniMap<IdeaNode> nodeColor={(node) => node.data.backgroundColor} maskColor="rgba(245, 247, 242, 0.7)" pannable zoomable />
        </ReactFlow>
        <div className="workspace-label"><span className="eyebrow">YOUR WORKSPACE</span><h1>Room to think.</h1></div>
      </section>
      <aside className="inspector" aria-label={selectedEdge ? "Connection editor" : "Node editor"}>
        {selectedEdge ? <div className="fields">
          <label htmlFor="connection-text">Text</label>
          <input id="connection-text" value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
            onChange={(event) => setEdges((current) => current.map((edge) => edge.id === selectedEdge.id
              ? { ...edge, label: event.target.value } : edge))}
            placeholder="Connection text" />
          <fieldset className="arrow-options">
            <legend>Arrows</legend>
            {(["markerStart", "markerEnd"] as const).map((end) => <label key={end} className="arrow-toggle">
              <input type="checkbox" checked={Boolean(selectedEdge[end])}
                onChange={(event) => {
                  const marker = event.target.checked
                    ? { type: MarkerType.ArrowClosed, color: "#8d9d93", width: 20, height: 20, orient: "auto-start-reverse" }
                    : undefined;
                  setEdges((current) => current.map((edge) => edge.id === selectedEdge.id ? { ...edge, [end]: marker } : edge));
                }} />
              {end === "markerStart" ? "Arrow at start" : "Arrow at end"}
            </label>)}
          </fieldset>
          <button className="delete-button" onClick={() => void deleteElements({ edges: [{ id: selectedEdge.id }] })}>Delete connection</button>
        </div> : selected ? <div className="fields">
          <label htmlFor="node-name">Name</label>
          <input id="node-name" value={selected.data.name} onChange={(event) => updateData("name", event.target.value)} placeholder="Untitled idea" />
          <label htmlFor="node-type">Type</label>
          <input id="node-type" value={selected.data.type} onChange={(event) => updateData("type", event.target.value)} placeholder="e.g. Idea, task, person" />
          <label htmlFor="node-description">Description</label>
          <textarea id="node-description" value={selected.data.description} onChange={(event) => updateData("description", event.target.value)} placeholder="Describe this node…" />
          <fieldset className="color-picker">
            <legend>Background color</legend>
            <div className="color-grid">
              {pastelColors.map((color) => <button
                key={color.value} type="button" className="color-swatch"
                style={{ backgroundColor: color.value }}
                aria-label={color.name} title={color.name}
                aria-pressed={selected.data.backgroundColor === color.value}
                onClick={() => updateData("backgroundColor", color.value)}
              >{selected.data.backgroundColor === color.value ? "✓" : ""}</button>)}
            </div>
          </fieldset>
          <button className="delete-button" onClick={() => void deleteElements({ nodes: [{ id: selected.id }] })}>Delete node</button>
        </div> : <p className="empty-copy">Select a node or connection to edit its properties.</p>}
        <div className="guide"><h3>A few simple moves</h3><p><b>Create</b> Double-click empty space</p><p><b>Connect</b> Drag from a selected node’s border</p><p><b>Move</b> Drag a node or the background</p><p><b>Remove</b> Select and press Delete</p></div>
      </aside>
    </main>
    <footer><span><span className="status-dot" /> {nodes.length} nodes · {edges.length} connections</span><span>{fileBusy ? "Working…" : isTauri() ? (dirty ? "Unsaved changes" : "All changes saved") : "Open the desktop app to save and load files."}</span></footer>
  </div></BorderConnectionContext.Provider>;
}
export default function App() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>;
}
