export type Snapshot = { document: string; content: string };

/** Whole-document snapshots; selection and viewport-only changes are not edits. */
export class DocumentHistory {
  past: Snapshot[] = [];
  future: Snapshot[] = [];
  present: Snapshot;
  private group: string | null = null;
  constructor(initial: Snapshot) { this.present = initial; }
  record(next: Snapshot, group: string | null = null) {
    if (next.content === this.present.content) return false;
    if (group === null || group !== this.group) {
      this.past = [...this.past, this.present].slice(-10);
    }
    this.present = next;
    this.group = group;
    this.future = [];
    return true;
  }
  endGroup() { this.group = null; }
  undo() {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.present);
    this.present = previous;
    this.endGroup();
    return previous;
  }
  redo() {
    const next = this.future.pop();
    if (!next) return null;
    this.past = [...this.past, this.present].slice(-10);
    this.present = next;
    this.endGroup();
    return next;
  }
  reset(snapshot: Snapshot) {
    this.present = snapshot;
    this.past = [];
    this.future = [];
    this.endGroup();
  }
}
