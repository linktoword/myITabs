/**
 * 书签分类横向轮播。
 * 位移跟手，松手后按速度落到相邻分类，两端用橡皮筋挡住。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const LOCK_DISTANCE = 10;
const RUBBER_CONSTANT = 0.55;
const DECELERATION = 0.998;
const STIFFNESS = 280;
const MAX_VELOCITY = 2800;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** 越出边界越多，跟手越少 */
function rubberband(overshoot, dimension) {
  const abs = Math.abs(overshoot);
  const resisted = (abs * dimension * RUBBER_CONSTANT) / (dimension + RUBBER_CONSTANT * abs);
  return Math.sign(overshoot) * resisted;
}

/** 用松手速度估计还会滑多远，单位是像素 */
function project(velocity) {
  return (velocity / 1000) * DECELERATION / (1 - DECELERATION);
}

function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function useCategoryPager({ count, index, suspended, onIndexChange }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const countRef = useRef(count);
  const indexRef = useRef(index);
  const suspendedRef = useRef(suspended);
  const onIndexChangeRef = useRef(onIndexChange);
  const xRef = useRef(0);
  const widthRef = useRef(1);
  const progressRef = useRef(index);
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const wheelTimerRef = useRef(0);
  const suppressClickRef = useRef(false);
  const mountedRef = useRef(false);
  const [progress, setProgress] = useState(index);

  useLayoutEffect(() => {
    countRef.current = count;
    suspendedRef.current = suspended;
    onIndexChangeRef.current = onIndexChange;
  }, [count, suspended, onIndexChange]);

  const measure = useCallback(() => {
    const width = viewportRef.current?.clientWidth || 0;
    if (width > 0) widthRef.current = width;
    return widthRef.current || 1;
  }, []);

  const applyX = useCallback((x) => {
    xRef.current = x;
    const width = widthRef.current || 1;
    const maxIndex = Math.max(0, countRef.current - 1);
    const nextProgress = clamp(-x / width, 0, maxIndex);
    progressRef.current = nextProgress;
    setProgress((current) => (Math.abs(current - nextProgress) < 0.001 ? current : nextProgress));
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
  }, []);

  const clampDrag = useCallback((x) => {
    const width = widthRef.current || 1;
    const min = -(Math.max(countRef.current, 1) - 1) * width;
    if (x > 0) return rubberband(x, width);
    if (x < min) return min + rubberband(x - min, width);
    return x;
  }, []);

  const animateTo = useCallback((nextIndex, velocity = 0) => {
    const clamped = clamp(nextIndex, 0, Math.max(0, countRef.current - 1));
    const changed = indexRef.current !== clamped;
    indexRef.current = clamped;
    const width = measure();
    const target = -clamped * width;
    cancelAnimationFrame(frameRef.current);
    if (prefersReducedMotion()) {
      applyX(target);
      if (changed) onIndexChangeRef.current?.(clamped);
      return;
    }

    let x = xRef.current;
    let speed = velocity;
    const damping = 2 * Math.sqrt(STIFFNESS);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const force = -STIFFNESS * (x - target) - damping * speed;
      speed += force * dt;
      x += speed * dt;
      applyX(x);
      if (Math.abs(x - target) < 0.6 && Math.abs(speed) < 24) {
        applyX(target);
        if (changed) onIndexChangeRef.current?.(clamped);
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [applyX, measure]);

  const snapFromPosition = useCallback((velocity = 0) => {
    const width = measure();
    const maxIndex = Math.max(0, countRef.current - 1);
    const min = -maxIndex * width;
    // 已经拉出边界时，向外的速度不再继续甩，直接弹回
    let releaseVelocity = clamp(velocity, -MAX_VELOCITY, MAX_VELOCITY);
    if (xRef.current > 0 && releaseVelocity > 0) releaseVelocity = 0;
    if (xRef.current < min && releaseVelocity < 0) releaseVelocity = 0;
    const visual = -xRef.current / width;
    const base = clamp(Math.round(visual), 0, maxIndex);
    let target = Math.round(-(xRef.current + project(releaseVelocity)) / width);
    target = clamp(target, base - 1, base + 1);
    animateTo(clamp(target, 0, maxIndex), releaseVelocity);
  }, [animateTo, measure]);

  const goTo = useCallback((nextIndex) => {
    dragRef.current = null;
    animateTo(nextIndex, 0);
  }, [animateTo]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const detachWindow = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerDown = (event) => {
      if (suspendedRef.current || event.button !== 0) return;
      if (isTypingTarget(event.target)) return;
      if (event.target.closest?.('button, a')) return;
      const onItem = event.target.closest?.('[data-shortcut-id], [data-widget-id]');
      if (event.pointerType === 'mouse' && onItem) return;

      cancelAnimationFrame(frameRef.current);
      window.clearTimeout(wheelTimerRef.current);
      dragRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: xRef.current,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
        locked: null,
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.locked) {
        if (Math.hypot(dx, dy) < LOCK_DISTANCE) return;
        drag.locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      }

      if (drag.locked === 'y') {
        if (event.pointerType !== 'mouse') {
          viewport.scrollTop -= event.clientY - drag.lastY;
        }
        drag.lastY = event.clientY;
        return;
      }

      event.preventDefault();
      const now = performance.now();
      const dt = now - drag.lastTime;
      if (dt >= 8) {
        const instant = clamp(((event.clientX - drag.lastX) / dt) * 1000, -MAX_VELOCITY, MAX_VELOCITY);
        drag.velocity = drag.velocity * 0.65 + instant * 0.35;
      }
      drag.lastX = event.clientX;
      drag.lastTime = now;
      applyX(clampDrag(drag.originX + dx));
    };

    const onPointerUp = (event) => {
      const drag = dragRef.current;
      if (drag && drag.id !== event.pointerId) return;
      dragRef.current = null;
      detachWindow();
      if (!drag || drag.locked !== 'x') return;
      if (Math.abs(event.clientX - drag.startX) > LOCK_DISTANCE) suppressClickRef.current = true;

      const velocity = performance.now() - drag.lastTime > 80 ? 0 : drag.velocity;
      snapFromPosition(velocity);
    };

    const onWheel = (event) => {
      if (suspendedRef.current) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 1) return;
      event.preventDefault();
      cancelAnimationFrame(frameRef.current);
      applyX(clampDrag(xRef.current - event.deltaX));
      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => snapFromPosition(0), 90);
    };

    const onClickCapture = (event) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event) => {
      if (suspendedRef.current || isTypingTarget(event.target)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      animateTo(indexRef.current + direction, 0);
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('click', onClickCapture, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      detachWindow();
      cancelAnimationFrame(frameRef.current);
      window.clearTimeout(wheelTimerRef.current);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [animateTo, applyX, clampDrag, measure, snapFromPosition]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => {
      const next = viewport.clientWidth || 1;
      const previous = widthRef.current || next;
      if (dragRef.current?.locked === 'x' && previous > 0) {
        const scaled = xRef.current * (next / previous);
        widthRef.current = next;
        applyX(scaled);
        return;
      }
      widthRef.current = next;
      applyX(-indexRef.current * next);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyX]);

  useEffect(() => {
    const width = measure();
    if (!mountedRef.current) {
      mountedRef.current = true;
      indexRef.current = index;
      applyX(-index * width);
      return;
    }
    if (index === indexRef.current || dragRef.current) return;
    animateTo(index, 0);
  }, [index, animateTo, applyX, measure]);

  useEffect(() => {
    if (!suspended || !dragRef.current) return;
    dragRef.current = null;
    cancelAnimationFrame(frameRef.current);
    animateTo(indexRef.current, 0);
  }, [suspended, animateTo]);

  return { viewportRef, trackRef, progress, goTo };
}
