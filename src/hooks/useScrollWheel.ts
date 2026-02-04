import { useRef, useEffect } from "react";

/**
 * Returns a ref to attach to the scroll container. When the user uses
 * trackpad/wheel over it (anywhere inside, including children), the container
 * scrolls. Uses capture phase so wheel events are handled before children.
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
        e.stopPropagation();
      } else if (delta > 0 && canScrollDown) {
        el.scrollTop += delta;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  return ref;
}
