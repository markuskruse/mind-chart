import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { scaleNodePositions } from "./spacing";
import type { IdeaNode } from "./document";

export type SpacingDirection = "spread" | "closer";

export function useSpacing() {
  const { getNodes, setNodes } = useReactFlow<IdeaNode>();
  const frame = useRef<number | null>(null);
  const running = useRef(false);
  const [direction, setDirection] = useState<SpacingDirection | null>(null);

  const stop = useCallback(() => {
    running.current = false;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setDirection(null);
  }, []);

  const start = useCallback((nextDirection: SpacingDirection) => {
    if (running.current || getNodes().length < 2) return;
    running.current = true;
    setDirection(nextDirection);
    const factor = nextDirection === "spread" ? 1.002 : 1 / 1.002;
    let last = 0;
    const tick = (time: number) => {
      if (!running.current) return;
      if (time - last >= 1000 / 30) {
        last = time;
        setNodes(scaleNodePositions(getNodes(), factor));
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [getNodes, setNodes]);

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

  return { start, stop, direction };
}
