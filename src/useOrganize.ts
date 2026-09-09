import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { createOrganizeState, organizeStep } from "./organize";
import type { IdeaNode } from "./document";

export function useOrganize() {
  const { getNodes, getEdges, setNodes } = useReactFlow<IdeaNode>();
  const frame = useRef<number | null>(null);
  const running = useRef(false);
  const [organizing, setOrganizing] = useState(false);
  const stop = useCallback(() => {
    running.current = false;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setOrganizing(false);
  }, []);
  const start = useCallback(() => {
    if (running.current || getNodes().length < 2) return;
    running.current = true;
    setOrganizing(true);
    const state = createOrganizeState();
    let last = 0;
    const tick = (time: number) => {
      if (!running.current) return;
      // At most 60 fixed steps per second, independent of display refresh rate.
      if (time - last >= 1000 / 60) {
        last = time;
        const result = organizeStep(getNodes(), getEdges(), state);
        setNodes(result.nodes);
        if (result.stable) { stop(); return; }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [getNodes, getEdges, setNodes, stop]);
  useEffect(() => {
    const keyup = (event: KeyboardEvent) => { if (event.key === " " || event.key === "Enter" || event.key === "Escape") stop(); };
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      running.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keyup", keyup);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stop]);
  return { start, stop, organizing };
}
