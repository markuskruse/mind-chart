import assert from 'node:assert/strict';
import test from 'node:test';
import { followDraggedNodes } from '../src/connectionAnchors.ts';

const node = (id, x, y = 0, width = 100, height = 60) => ({ id, position: { x, y }, measured: { width, height }, data: {} });

test('connection attachments follow a node dragged around its neighbor', () => {
  const edge = { id: 'ab', source: 'a', target: 'b', data: { note: 'preserved' } };
  const right = followDraggedNodes([node('a', 0), node('b', 300)], [edge], ['a'])[0];
  assert.deepEqual(right.data.sourceAnchor, { x: 1, y: .5, side: 'right' });
  assert.deepEqual(right.data.targetAnchor, { x: 0, y: .5, side: 'left' });

  const left = followDraggedNodes([node('a', 600), node('b', 300)], [right], ['a'])[0];
  assert.deepEqual(left.data.sourceAnchor, { x: 0, y: .5, side: 'left' });
  assert.deepEqual(left.data.targetAnchor, { x: 1, y: .5, side: 'right' });
  assert.equal(left.data.note, 'preserved');
});

test('uses top and bottom borders for mostly vertical connections', () => {
  const edge = { id: 'ab', source: 'a', target: 'b' };
  const result = followDraggedNodes([node('a', 20, 300), node('b', 0, 0)], [edge], ['a'])[0];
  assert.equal(result.data.sourceAnchor.side, 'top');
  assert.equal(result.data.targetAnchor.side, 'bottom');
});

test('leaves unaffected, missing, and coincident connections unchanged', () => {
  const edge = { id: 'ab', source: 'a', target: 'b' };
  const nodes = [node('a', 0), node('b', 300)];
  assert.equal(followDraggedNodes(nodes, [edge], ['other'])[0], edge);
  assert.equal(followDraggedNodes([node('a', 0)], [edge], ['a'])[0], edge);
  assert.equal(followDraggedNodes([node('a', 0), node('b', 0)], [edge], ['a'])[0], edge);
});

test('slides and evenly separates parallel connections between the same pair of nodes', () => {
  const first = { id: 'ab-1', source: 'a', target: 'b', data: {
    sourceAnchor: { x: .25, y: 0, side: 'top' }, targetAnchor: { x: .75, y: 1, side: 'bottom' },
  } };
  const second = { id: 'ab-2', source: 'b', target: 'a', data: {
    sourceAnchor: { x: 1, y: .25, side: 'right' }, targetAnchor: { x: 0, y: .75, side: 'left' },
  } };
  const single = { id: 'ac', source: 'a', target: 'c' };
  const edges = [first, second, single];
  const result = followDraggedNodes([node('a', 600), node('b', 300), node('c', 900)], edges, ['a']);
  assert.deepEqual(result[0].data.sourceAnchor, { x: 0, y: .25, side: 'left' });
  assert.deepEqual(result[0].data.targetAnchor, { x: 1, y: .25, side: 'right' });
  assert.deepEqual(result[1].data.sourceAnchor, { x: 1, y: .75, side: 'right' });
  assert.deepEqual(result[1].data.targetAnchor, { x: 0, y: .75, side: 'left' });
  assert.notEqual(result[2], single);
});

test('evenly spaces multiple sliding anchors along the same node side', () => {
  const nodes = [node('center', 0, 0, 300), node('left', 0, 300), node('middle', 100, 300), node('right', 200, 300)];
  const edges = ['right', 'left', 'middle'].map((target) => ({ id: `to-${target}`, source: 'center', target }));
  const result = followDraggedNodes(nodes, edges, ['center']);
  assert.deepEqual(result.map((edge) => edge.data.sourceAnchor.side), ['bottom', 'bottom', 'bottom']);
  assert.deepEqual(result.map((edge) => edge.data.sourceAnchor.x * 300), [250, 50, 150]);
});

test('includes stationary connections when redistributing a touched side', () => {
  const nodes = [node('a', 0, 0, 300), node('b', 0, 300), node('c', 200, 300)];
  const edges = [
    { id: 'ab-1', source: 'a', target: 'b' },
    { id: 'ab-2', source: 'a', target: 'b' },
    { id: 'ac', source: 'a', target: 'c', data: {
      sourceAnchor: { x: .9, y: 1, side: 'bottom' }, targetAnchor: { x: .5, y: 0, side: 'top' },
    } },
  ];
  const result = followDraggedNodes(nodes, edges, ['b']);
  assert.deepEqual(result.map((edge) => edge.data.sourceAnchor.x * 300), [50, 150, 250]);
  assert.deepEqual(result[2].data.targetAnchor, edges[2].data.targetAnchor);
});
