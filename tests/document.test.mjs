import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeDocument, parseDocument } from '../src/document.ts';
const nodes = ['a', 'b'].map((id, i) => ({ id, type: 'idea', position: { x: i * 300, y: -20 }, selected: true, measured: { width: 240, height: 90 }, data: { name: `Name ${id}`, type: 'Task', description: 'Long text\nSecond line: åäö', backgroundColor: '#D0EBD8' } }));
const edges = [{ id: 'ab', type: 'border', source: 'a', target: 'b', label: 'relates to', selected: true, data: { sourceAnchor: { x: .3, y: 0, side: 'top' }, targetAnchor: { x: 0, y: .8, side: 'left' } }, markerStart: { type: 'arrowclosed' }, markerEnd: { type: 'arrowclosed' } }];
const viewport = { x: -100, y: 50, zoom: .7 };
test('round trips all document fields, excluding transient UI state', () => {
  const restored = parseDocument(serializeDocument(nodes, edges, viewport));
  assert.deepEqual(restored.nodes[0].data, nodes[0].data);
  assert.deepEqual(restored.nodes[1].position, nodes[1].position);
  assert.deepEqual(restored.edges[0].data, edges[0].data);
  assert.equal(restored.edges[0].label, 'relates to');
  assert.equal(restored.edges[0].markerStart.type, 'arrowclosed');
  assert.equal(restored.edges[0].markerEnd.type, 'arrowclosed');
  assert.deepEqual(restored.viewport, viewport);
  assert.equal(restored.nodes[0].selected, undefined);
  assert.equal(restored.nodes[0].measured, undefined);
  assert.equal(restored.edges[0].selected, undefined);
});
test('empty maps and default connections round trip', () => {
  assert.deepEqual(parseDocument(serializeDocument([], [], viewport)).nodes, []);
  const restored = parseDocument(serializeDocument(nodes, [{ id: 'ab', source: 'a', target: 'b' }], viewport));
  assert.equal(restored.edges[0].label, '');
  assert.equal(restored.edges[0].markerEnd, undefined);
});
test('rejects malformed or unsupported documents before changing the editor', () => {
  assert.throws(() => parseDocument('{'));
  for (const change of [
    (d) => { d.version = 99; },
    (d) => { d.nodes[1].id = 'a'; },
    (d) => { d.edges[0].target = 'missing'; },
    (d) => { d.nodes[0].data.name = 10; },
    (d) => { d.nodes[0].position.x = null; },
    (d) => { d.edges[0].data.sourceAnchor = { x: .5, y: .5, side: 'top' }; },
    (d) => { d.viewport.zoom = 0; },
  ]) {
    const doc = JSON.parse(serializeDocument(nodes, edges, viewport));
    change(doc);
    assert.throws(() => parseDocument(JSON.stringify(doc)));
  }
});
