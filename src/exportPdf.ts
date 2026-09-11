import { jsPDF } from "jspdf";
import type { Edge, Node } from "@xyflow/react";

type ExportNode = Node<{ name: string; type: string; description: string }>;
type Anchor = { x: number; y: number; side?: string };
type ExportEdge = Edge<{ sourceAnchor?: Anchor; targetAnchor?: Anchor; color?: string; lineStyle?: string; thickness?: string }>;
type Point = { x: number; y: number };

const sizeOf = (node: ExportNode) => ({ width: node.measured?.width ?? node.width ?? 240, height: node.measured?.height ?? node.height ?? 100 });
const rgb = (hex: string) => {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "111827";
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)] as [number, number, number];
};
function anchorPoint(node: ExportNode, anchor: Anchor | undefined, source: boolean): Point {
  const size = sizeOf(node);
  return { x: node.position.x + (anchor?.x ?? (source ? 1 : 0)) * size.width, y: node.position.y + (anchor?.y ?? .5) * size.height };
}
function control(point: Point, side: string | undefined, amount: number): Point {
  switch (side) {
    case "top": return { x: point.x, y: point.y - amount };
    case "bottom": return { x: point.x, y: point.y + amount };
    case "left": return { x: point.x - amount, y: point.y };
    default: return { x: point.x + amount, y: point.y };
  }
}
function curvePoints(a: Point, b: Point, sourceSide?: string, targetSide?: string) {
  const amount = Math.max(40, Math.min(180, Math.hypot(b.x - a.x, b.y - a.y) * .45));
  const c1 = control(a, sourceSide, amount), c2 = control(b, targetSide, amount);
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24, u = 1 - t;
    return { x: u ** 3 * a.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * b.x, y: u ** 3 * a.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * b.y };
  });
}
function arrow(doc: jsPDF, tip: Point, direction: Point, size: number) {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const ux = direction.x / length, uy = direction.y / length;
  const left = { x: tip.x - ux * size - uy * size * .5, y: tip.y - uy * size + ux * size * .5 };
  const right = { x: tip.x - ux * size + uy * size * .5, y: tip.y - uy * size - ux * size * .5 };
  doc.triangle(tip.x, tip.y, left.x, left.y, right.x, right.y, "F");
}

/** Creates a landscape PDF from the current graph without depending on browser screenshots. */
export function createMapPdf(nodes: ExportNode[], edges: ExportEdge[]): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  if (nodes.length === 0) {
    doc.setFontSize(16);
    doc.text("Empty mind map", pageWidth / 2, pageHeight / 2, { align: "center" });
    return new Uint8Array(doc.output("arraybuffer"));
  }
  const bounds = nodes.reduce((box, node) => {
    const size = sizeOf(node);
    return { left: Math.min(box.left, node.position.x), top: Math.min(box.top, node.position.y), right: Math.max(box.right, node.position.x + size.width), bottom: Math.max(box.bottom, node.position.y + size.height) };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const width = Math.max(1, bounds.right - bounds.left), height = Math.max(1, bounds.bottom - bounds.top);
  const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
  const map = (point: Point): Point => ({ x: margin + (point.x - bounds.left) * scale, y: margin + (point.y - bounds.top) * scale });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  doc.setLineCap("round");
  for (const edge of edges) {
    const source = byId.get(edge.source), target = byId.get(edge.target);
    if (!source || !target) continue;
    const sourceAnchor = edge.data?.sourceAnchor, targetAnchor = edge.data?.targetAnchor;
    const points = curvePoints(anchorPoint(source, sourceAnchor, true), anchorPoint(target, targetAnchor, false), sourceAnchor?.side, targetAnchor?.side).map(map);
    const color = rgb(edge.data?.color ?? "#111827");
    doc.setDrawColor(...color); doc.setFillColor(...color); doc.setLineWidth((edge.data?.thickness === "thick" ? 3 : 1.5) * scale);
    for (let i = 1; i < points.length; i++) {
      if (edge.data?.lineStyle !== "dashed" || Math.floor(i / 2) % 2 === 0) doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
    const last = points.length - 1;
    if (edge.markerEnd) arrow(doc, points[last], { x: points[last].x - points[last - 1].x, y: points[last].y - points[last - 1].y }, 7);
    if (edge.markerStart) arrow(doc, points[0], { x: points[0].x - points[1].x, y: points[0].y - points[1].y }, 7);
    if (typeof edge.label === "string" && edge.label) {
      const middle = points[Math.floor(points.length / 2)];
      doc.setFontSize(9); doc.setTextColor(38, 60, 50); doc.setFillColor(247, 248, 244);
      doc.roundedRect(middle.x - doc.getTextWidth(edge.label) / 2 - 4, middle.y - 8, doc.getTextWidth(edge.label) + 8, 14, 3, 3, "F");
      doc.text(edge.label, middle.x, middle.y + 3, { align: "center" });
    }
  }
  for (const node of nodes) {
    const size = sizeOf(node), topLeft = map(node.position), widthPt = size.width * scale, heightPt = size.height * scale;
    const fill = rgb((node.data as { backgroundColor?: string }).backgroundColor ?? "#d0ebd8");
    doc.setFillColor(...fill); doc.setDrawColor(212, 223, 208); doc.setLineWidth(1); doc.roundedRect(topLeft.x, topLeft.y, widthPt, heightPt, 8, 8, "FD");
    doc.setTextColor(38, 60, 50); doc.setFontSize(8); doc.text(node.data.type || "Untyped", topLeft.x + 10, topLeft.y + 14);
    doc.setFontSize(11); doc.text(node.data.name || "Untitled idea", topLeft.x + 10, topLeft.y + 31, { maxWidth: widthPt - 20 });
    doc.setFontSize(8); doc.setTextColor(83, 99, 87);
    const description = doc.splitTextToSize(node.data.description || "", Math.max(20, widthPt - 20)).slice(0, 4);
    if (description.length) doc.text(description, topLeft.x + 10, topLeft.y + 45, { lineHeightFactor: 1.35 });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
