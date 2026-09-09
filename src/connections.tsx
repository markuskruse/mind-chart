import { createContext, useContext, useRef, useState, type PointerEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, Position, ViewportPortal, getBezierPath, useInternalNode, useReactFlow, type Edge, type Node, type EdgeProps, type XYPosition } from "@xyflow/react";

export type Anchor = { x: number; y: number; side: Position };
export type BorderEdge = Edge<{ sourceAnchor: Anchor; targetAnchor: Anchor }>;
type Draft = { source: string; anchor: Anchor; start: XYPosition; end: XYPosition };
export const BorderConnectionContext = createContext<(draft: Draft | null) => void>(() => {});

// Store relative coordinates so attachments follow the node when its size changes.
export function borderAnchor(rect: DOMRect, x: number, y: number): Anchor {
  const rx = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  const ry = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
  const distances = [Math.abs(y - rect.top), Math.abs(x - rect.right), Math.abs(y - rect.bottom), Math.abs(x - rect.left)];
  const side = [Position.Top, Position.Right, Position.Bottom, Position.Left][distances.indexOf(Math.min(...distances))];
  return { x: side === Position.Left ? 0 : side === Position.Right ? 1 : rx, y: side === Position.Top ? 0 : side === Position.Bottom ? 1 : ry, side };
}

export function BorderConnector({ id, selected }: { id: string; selected: boolean }) {
  const setDraft = useContext(BorderConnectionContext);
  const { screenToFlowPosition, setEdges } = useReactFlow();
  const [active, setActive] = useState<Draft | null>(null);
  function start(event: PointerEvent<SVGRectElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const rect = event.currentTarget.closest(".idea-card")!.getBoundingClientRect();
    const anchor = borderAnchor(rect, event.clientX, event.clientY);
    const point = screenToFlowPosition({ x: rect.left + anchor.x * rect.width, y: rect.top + anchor.y * rect.height });
    const draft = { source: id, anchor, start: point, end: point };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(draft);
    setDraft(draft);
  }
  function finish(event: PointerEvent<SVGRectElement>) {
    if (!active) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".react-flow__node");
    const card = target?.querySelector(".idea-card");
    if (target?.dataset.id && target.dataset.id !== id && card) {
      const targetAnchor = borderAnchor(card.getBoundingClientRect(), event.clientX, event.clientY);
      setEdges((edges) => [...edges, {
        id: crypto.randomUUID(), source: id, target: target.dataset.id!, type: "border", label: "",
        data: { sourceAnchor: active.anchor, targetAnchor },
      }]);
    }
    setActive(null);
    setDraft(null);
  }
  return <svg className="node-border" aria-hidden="true">
    <rect x="0" y="0" width="100%" height="100%" rx="12"
      className={`node-border-hit nodrag nopan ${selected ? "enabled" : ""}`}
      onPointerDown={start}
      onPointerMove={(event) => { if (active) setDraft({ ...active, end: screenToFlowPosition({ x: event.clientX, y: event.clientY }) }); }}
      onPointerUp={finish}
      onPointerCancel={() => { setActive(null); setDraft(null); }}
      onLostPointerCapture={() => { setActive(null); setDraft(null); }}
    />
  </svg>;
}

function ConnectionEndpoint({ edgeId, nodeId, end, x, y }: {
  edgeId: string; nodeId: string; end: "source" | "target"; x: number; y: number;
}) {
  const { getInternalNode, screenToFlowPosition, setEdges } = useReactFlow<Node, BorderEdge>();
  const dragging = useRef(false);
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    event.stopPropagation();
    const node = getInternalNode(nodeId);
    if (!node?.measured.width || !node.measured.height) return;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const rect = new DOMRect(node.internals.positionAbsolute.x, node.internals.positionAbsolute.y, node.measured.width, node.measured.height);
    const anchor = borderAnchor(rect, point.x, point.y);
    setEdges((edges) => edges.map((edge) => edge.id === edgeId ? {
      ...edge,
      data: {
        sourceAnchor: { x: 1, y: .5, side: Position.Right },
        targetAnchor: { x: 0, y: .5, side: Position.Left },
        ...edge.data,
        [end === "source" ? "sourceAnchor" : "targetAnchor"]: anchor,
      },
    } : edge));
  }
  return <button type="button" className="connection-endpoint nodrag nopan"
    aria-label={`Move ${end} connection point`} title="Drag along the node border"
    style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={move}
    onPointerUp={(event) => {
      move(event);
      dragging.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { dragging.current = false; }}
    onLostPointerCapture={() => { dragging.current = false; }}
    onClick={(event) => event.stopPropagation()}
  />;
}

export function BorderLine({ id, source, target, data, style, markerStart, markerEnd, selected, label }: EdgeProps<BorderEdge>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  if (!from || !to) return null;
  const a = data?.sourceAnchor ?? { x: 1, y: .5, side: Position.Right };
  const b = data?.targetAnchor ?? { x: 0, y: .5, side: Position.Left };
  const coordinates = {
    sourceX: from.internals.positionAbsolute.x + a.x * (from.measured.width ?? 0),
    sourceY: from.internals.positionAbsolute.y + a.y * (from.measured.height ?? 0),
    targetX: to.internals.positionAbsolute.x + b.x * (to.measured.width ?? 0),
    targetY: to.internals.positionAbsolute.y + b.y * (to.measured.height ?? 0),
    sourcePosition: a.side, targetPosition: b.side,
  };
  const [path, labelX, labelY] = getBezierPath(coordinates);
  return <><BaseEdge id={id} interactionWidth={40} path={path} markerStart={markerStart} markerEnd={markerEnd}
    label={label || undefined} labelX={labelX} labelY={labelY}
    labelStyle={{ fill: "#263c32", fontSize: 12 }}
    labelBgStyle={{ fill: "#f7f8f4" }} labelBgPadding={[6, 4]} labelBgBorderRadius={4}
    style={{ stroke: selected ? "#315a43" : "#8d9d93", strokeWidth: 2, ...style }} />
    {selected && <EdgeLabelRenderer>
      <ConnectionEndpoint edgeId={id} nodeId={source} end="source" x={coordinates.sourceX} y={coordinates.sourceY} />
      <ConnectionEndpoint edgeId={id} nodeId={target} end="target" x={coordinates.targetX} y={coordinates.targetY} />
    </EdgeLabelRenderer>}
  </>;
}

export function ConnectionPreview({ draft }: { draft: Draft | null }) {
  if (!draft) return null;
  const [path] = getBezierPath({ sourceX: draft.start.x, sourceY: draft.start.y, sourcePosition: draft.anchor.side, targetX: draft.end.x, targetY: draft.end.y });
  return <ViewportPortal><svg className="connection-preview"><path d={path} fill="none" stroke="#315a43" strokeWidth="2" strokeDasharray="5 4" /></svg></ViewportPortal>;
}
export function useConnectionDraft() { return useState<Draft | null>(null); }
