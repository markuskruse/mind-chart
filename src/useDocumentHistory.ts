import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Edge, useReactFlow } from "@xyflow/react";
import { parseDocument, serializeDocument, type IdeaNode, type MapDocument } from "./document";
import { DocumentHistory } from "./history";

const contentOf = (nodes: IdeaNode[], edges: Edge[]) => serializeDocument(nodes, edges, { x: 0, y: 0, zoom: 1 });

export function useDocumentHistory(nodes: IdeaNode[], edges: Edge[], layoutAction: string | null) {
  const { getViewport, setViewport, setNodes, setEdges } = useReactFlow<IdeaNode>();
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const history = useRef<DocumentHistory | null>(null);
  if (!history.current) history.current = new DocumentHistory({
    document: serializeDocument(nodes, edges, getViewport()), content: contentOf(nodes, edges),
  });
  const gesture = useRef<string | null>(null);
  const sequence = useRef(0);
  const layoutGroup = useRef<string | null>(null);
  const refresh = () => setCounts({ undo: history.current!.past.length, redo: history.current!.future.length });

  useEffect(() => {
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = (event: PointerEvent) => {
      clearTimeout(endTimer);
      const target = event.target;
      // Repositioning the caret in the focused field continues the same edit.
      if (target === document.activeElement && (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === "text"))) return;
      gesture.current = `gesture-${++sequence.current}`;
    };
    const end = () => {
      // Let the last pointer-up mutation render before closing its transaction.
      const current = gesture.current;
      endTimer = setTimeout(() => { if (gesture.current === current) gesture.current = null; }, 0);
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === "text")) {
        gesture.current = `text-${++sequence.current}`;
        clearTimeout(endTimer);
      }
    };
    const release = () => {
      const target = document.activeElement;
      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === "text")) return;
      end();
    };
    window.addEventListener("pointerdown", begin, true);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", end);
    window.addEventListener("focusin", focus);
    window.addEventListener("focusout", end);
    window.addEventListener("blur", end);
    return () => {
      clearTimeout(endTimer);
      window.removeEventListener("pointerdown", begin, true);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("focusin", focus);
      window.removeEventListener("focusout", end);
      window.removeEventListener("blur", end);
    };
  }, []);

  useLayoutEffect(() => {
    if (layoutAction !== null) layoutGroup.current = `layout-${layoutAction}`;
    const changed = history.current!.record({ document: serializeDocument(nodes, edges, getViewport()), content: contentOf(nodes, edges) }, layoutGroup.current ?? gesture.current);
    if (changed) refresh();
  }, [nodes, edges, layoutAction, getViewport]);

  useEffect(() => {
    if (layoutAction !== null || layoutGroup.current === null) return;
    // React Flow flushes its final controlled-node update after a layout stops.
    const timer = setTimeout(() => {
      layoutGroup.current = null;
    }, 0);
    return () => clearTimeout(timer);
  }, [layoutAction]);

  function restore(direction: "undo" | "redo") {
    const snapshot = history.current![direction]();
    if (!snapshot) return;
    const document = parseDocument(snapshot.document);
    setNodes(document.nodes);
    setEdges(document.edges);
    void setViewport(document.viewport);
    gesture.current = null;
    refresh();
  }
  function reset(document: MapDocument) {
    history.current!.reset({ document: serializeDocument(document.nodes, document.edges, document.viewport), content: contentOf(document.nodes, document.edges) });
    gesture.current = null;
    refresh();
  }
  return { undo: () => restore("undo"), redo: () => restore("redo"), reset, canUndo: counts.undo > 0, canRedo: counts.redo > 0 };
}
