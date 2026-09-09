import type { Node } from "@xyflow/react";

/** Scale node centers around the bounds of the complete cards, without resizing cards. */
export function scaleNodePositions<T extends Node>(nodes: T[], factor: number): T[] {
  if (nodes.length < 2 || factor === 1) return nodes;
  const boxes = nodes.map((node) => ({
    node,
    width: node.measured?.width ?? node.width ?? 240,
    height: node.measured?.height ?? node.height ?? 100,
  }));
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const { node, width, height } of boxes) {
    left = Math.min(left, node.position.x);
    top = Math.min(top, node.position.y);
    right = Math.max(right, node.position.x + width);
    bottom = Math.max(bottom, node.position.y + height);
  }
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return boxes.map(({ node, width, height }) => ({
    ...node,
    position: {
      x: node.position.x + (node.position.x + width / 2 - centerX) * (factor - 1),
      y: node.position.y + (node.position.y + height / 2 - centerY) * (factor - 1),
    },
  }));
}
