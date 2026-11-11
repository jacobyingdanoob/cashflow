import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type Box = { top: number; left: number; width: number; height: number };
type Placement = {
  target: Box;
  card: CSSProperties;
  side: "left" | "right" | "above" | "below";
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

function visibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
  );
}

/** Measure the real callout, then reveal and place it outside the real feature. */
export default function useTutorialPlacement(
  selector: string | undefined,
  card: RefObject<HTMLDivElement | null>,
  onRevealTarget?: (selector: string) => void,
) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const revealCallback = useRef(onRevealTarget);
  revealCallback.current = onRevealTarget;

  useLayoutEffect(() => {
    setPlacement(null);
    if (!selector) return;
    revealCallback.current?.(selector);

    let frame = 0;
    let disposed = false;
    let target: HTMLElement | undefined;
    let reveal = true;
    const restorations: (() => void)[] = [];
    const remembered = new WeakMap<HTMLElement, Set<string>>();

    // All temporary sizing and scroll room belong to this step and are restored
    // before the next step or when the tutorial is disabled.
    const temporaryStyle = (
      element: HTMLElement,
      name: string,
      value: string,
    ) => {
      const properties = remembered.get(element) ?? new Set<string>();
      if (!properties.has(name)) {
        const original = element.style.getPropertyValue(name);
        const priority = element.style.getPropertyPriority(name);
        restorations.push(() => {
          if (original) element.style.setProperty(name, original, priority);
          else element.style.removeProperty(name);
        });
        properties.add(name);
        remembered.set(element, properties);
      }
      if (element.style.getPropertyValue(name) !== value)
        element.style.setProperty(name, value);
    };

    const scrollTarget = (element: HTMLElement, desiredTop: number) => {
      // scrollIntoView on an inert game element can be ignored by browsers.
      // Scroll its actual container, including worksheets inside a modal.
      const modal = element.closest<HTMLElement>(".modal");
      const scrollBy = (container: HTMLElement) => {
        const delta = element.getBoundingClientRect().top - desiredTop;
        container.scrollTo({
          top: container.scrollTop + delta,
          behavior: "instant",
        });
      };
      for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (
          parent.scrollHeight > parent.clientHeight &&
          /auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)
        )
          scrollBy(parent);
      }
      if (!modal && !element.closest(".notification-stack")) {
        const delta = element.getBoundingClientRect().top - desiredTop;
        window.scrollBy({ top: delta, behavior: "instant" });
      }
    };

    const update = () => {
      frame = 0;
      if (disposed || !card.current) return;
      const nextTarget = visibleTarget(selector);
      if (!nextTarget) {
        setPlacement(null);
        return;
      }
      if (target !== nextTarget) {
        if (target) observer.unobserve(target);
        target = nextTarget;
        observer.observe(target);
        reveal = true;
      }
      const callout = card.current;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const margin = viewportWidth <= 560 ? 12 : 18;
      const gap = 20;
      const padding = 7;
      let rect = target.getBoundingClientRect();
      const rightRoom = viewportWidth - margin - rect.right - padding - gap;
      const leftRoom = rect.left - padding - gap - margin;
      const beside = Math.max(rightRoom, leftRoom) >= 280;
      const side = beside && rightRoom >= leftRoom ? "right" : "left";
      const width = beside
        ? Math.min(356, Math.max(rightRoom, leftRoom))
        : Math.min(440, viewportWidth - margin * 2);
      const maxHeight = beside
        ? viewportHeight - margin * 2
        : Math.floor((viewportHeight - margin * 2 - gap) * 0.55);
      callout.style.width = `${width}px`;
      callout.style.maxHeight = `${maxHeight}px`;
      const cardHeight = callout.getBoundingClientRect().height;
      const targetMaxHeight = Math.max(
        72,
        viewportHeight -
          margin * 2 -
          padding * 2 -
          (beside ? 0 : cardHeight + gap),
      );
      // Keep tall boards and panels in the available viewing area. SVG boards
      // retain their aspect ratio; long HTML panels can still scroll internally.
      if (
        rect.height > targetMaxHeight + 1 ||
        remembered.get(target)?.has("max-height")
      ) {
        temporaryStyle(target, "max-height", `${targetMaxHeight}px`);
        if (!(target instanceof SVGElement))
          temporaryStyle(target, "overflow-y", "auto");
        rect = target.getBoundingClientRect();
      }

      if (reveal) {
        reveal = false;
        const visible =
          rect.top - padding >= margin &&
          rect.bottom + padding <= viewportHeight - margin;
        const belowFits =
          rect.bottom + padding + gap + cardHeight <= viewportHeight - margin;
        const aboveFits = rect.top - padding - gap - cardHeight >= margin;
        if (!visible || (!beside && !belowFits && !aboveFits)) {
          const room =
            viewportHeight -
            margin * 2 -
            padding * 2 -
            (beside ? 0 : cardHeight + gap);
          const desiredTop =
            margin + padding + Math.max(0, (room - rect.height) / 2);
          scrollTarget(target, desiredTop);
          rect = target.getBoundingClientRect();
          // Near the end of the page/worksheet, reserve enough scroll room to
          // reveal the feature above the callout rather than covering it.
          if (
            !beside &&
            rect.bottom + padding + gap + cardHeight >
              viewportHeight - margin &&
            rect.top - padding - gap - cardHeight < margin &&
            !target.closest(".notification-stack")
          ) {
            const container =
              target.closest<HTMLElement>(".modal") ?? document.body;
            const extra =
              parseFloat(getComputedStyle(container).paddingBottom) +
              cardHeight +
              gap;
            temporaryStyle(container, "padding-bottom", `${extra}px`);
            scrollTarget(target, desiredTop);
            rect = target.getBoundingClientRect();
          }
        }
      }

      const targetBox = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      };
      const cardLeft = beside
        ? side === "right"
          ? rect.right + padding + gap
          : rect.left - padding - gap - width
        : clamp(rect.left, margin, viewportWidth - width - margin);
      const belowFits =
        rect.bottom + padding + gap + cardHeight <= viewportHeight - margin + 1;
      const verticalSide = belowFits ? "below" : "above";
      const top = beside
        ? clamp(
            rect.top + rect.height / 2 - cardHeight / 2,
            margin,
            viewportHeight - cardHeight - margin,
          )
        : belowFits
          ? rect.bottom + padding + gap
          : rect.top - padding - gap - cardHeight;
      const next: Placement = {
        target: targetBox,
        side: beside ? side : verticalSide,
        card: { left: cardLeft, top: Math.max(margin, top), width, maxHeight },
      };
      setPlacement((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(update);
    };
    const resize = () => {
      reveal = true;
      schedule();
    };
    const observer = new ResizeObserver(resize);
    if (card.current) observer.observe(card.current);
    // Wait for mobile view selection and any opening-modal layout to commit.
    schedule();
    document.fonts.ready.then(resize);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, true);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize, true);
      restorations.reverse().forEach((restore) => restore());
      calloutReset(card.current);
    };
  }, [selector, card]);

  return placement;
}

function calloutReset(element: HTMLDivElement | null) {
  element?.style.removeProperty("width");
  element?.style.removeProperty("max-height");
}
