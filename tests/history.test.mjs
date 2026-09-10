import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentHistory } from '../src/history.ts';
const snapshot = (n) => ({ document: JSON.stringify({ nodes: [{ name: `node ${n}` }], edges: [{ label: `edge ${n}` }], viewport: { x: n, y: 0, zoom: 1 } }), content: String(n) });
test('stores whole documents and restores both directions', () => {
  const h = new DocumentHistory(snapshot(0));
  h.record(snapshot(1));
  assert.deepEqual(h.undo(), snapshot(0));
  assert.deepEqual(h.redo(), snapshot(1));
});
test('retains exactly ten undo steps', () => {
  const h = new DocumentHistory(snapshot(0));
  for (let i = 1; i <= 15; i++) h.record(snapshot(i));
  assert.equal(h.past.length, 10);
  for (let i = 14; i >= 5; i--) assert.deepEqual(h.undo(), snapshot(i));
  assert.equal(h.undo(), null);
  for (let i = 6; i <= 15; i++) assert.deepEqual(h.redo(), snapshot(i));
  assert.equal(h.redo(), null);
});
test('field edits and continuous gestures form single steps', () => {
  const h = new DocumentHistory(snapshot(0));
  for (let i = 1; i <= 30; i++) h.record(snapshot(i), 'node-name-focus');
  assert.equal(h.past.length, 1);
  h.record(snapshot(31), 'connection-text-focus');
  h.record(snapshot(32), 'connection-text-focus');
  assert.equal(h.past.length, 2);
  assert.deepEqual(h.undo(), snapshot(30));
  assert.deepEqual(h.undo(), snapshot(0));
  assert.deepEqual(h.redo(), snapshot(30));
});
test('consecutive uses of the same action collapse until another edit occurs', () => {
  const h = new DocumentHistory(snapshot(0));
  h.record(snapshot(1), 'layout-spread');
  h.record(snapshot(2), 'layout-spread');
  h.record(snapshot(3), 'layout-spread');
  assert.equal(h.past.length, 1);

  h.record(snapshot(4), 'layout-closer');
  h.record(snapshot(5), 'layout-spread');
  assert.equal(h.past.length, 3);
  assert.deepEqual(h.undo(), snapshot(4));
  assert.deepEqual(h.undo(), snapshot(3));
  assert.deepEqual(h.undo(), snapshot(0));
});
test('new edits discard redo, no-op changes preserve it, and loading resets', () => {
  const h = new DocumentHistory(snapshot(0));
  h.record(snapshot(1)); h.record(snapshot(2)); h.undo();
  assert.equal(h.record(snapshot(1)), false);
  assert.equal(h.future.length, 1);
  h.record(snapshot(3));
  assert.equal(h.redo(), null);
  h.reset(snapshot(100));
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), null);
  assert.deepEqual(h.present, snapshot(100));
});
