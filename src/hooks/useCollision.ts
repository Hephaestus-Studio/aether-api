import { useState, useRef, useLayoutEffect, useCallback } from "react";

interface UseCollisionOptions {
  /** Gap in pixels between elements */
  gap?: number;
  /** Minimum width for expanded layout (in px) */
  minExpandedWidth?: number;
  /** Extra width buffer before expanding to prevent oscillation / thrashing */
  hysteresis?: number;
  /** Optional dependencies that should re-trigger measurement */
  dependencies?: any[];
}

export function useCollision<
  TContainer extends HTMLElement = HTMLDivElement,
  TLeft extends HTMLElement = HTMLDivElement,
  TRight extends HTMLElement = HTMLDivElement,
>(options: UseCollisionOptions = {}) {
  const { minExpandedWidth = 500, hysteresis = 8, dependencies = [] } = options;

  const containerRef = useRef<TContainer | null>(null);
  const leftRef = useRef<TLeft | null>(null);
  const rightRef = useRef<TRight | null>(null);
  const [isColliding, setIsColliding] = useState(false);

  const checkCollision = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth =
      containerRef.current.clientWidth || containerRef.current.getBoundingClientRect().width;
    if (containerWidth === 0) return;

    setIsColliding((currentColliding) => {
      if (!currentColliding) {
        return containerWidth < minExpandedWidth;
      } else {
        return containerWidth < minExpandedWidth + hysteresis;
      }
    });
  }, [minExpandedWidth, hysteresis]);

  useLayoutEffect(() => {
    checkCollision();

    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      checkCollision();
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkCollision, ...dependencies]);

  return {
    containerRef,
    leftRef,
    rightRef,
    isColliding,
    checkCollision,
  };
}
