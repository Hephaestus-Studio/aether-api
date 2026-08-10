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
  const { gap = 16, minExpandedWidth = 560, hysteresis = 8, dependencies = [] } = options;

  const containerRef = useRef<TContainer | null>(null);
  const leftRef = useRef<TLeft | null>(null);
  const rightRef = useRef<TRight | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const maxRequiredWidthRef = useRef<number>(minExpandedWidth);

  const checkCollision = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth =
      containerRef.current.clientWidth ||
      containerRef.current.getBoundingClientRect().width;
    if (containerWidth === 0) return;

    // Calculate natural content width when expanded elements are present
    let contentWidth = 0;
    if (leftRef.current && rightRef.current) {
      contentWidth = leftRef.current.scrollWidth + rightRef.current.scrollWidth + gap;
    } else if (containerRef.current.children.length > 0) {
      const children = Array.from(containerRef.current.children) as HTMLElement[];
      children.forEach((child) => {
        contentWidth += child.scrollWidth || child.offsetWidth;
      });
      contentWidth += Math.max(0, children.length - 1) * gap;
    }

    const effectiveRequired = Math.max(
      minExpandedWidth,
      contentWidth,
      maxRequiredWidthRef.current,
    );
    maxRequiredWidthRef.current = effectiveRequired;

    setIsColliding((currentColliding) => {
      if (!currentColliding) {
        if (containerWidth < effectiveRequired) {
          return true;
        }
        return false;
      } else {
        if (containerWidth >= maxRequiredWidthRef.current + hysteresis) {
          return false;
        }
        return true;
      }
    });
  }, [gap, minExpandedWidth, hysteresis]);

  useLayoutEffect(() => {
    checkCollision();

    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      checkCollision();
    });

    observer.observe(containerRef.current);
    if (leftRef.current) observer.observe(leftRef.current);
    if (rightRef.current) observer.observe(rightRef.current);

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
