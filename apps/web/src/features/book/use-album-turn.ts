"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

const SEGMENTS = 10;

function copyPageNode(node: Node): Node | null {
  if (node instanceof HTMLVideoElement) {
    if (node.readyState < 2 || !node.videoWidth) return null;
    const frame = document.createElement("canvas");
    const scale = Math.min(
      1,
      480 / Math.max(node.videoWidth, node.videoHeight),
    );
    frame.width = Math.round(node.videoWidth * scale);
    frame.height = Math.round(node.videoHeight * scale);
    frame.className = node.className;
    frame.style.cssText = node.style.cssText;
    try {
      const context = frame.getContext("2d");
      if (!context) return null;
      context.drawImage(node, 0, 0, frame.width, frame.height);
      return frame;
    } catch {
      // The still poster beneath it remains available when a frame cannot draw.
      return null;
    }
  }
  const copy = node.cloneNode(false);
  if (node instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement) {
    copy.getContext("2d")?.drawImage(node, 0, 0);
  }
  for (const child of node.childNodes) {
    const childCopy = copyPageNode(child);
    if (childCopy) copy.appendChild(childCopy);
  }
  return copy;
}

function copyLeaf(leaf: HTMLElement) {
  // Never clone a media source into the moving sheet: it carries still frames.
  const copy = copyPageNode(leaf) as HTMLElement;
  copy.removeAttribute("data-album-left");
  copy.removeAttribute("data-album-right");
  for (const svg of copy.querySelectorAll("svg")) {
    const filter = svg.querySelector("filter[id]");
    const oldId = filter?.id;
    if (!filter || !oldId) continue;
    const id = `album-${crypto.randomUUID()}`;
    filter.id = id;
    for (const target of svg.querySelectorAll("[filter]"))
      target.setAttribute("filter", `url(#${id})`);
  }
  if (leaf.isConnected) {
    // Percentage padding would otherwise resolve against each narrow strip.
    const style = getComputedStyle(leaf);
    copy.style.padding = style.padding;
    copy.style.gap = style.gap;
  }
  return copy;
}

