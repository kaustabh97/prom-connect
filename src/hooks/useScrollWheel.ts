import { useRef, useEffect } from "react";

/**
 * Returns a ref to attach to the scroll container. When the user uses
 * trackpad/wheel over it, the container scrolls and the event is consumed
 * so the document body doesn't scroll. Requires passive: false so we use
 * a native listener in useEffect.
 */
export function useScrollWheel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScrollUp = scrollTop > 0;
      const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;
      const delta = e.deltaY;
      if (delta < 0 && canScrollUp) {
        el.scrollTop += delta;
        e.preventDefault();
      } else if (delta > 0 && canScrollDown) {
        el.scrollTop += delta;
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  return ref;
}
