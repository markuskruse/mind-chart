import assert from 'node:assert/strict';
import test from 'node:test';
import { scaleNodePositions } from '../src/spacing.ts';
const node = (id, x, y, width = 100, height = 60) => ({ id, position: { x, y }, measured: { width, height }, data: { name: id } });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8);
test('spreads proportionally about bounds, keeping the center node fixed', () => {
  const nodes = [node('a', -300, -200), node('b', 0, 0), node('c', 100, 50), node('d', 300, 200)];
  const original = structuredClone(nodes);
  const spread = scaleNodePositions(nodes, 1.05);
  near(spread[0].position.x, -315);
  near(spread[0].position.y, -210);
  assert.deepEqual(spread[1].position, nodes[1].position);
  near(spread[2].position.x, 105);
  near(spread[3].position.x, 315);
  spread.forEach((n, i) => { assert.equal(n.measured, nodes[i].measured); assert.equal(n.data, nodes[i].data); });
  assert.deepEqual(nodes, original);
  const restored = scaleNodePositions(spread, 1 / 1.05);
  restored.forEach((n, i) => { near(n.position.x, nodes[i].position.x); near(n.position.y, nodes[i].position.y); });
});
test('uses complete node bounds and scales centers for different sizes', () => {
  const nodes = [node('a', 0, 0, 100, 60), node('b', 300, 100, 200, 100)];
  // Bounds center = (250, 100); node centers = (50,30), (400,150).
  const spread = scaleNodePositions(nodes, 1.05);
  near(spread[0].position.x, -10);
  near(spread[0].position.y, -3.5);
  near(spread[1].position.x, 307.5);
  near(spread[1].position.y, 102.5);
});
test('empty or single-node maps stay put', () => {
  const empty = [], single = [node('only', 100, 200)];
  assert.equal(scaleNodePositions(empty, 1.05), empty);
  assert.equal(scaleNodePositions(single, 1 / 1.05), single);
});
