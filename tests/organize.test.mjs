import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrganizeState, organizeStep } from '../src/organize.ts';
const node = (id, x, y = 0) => ({ id, position: { x, y }, measured: { width: 240, height: 100 }, data: {} });
const edge = { id: 'ab', source: 'a', target: 'b' };
const distance = (nodes) => Math.hypot(nodes[1].position.x - nodes[0].position.x, nodes[1].position.y - nodes[0].position.y);
test('repels overlapping nodes and pulls distant connected nodes', () => {
  const close = [node('a', 0), node('b', 10)];
  assert.ok(distance(organizeStep(close, [], createOrganizeState()).nodes) > distance(close));
  const far = [node('a', 0), node('b', 1000)];
  assert.ok(distance(organizeStep(far, [edge], createOrganizeState()).nodes) < distance(far));
});
test('breaks exact overlaps, caps movement, and preserves input', () => {
  const nodes = [node('a', 0), node('b', 0), node('c', 100000)];
  const snapshot = structuredClone(nodes);
  const result = organizeStep(nodes, [edge, { id: 'bc', source: 'b', target: 'c' }], createOrganizeState());
  assert.ok(distance(result.nodes) > 0);
  result.nodes.forEach((n, i) => assert.ok(Math.hypot(n.position.x - nodes[i].position.x, n.position.y - nodes[i].position.y) <= 3.000001));
  assert.deepEqual(nodes, snapshot);
});
test('connected graph converges and disconnected nodes can settle', () => {
  for (const edges of [[edge], []]) {
    let nodes = [node('a', 0), node('b', 150)];
    const state = createOrganizeState();
    let stable = false;
    for (let i = 0; i < 15000 && !stable; i++) {
      const result = organizeStep(nodes, edges, state);
      nodes = result.nodes; stable = result.stable;
    }
    assert.ok(stable, 'layout should settle');
    assert.ok(distance(nodes) > 260, 'cards should no longer overlap');
  }
});
test('empty and single-node maps stop immediately; dangling edges are ignored', () => {
  assert.ok(organizeStep([], [], createOrganizeState()).stable);
  assert.ok(organizeStep([node('a', 0)], [edge], createOrganizeState()).stable);
});
