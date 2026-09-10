import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { relaxNodes } from "./relax";
import type { IdeaNode } from "./document";

export function useRelax() {
  const { getNodes, getEdges, setNodes } = useReactFlow<IdeaNode>();
  const frame = useRef<number | null>(null);
  const running = useRef(false);
  const [relaxing, setRelaxing] = useState(false);

  const stop = useCallback(() => {
    running.current = false;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRelaxing(false);
  }, []);

  const start = useCallback(() => {
    if (running.current || getEdges().length < 2) return;
    running.current = true;
    setRelaxing(true);
    let last = 0;
    const tick = (time: number) => {
      if (!running.current) return;
      // Run more gently than Organize while still looking smooth.
      if (time - last >= 1000 / 30) {
        last = time;
        const current = getNodes();
        const next = relaxNodes(current, getEdges());
        if (next === current) { stop(); return; }
        setNodes(next);
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

  return { start, stop, relaxing };
}