// Browser-owned snapshots keep the actual photos on both sides of the sheet.
// React continues to own the live, accessible spread beneath this decoration.
export function useAlbumTurn(
  root: RefObject<HTMLDivElement | null>,
  page: number,
) {
  const pending = useRef<{
    direction: number;
    left: HTMLElement;
    right: HTMLElement;
  } | null>(null);
  const finish = useRef<(() => void) | null>(null);

  useGSAP(
    () => {
      const previous = pending.current;
      pending.current = null;
      const spread = root.current;
      const left = spread?.querySelector<HTMLElement>("[data-album-left]");
      const right = spread?.querySelector<HTMLElement>("[data-album-right]");
      if (!spread || !previous || !left || !right) return;

      const forward = previous.direction > 0;
      const width = parseFloat(getComputedStyle(forward ? right : left).width);
      const height = parseFloat(getComputedStyle(spread).height);
      const stripWidth = width / SEGMENTS;
      const overlay = document.createElement("div");
      overlay.className = "home-album-turn";
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;

      const stationary = forward ? previous.left : previous.right;
      Object.assign(stationary.style, {
        position: "absolute",
        top: "0",
        left: forward ? "0" : "50%",
        width: `${width}px`,
        height: `${height}px`,
      });
      overlay.append(stationary);

      const shadow = document.createElement("div");
      shadow.className = "home-album-turn-shadow";
      overlay.append(shadow);

      const sheet = document.createElement("div");
      sheet.className = "home-album-turn-sheet";
      Object.assign(sheet.style, {
        left: forward ? "50%" : "0",
        transformOrigin: forward ? "0% 50%" : "100% 50%",
      });
      overlay.append(sheet);

      const strips: HTMLElement[] = [];
      const shades: HTMLElement[] = [];
      let parent = sheet;
      for (let index = 0; index < SEGMENTS; index++) {
        const strip = document.createElement("div");
        strip.className = "home-album-turn-strip";
        Object.assign(strip.style, {
          width: `${stripWidth}px`,
          [forward ? "left" : "right"]: index === 0 ? "0" : "100%",
          transformOrigin: forward ? "0% 50%" : "100% 50%",
        });
        parent.append(strip);
        strips.push(strip);

        for (const back of [false, true]) {
          const face = document.createElement("div");
          face.className = `home-album-turn-face${back ? " home-album-turn-back" : ""}`;
          const source = back
            ? forward
              ? left
              : right
            : forward
              ? previous.right
              : previous.left;
          const slice = forward !== back ? index : SEGMENTS - index - 1;
          const content = copyLeaf(source);
          Object.assign(content.style, {
            position: "absolute",
            top: "0",
            left: `${-slice * stripWidth}px`,
            width: `${width}px`,
            height: `${height}px`,
          });
          const shade = document.createElement("div");
          shade.className = "home-album-turn-shade";
          shades.push(shade);
          face.append(content, shade);
          strip.append(face);
        }
        parent = strip;
      }
      spread.append(overlay);
      spread.setAttribute("inert", "");
      spread.setAttribute("aria-busy", "true");

      // Each short section bends relative to its neighbour, so the outer edge
      // trails the spine instead of swinging like a rigid door.
      const progress = { value: 0 };
      const render = () => {
        const t = progress.value;
        const lift = Math.sin(Math.PI * t);
        const bend = previous.direction * 3.2 * lift;
        const angle = -previous.direction * 180 * t - bend * (SEGMENTS / 2);
        sheet.style.transform = `translateZ(1px) rotateY(${angle}deg)`;
        for (let index = 0; index < strips.length; index++) {
          const strip = strips[index];
          if (!strip) continue;
          strip.style.transform = `rotateY(${bend}deg)`;
          const localAngle = angle + bend * (index + 1);
          const shade =
            0.22 * (1 - Math.abs(Math.cos((localAngle * Math.PI) / 180)));
          for (const faceShade of shades.slice(index * 2, index * 2 + 2))
            faceShade.style.opacity = `${shade}`;
        }
        // The shadow narrows at the spine as the leaf stands upright, then
        // widens and softens over the opposite page before settling.
        const projection = Math.cos(Math.PI * t);
        const side = projection > 0 === forward;
        const shadowWidth = width * (0.08 + 0.92 * Math.abs(projection));
        Object.assign(shadow.style, {
          left: side ? "50%" : `calc(50% - ${shadowWidth}px)`,
          width: `${shadowWidth}px`,
          opacity: `${lift * 0.32}`,
          filter: `blur(${3 + lift * 9}px)`,
          transform: `translateY(${lift * 3}px)`,
        });
      };
      let done = false;
      const settle = () => {
        if (done) return;
        done = true;
        tween.kill();
        overlay.remove();
        spread.removeAttribute("inert");
        spread.removeAttribute("aria-busy");
        finish.current = null;
      };
      finish.current = settle;
      render();
      const tween = gsap.to(progress, {
        value: 1,
        duration: 1.15,
        ease: "sine.inOut",
        onUpdate: render,
        onComplete: settle,
      });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onHidden = () => {
        if (document.hidden) settle();
      };
      window.addEventListener("resize", settle);
      document.addEventListener("visibilitychange", onHidden);
      reduced.addEventListener("change", settle);
      return () => {
        settle();
        window.removeEventListener("resize", settle);
        document.removeEventListener("visibilitychange", onHidden);
        reduced.removeEventListener("change", settle);
      };
    },
    { scope: root, dependencies: [page], revertOnUpdate: true },
  );

  const turn = (direction: number, commit: () => void) => {
    // A second request finishes the current sheet before starting the next;
    // snapshots never stack up or leave the album between two spreads.
    finish.current?.();
    const left = root.current?.querySelector<HTMLElement>("[data-album-left]");
    const right =
      root.current?.querySelector<HTMLElement>("[data-album-right]");
    if (
      left &&
      right &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      pending.current = {
        direction,
        left: copyLeaf(left),
        right: copyLeaf(right),
      };
    }
    commit();
  };

  return turn;
}
