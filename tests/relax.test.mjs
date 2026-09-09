import assert from 'node:assert/strict';
import test from 'node:test';
import { relaxNodes } from '../src/relax.ts';
const node = (id, x, y = 0) => ({ id, position: { x, y }, data: {}, measured: { width: 100, height: 60 } });
const edges = [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }];
const variance = (nodes) => {
  const lengths = edges.map((edge) => {
    const a = nodes.find((n) => n.id === edge.source);
    const b = nodes.find((n) => n.id === edge.target);
    return Math.hypot(b.position.x - a.position.x - 100, b.position.y - a.position.y);
  });
  return (lengths[0] - lengths[1]) ** 2;
};
test('relaxes unequal lengths with bounded movement, preserving center and input', () => {
  const nodes = [node('a', 0), node('b', 160), node('c', 600), node('isolated', 2000)];
  const snapshot = structuredClone(nodes);
  const result = relaxNodes(nodes, edges);
  assert.ok(variance(result) < variance(nodes));
  result.forEach((n, i) => assert.ok(Math.hypot(n.position.x - nodes[i].position.x, n.position.y - nodes[i].position.y) <= 3.000001));
  assert.equal(result[3], nodes[3]);
  assert.ok(Math.abs(result.reduce((sum, n) => sum + n.position.x, 0) - nodes.reduce((sum, n) => sum + n.position.x, 0)) < 1e-8);
  assert.deepEqual(nodes, snapshot);
  let relaxed = result;
  for (let i = 0; i < 100; i++) relaxed = relaxNodes(relaxed, edges);
  assert.ok(variance(relaxed) < variance(result) * .01);
});
test('leaves balanced maps and maps with fewer than two valid lines alone', () => {
  const nodes = [node('a', 0), node('b', 200), node('c', 400)];
  assert.equal(relaxNodes(nodes, edges), nodes);
  assert.equal(relaxNodes(nodes, []), nodes);
  assert.equal(relaxNodes(nodes, [edges[0], { id: 'bad', source: 'a', target: 'missing' }]), nodes);
});
test('uses chosen attachment locations instead of node centers', () => {
  const nodes = [node('a', 0), node('b', 200), node('c', 500)];
  const anchored = [{ ...edges[0], data: { sourceAnchor: { x: 0, y: .5 }, targetAnchor: { x: 0, y: .5 } } }, edges[1]];
  // Both attachment distances are 200 despite unequal node spacing.
  assert.equal(relaxNodes(nodes, anchored), nodes);
});
test('ignores self loops and coincident attachments without producing NaN', () => {
  const nodes = [node('a', 0), node('b', 100)];
  assert.equal(relaxNodes(nodes, [edges[0], { id: 'self', source: 'a', target: 'a' }]), nodes);
});
