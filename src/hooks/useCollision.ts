import { useState, useRef, useLayoutEffect, useCallback } from "react";

interface UseCollisionOptions {
  /** Gap in pixels between elements */
  gap?: number;
  /** Initial fallback minimum width for expanded layout (in px) */
  minExpandedWidth?: number;
  /** Extra width buffer before expanding to prevent oscillation / thrashing */
  hysteresis?: number;
}

export function useCollision<
  TContainer extends HTMLElement = HTMLDivElement,
  TLeft extends HTMLElement = HTMLDivElement,
  TRight extends HTMLElement = HTMLDivElement,
>(options: UseCollisionOptions = {}) {
  const { gap = 16, minExpandedWidth = 560, hysteresis = 8 } = options;

  const containerRef = useRef<TContainer | null>(null);
  const leftRef = useRef<TLeft | null>(null);
  const rightRef = useRef<TRight | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const requiredWidthRef = useRef<number>(minExpandedWidth);

  const checkCollision = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return;

    if (!isColliding) {
      let contentWidth = 0;
      if (leftRef.current && rightRef.current) {
        contentWidth = leftRef.current.scrollWidth + rightRef.current.scrollWidth + gap;
      } else {
        const children = Array.from(containerRef.current.children) as HTMLElement[];
        children.forEach((child) => {
          contentWidth += child.scrollWidth || child.offsetWidth;
        });
        contentWidth += Math.max(0, children.length - 1) * gap;
      }

      if (contentWidth > requiredWidthRef.current) {
        requiredWidthRef.current = contentWidth;
      }

      if (containerWidth < requiredWidthRef.current) {
        setIsColliding(true);
      }
    } else {
      if (containerWidth >= requiredWidthRef.current + hysteresis) {
        setIsColliding(false);
      }
    }
  }, [gap, hysteresis, isColliding]);

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
  }, [checkCollision]);

  return {
    containerRef,
    leftRef,
    rightRef,
    isColliding,
  };
}
