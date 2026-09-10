import { Position, type Edge, type Node } from "@xyflow/react";

export type Anchor = { x: number; y: number; side: Position };

type Box = { left: number; top: number; width: number; height: number; centerX: number; centerY: number };

function box(node: Node): Box {
  const width = node.measured?.width ?? node.width ?? 240;
  const height = node.measured?.height ?? node.height ?? 100;
  return {
    left: node.position.x,
    top: node.position.y,
    width,
    height,
    centerX: node.position.x + width / 2,
    centerY: node.position.y + height / 2,
  };
}

/** Find where a line from one node center toward another meets its border. */
function facingAnchor(from: Box, to: Box): Anchor | null {
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  if (Math.abs(dx) < .001 && Math.abs(dy) < .001) return null;
  const horizontal = Math.abs(dx) / from.width >= Math.abs(dy) / from.height;
  if (horizontal) {
    const x = dx > 0 ? 1 : 0;
    const distance = from.width / 2 / Math.abs(dx);
    const y = Math.max(0, Math.min(1, .5 + dy * distance / from.height));
    return { x, y, side: dx > 0 ? Position.Right : Position.Left };
  }
  const y = dy > 0 ? 1 : 0;
  const distance = from.height / 2 / Math.abs(dy);
  const x = Math.max(0, Math.min(1, .5 + dx * distance / from.width));
  return { x, y, side: dy > 0 ? Position.Bottom : Position.Top };
}

/** Slide affected connection ends to face each other after a deliberate node drag. */
export function followDraggedNodes(nodes: Node[], edges: Edge[], movedNodeIds: Iterable<string>): Edge[] {
  const moved = new Set(movedNodeIds);
  if (moved.size === 0) return edges;
  const boxes = new Map(nodes.map((node) => [node.id, box(node)]));
  const sliding = new Map<number, { sourceAnchor: Anchor; targetAnchor: Anchor; source: Box; target: Box }>();
  const result = edges.map((edge, index) => {
    if (!moved.has(edge.source) && !moved.has(edge.target)) return edge;
    const source = boxes.get(edge.source);
    const target = boxes.get(edge.target);
    if (!source || !target) return edge;
    const sourceAnchor = facingAnchor(source, target);
    const targetAnchor = facingAnchor(target, source);
    if (!sourceAnchor || !targetAnchor) return edge;
    sliding.set(index, { sourceAnchor, targetAnchor, source, target });
    return { ...edge, data: { ...edge.data, sourceAnchor, targetAnchor } };
  });
  type End = { index: number; field: "sourceAnchor" | "targetAnchor"; anchor: Anchor; order: number };
  const groups = new Map<string, End[]>();
  const groupKey = (nodeId: string, side: Position) => JSON.stringify([nodeId, side]);
  const add = (nodeId: string, end: End) => {
    const key = groupKey(nodeId, end.anchor.side);
    groups.set(key, [...(groups.get(key) ?? []), end]);
  };
  for (const [index, placement] of sliding) {
    const edge = edges[index];
    const sourceHorizontal = placement.sourceAnchor.side === Position.Top || placement.sourceAnchor.side === Position.Bottom;
    const targetHorizontal = placement.targetAnchor.side === Position.Top || placement.targetAnchor.side === Position.Bottom;
    add(edge.source, { index, field: "sourceAnchor", anchor: placement.sourceAnchor,
      order: sourceHorizontal ? placement.target.centerX : placement.target.centerY });
    add(edge.target, { index, field: "targetAnchor", anchor: placement.targetAnchor,
      order: targetHorizontal ? placement.source.centerX : placement.source.centerY });
  }
  // Once sliding reaches a side, redistribute every anchor already on that
  // side, including connections whose opposite node was not moved.
  for (let index = 0; index < edges.length; index++) {
    if (sliding.has(index)) continue;
    const edge = edges[index];
    const source = boxes.get(edge.source);
    const target = boxes.get(edge.target);
    if (!source || !target) continue;
    const sourceAnchor = edge.data?.sourceAnchor as Anchor | undefined
      ?? { x: 1, y: .5, side: Position.Right };
    const targetAnchor = edge.data?.targetAnchor as Anchor | undefined
      ?? { x: 0, y: .5, side: Position.Left };
    if (groups.has(groupKey(edge.source, sourceAnchor.side))) {
      const horizontal = sourceAnchor.side === Position.Top || sourceAnchor.side === Position.Bottom;
      add(edge.source, { index, field: "sourceAnchor", anchor: sourceAnchor,
        order: horizontal ? target.centerX : target.centerY });
    }
    if (groups.has(groupKey(edge.target, targetAnchor.side))) {
      const horizontal = targetAnchor.side === Position.Top || targetAnchor.side === Position.Bottom;
      add(edge.target, { index, field: "targetAnchor", anchor: targetAnchor,
        order: horizontal ? source.centerX : source.centerY });
    }
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.order - b.order || edges[a.index].id.localeCompare(edges[b.index].id));
    group.forEach((end, position) => {
      const along = (position + .5) / group.length;
      const horizontal = end.anchor.side === Position.Top || end.anchor.side === Position.Bottom;
      const anchor = { ...end.anchor, x: horizontal ? along : end.anchor.x, y: horizontal ? end.anchor.y : along };
      const edge = result[end.index];
      result[end.index] = { ...edge, data: { ...edge.data, [end.field]: anchor } };
    });
  }
  return result;
}
