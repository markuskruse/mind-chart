import { MarkerType, Position, type Edge, type Node, type Viewport } from "@xyflow/react";
import { connectionColors } from "./connectionStyle.ts";

export type IdeaData = { name: string; type: string; description: string; backgroundColor: string };
export type IdeaNode = Node<IdeaData, "idea">;
export type MapDocument = { format: "mind-chart"; version: 1; nodes: IdeaNode[]; edges: Edge[]; viewport: Viewport };

export function serializeDocument(nodes: IdeaNode[], edges: Edge[], viewport: Viewport): string {
  return JSON.stringify({
    format: "mind-chart", version: 1,
    nodes: nodes.map(({ id, position, data }) => ({ id, type: "idea", position, data })),
    edges: edges.map(({ id, source, target, label, data, markerStart, markerEnd }) => ({
      id, type: "border", source, target, label: label ?? "", data, markerStart, markerEnd,
    })),
    viewport,
  }, null, 2) + "\n";
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Mind Chart document: ${message}`);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function anchor(value: unknown) {
  check(record(value) && finite(value.x) && finite(value.y), "invalid attachment point");
  check(value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1, "attachment outside node");
  check((value.side === Position.Left && value.x === 0) || (value.side === Position.Right && value.x === 1)
    || (value.side === Position.Top && value.y === 0) || (value.side === Position.Bottom && value.y === 1), "attachment must be on a border");
  return { x: value.x, y: value.y, side: value.side as Position };
}
function marker(value: unknown, color: string) {
  if (value === undefined || value === null) return undefined;
  check(record(value) && value.type === MarkerType.ArrowClosed, "unsupported arrow");
  return { type: MarkerType.ArrowClosed, color, width: 10, height: 10, orient: "auto-start-reverse" };
}
export function parseDocument(text: string): MapDocument {
  const value: unknown = JSON.parse(text);
  check(record(value) && value.format === "mind-chart" && value.version === 1, "unsupported format or version");
  check(Array.isArray(value.nodes) && Array.isArray(value.edges), "nodes and edges must be arrays");
  const nodeIds = new Set<string>();
  const nodes: IdeaNode[] = value.nodes.map((node: unknown) => {
    check(record(node) && typeof node.id === "string" && node.id.length > 0 && !nodeIds.has(node.id), "invalid or duplicate node ID");
    nodeIds.add(node.id);
    check(record(node.position) && finite(node.position.x) && finite(node.position.y), "invalid node position");
    const data = node.data;
    check(record(data) && typeof data.name === "string" && typeof data.type === "string" && typeof data.description === "string"
      && typeof data.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(data.backgroundColor), "invalid node properties");
    return { id: node.id, type: "idea", position: { x: node.position.x, y: node.position.y },
      data: { name: data.name, type: data.type, description: data.description, backgroundColor: data.backgroundColor } };
  });
  const edgeIds = new Set<string>();
  const edges: Edge[] = value.edges.map((edge: unknown) => {
    check(record(edge) && typeof edge.id === "string" && edge.id.length > 0 && !edgeIds.has(edge.id), "invalid or duplicate connection ID");
    edgeIds.add(edge.id);
    check(typeof edge.source === "string" && typeof edge.target === "string" && nodeIds.has(edge.source) && nodeIds.has(edge.target), "connection references a missing node");
    check(typeof edge.label === "string", "invalid connection text");
    let data;
    if (edge.data !== undefined) {
      check(record(edge.data), "invalid connection data");
      const edgeData = edge.data;
      data = {
        ...(edgeData.sourceAnchor === undefined ? {} : { sourceAnchor: anchor(edgeData.sourceAnchor) }),
        ...(edgeData.targetAnchor === undefined ? {} : { targetAnchor: anchor(edgeData.targetAnchor) }),
      } as Record<string, unknown>;
      if (edgeData.color !== undefined) {
        check(connectionColors.some((color) => color.value === edgeData.color), "unsupported connection color");
        data.color = edgeData.color;
      }
      if (edgeData.lineStyle !== undefined) {
        check(edgeData.lineStyle === "solid" || edgeData.lineStyle === "dashed", "unsupported connection line style");
        data.lineStyle = edgeData.lineStyle;
      }
      if (edgeData.thickness !== undefined) {
        check(edgeData.thickness === "thin" || edgeData.thickness === "thick", "unsupported connection thickness");
        data.thickness = edgeData.thickness;
      }
    }
    const connectionColor = typeof data?.color === "string" ? data.color : connectionColors[0].value;
    return { id: edge.id, type: "border", source: edge.source, target: edge.target, label: edge.label, data,
      markerStart: marker(edge.markerStart, connectionColor), markerEnd: marker(edge.markerEnd, connectionColor) };
  });
  const view = value.viewport;
  check(record(view) && finite(view.x) && finite(view.y) && finite(view.zoom) && view.zoom >= .000001 && view.zoom <= 100, "invalid viewport");
  return { format: "mind-chart", version: 1, nodes, edges, viewport: { x: view.x, y: view.y, zoom: view.zoom } };
}
