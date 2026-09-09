import type { Edge, Node } from "@xyflow/react";

type Point = { x: number; y: number };

function attachment(node: Node, anchor: unknown, source: boolean): Point {
  const point = anchor as Partial<Point> | undefined;
  return {
    x: node.position.x + (point?.x ?? (source ? 1 : 0)) * (node.measured?.width ?? node.width ?? 240),
    y: node.position.y + (point?.y ?? .5) * (node.measured?.height ?? node.height ?? 100),
  };
}

/** One small spring-relaxation step using distances between actual attachments.
 * The current mean is the rest length, preserving the user's approximate scale.
 * Simultaneous, equal-and-opposite forces avoid order dependence and map drift.
 */
export function relaxNodes<T extends Node>(nodes: T[], edges: Edge[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const springs = edges.flatMap((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target || source === target) return [];
    const a = attachment(source, edge.data?.sourceAnchor, true);
    const b = attachment(target, edge.data?.targetAnchor, false);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    // Coincident attachments have no direction to relax along.
    if (length < .001) return [];
    return [{ source: source.id, target: target.id, dx, dy, length }];
  });
  if (springs.length < 2) return nodes;
  const restLength = springs.reduce((sum, spring) => sum + spring.length, 0) / springs.length;
  const forces = new Map(nodes.map((node) => [node.id, { x: 0, y: 0, degree: 0 }]));
  for (const spring of springs) {
    const strength = (spring.length - restLength) / spring.length;
    const a = forces.get(spring.source)!;
    const b = forces.get(spring.target)!;
    a.x += spring.dx * strength;
    a.y += spring.dy * strength;
    b.x -= spring.dx * strength;
    b.y -= spring.dy * strength;
    a.degree++;
    b.degree++;
  }
  let maxForce = 0;
  let maxDegree = 1;
  for (const force of forces.values()) {
    maxForce = Math.max(maxForce, Math.hypot(force.x, force.y));
    maxDegree = Math.max(maxDegree, force.degree);
  }
  if (maxForce < .001) return nodes;
  // A shared scale keeps the center fixed; even hubs move at most 3 canvas pixels.
  const step = Math.min(.08 / maxDegree, 3 / maxForce);
  return nodes.map((node) => {
    const force = forces.get(node.id)!;
    if (force.x === 0 && force.y === 0) return node;
    return { ...node, position: { x: node.position.x + force.x * step, y: node.position.y + force.y * step } };
  });
}
