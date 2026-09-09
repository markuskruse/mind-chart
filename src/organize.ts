import type { Edge, Node } from "@xyflow/react";

type Velocity = { x: number; y: number };
export type OrganizeState = { velocities: Map<string, Velocity>; quietSteps: number };
export const createOrganizeState = (): OrganizeState => ({ velocities: new Map(), quietSteps: 0 });

/** A damped force step. Repulsion has finite reach so disconnected groups can settle. */
export function organizeStep<T extends Node>(nodes: T[], edges: Edge[], state: OrganizeState) {
  const bodies = nodes.map((node) => {
    const width = node.measured?.width ?? node.width ?? 240;
    const height = node.measured?.height ?? node.height ?? 100;
    return { node, x: node.position.x + width / 2, y: node.position.y + height / 2,
      radius: Math.hypot(width, height) / 2, fx: 0, fy: 0 };
  });
  const index = new Map(bodies.map((body, i) => [body.node.id, i]));
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance < .001) {
        // Deterministic direction breaks symmetry for nodes at identical positions.
        const angle = (i * 137.5 + j * 73.3) * Math.PI / 180;
        dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
      }
      const clearance = a.radius + b.radius + 24;
      const reach = clearance + 400;
      const force = distance < reach
        ? 8000 / Math.max(distance, 40) ** 2 * (1 - distance / reach) ** 2 + Math.max(0, clearance - distance) * .025
        : 0;
      const fx = dx / distance * force, fy = dy / distance * force;
      a.fx -= fx; a.fy -= fy; b.fx += fx; b.fy += fy;
    }
  }
  for (const edge of edges) {
    const i = index.get(edge.source), j = index.get(edge.target);
    if (i === undefined || j === undefined || i === j) continue;
    const a = bodies[i], b = bodies[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < .001) continue;
    const pull = Math.max(0, distance - a.radius - b.radius - 100) * .008;
    a.fx += dx / distance * pull; a.fy += dy / distance * pull;
    b.fx -= dx / distance * pull; b.fy -= dy / distance * pull;
  }
  const velocities = bodies.map((body) => {
    const previous = state.velocities.get(body.node.id) ?? { x: 0, y: 0 };
    return { x: previous.x * .8 + body.fx * .2, y: previous.y * .8 + body.fy * .2 };
  });
  let maxMovement = 0;
  for (const velocity of velocities) maxMovement = Math.max(maxMovement, Math.hypot(velocity.x, velocity.y));
  const scale = Math.min(1, 3 / Math.max(maxMovement, .001));
  state.velocities.clear();
  const next = bodies.map((body, i) => {
    const velocity = { x: velocities[i].x * scale, y: velocities[i].y * scale };
    state.velocities.set(body.node.id, velocity);
    return { ...body.node, position: { x: body.node.position.x + velocity.x, y: body.node.position.y + velocity.y } };
  });
  state.quietSteps = maxMovement < .03 ? state.quietSteps + 1 : 0;
  return { nodes: next, stable: nodes.length < 2 || state.quietSteps >= 20 };
}
