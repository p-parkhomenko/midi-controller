import { ELEMENT_DEFS, gridToPx, pxToGrid, updateElement, saveLayout } from '../core/layout.js';
import { applyIslandGeometry } from './canvas.js';

const DRAG_THRESHOLD_PX = 12;
const DRAG_DELAY_MS     = 150;

/**
 * Attaches Edit mode behaviour to a single island element.
 * Returns a cleanup function.
 */
export function attachEditMode(islandEl, elementData, layout, callbacks) {
  // {
  //   onTap()           — short tap: open Drawer
  //   onMove(x, y)      — drag ended: new grid position
  //   onResize(w, h)    — resize ended: new grid size
  // }

  const def = ELEMENT_DEFS[elementData.type];

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'island-overlay';
  islandEl.appendChild(overlay);

  // Corner handles: tl, tr, bl, br
  const handles = ['tl','tr','bl','br'].map(corner => {
    const h = document.createElement('div');
    h.className = `island-handle island-handle--${corner}`;
    islandEl.appendChild(h);
    return { el: h, corner };
  });

  // ── Drag to move ────────────────────────────────────────────────────────
  let dragTimer    = null;
  let dragActive   = false;
  let dragStartX   = 0;
  let dragStartY   = 0;
  let dragOriginEl = { x: elementData.gridX, y: elementData.gridY };

  const onBodyDown = (e) => {
    if (e.target.classList.contains('island-handle')) return;
    const point = e.touches ? e.touches[0] : e;
    dragStartX = point.clientX;
    dragStartY = point.clientY;
    dragOriginEl = { x: elementData.gridX, y: elementData.gridY };

    dragTimer = setTimeout(() => startDrag(), DRAG_DELAY_MS);

    document.addEventListener('mousemove', onDragMove, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup',   onDragEnd);
    document.addEventListener('touchend',  onDragEnd);
  };

  const startDrag = () => {
    dragActive = true;
    islandEl.classList.add('is-dragging');
    bumpZ();
  };

  const onDragMove = (e) => {
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragStartX;
    const dy = point.clientY - dragStartY;

    if (!dragActive) {
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        clearTimeout(dragTimer);
        startDrag();
      } else return;
    }

    e.preventDefault();
    const newGX = Math.max(0, dragOriginEl.x + pxToGrid(dx));
    const newGY = Math.max(0, dragOriginEl.y + pxToGrid(dy));
    elementData.gridX = newGX;
    elementData.gridY = newGY;
    applyIslandGeometry(islandEl, elementData);
  };

  const onDragEnd = (e) => {
    clearTimeout(dragTimer);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup',   onDragEnd);
    document.removeEventListener('touchend',  onDragEnd);

    if (!dragActive) {
      // Was a short tap
      callbacks.onTap();
    } else {
      islandEl.classList.remove('is-dragging');
      dragActive = false;
      updateElement(layout, elementData.id, { gridX: elementData.gridX, gridY: elementData.gridY });
      if (callbacks.onMove) callbacks.onMove(elementData.gridX, elementData.gridY);
    }
  };

  islandEl.addEventListener('mousedown',  onBodyDown);
  islandEl.addEventListener('touchstart', onBodyDown, { passive: false });

  // ── Resize handles ───────────────────────────────────────────────────────
  for (const { el, corner } of handles) {
    el.addEventListener('mousedown',  (e) => startResize(e, corner));
    el.addEventListener('touchstart', (e) => startResize(e, corner), { passive: false });
  }

  function startResize(e, corner) {
    e.stopPropagation();
    const point = e.touches ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const startW = elementData.gridW;
    const startH = elementData.gridH;
    const startGX = elementData.gridX;
    const startGY = elementData.gridY;

    const onMove = (e) => {
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      const dxPx = pt.clientX - startX;
      const dyPx = pt.clientY - startY;

      let newW = startW;
      let newH = startH;
      let newGX = startGX;
      let newGY = startGY;

      if (corner === 'tr' || corner === 'br') newW = Math.max(def.minW, startW + pxToGrid(dxPx));
      if (corner === 'tl' || corner === 'bl') {
        const dg = pxToGrid(dxPx);
        newW = Math.max(def.minW, startW - dg);
        newGX = startGX + (startW - newW);
      }
      if (corner === 'bl' || corner === 'br') newH = Math.max(def.minH, startH + pxToGrid(dyPx));
      if (corner === 'tl' || corner === 'tr') {
        const dg = pxToGrid(dyPx);
        newH = Math.max(def.minH, startH - dg);
        newGY = startGY + (startH - newH);
      }

      if (def.preserveAspectRatio) {
        // Scale by smallest dimension change
        const scaleW = newW / startW;
        const scaleH = newH / startH;
        const scale  = Math.min(scaleW, scaleH);
        newW = Math.max(def.minW, Math.round(startW * scale));
        newH = Math.max(def.minH, Math.round(startH * scale));
        newGX = startGX;
        newGY = startGY;
      }

      elementData.gridX = newGX;
      elementData.gridY = newGY;
      elementData.gridW = newW;
      elementData.gridH = newH;
      applyIslandGeometry(islandEl, elementData);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchend',  onUp);
      updateElement(layout, elementData.id, {
        gridX: elementData.gridX, gridY: elementData.gridY,
        gridW: elementData.gridW, gridH: elementData.gridH,
      });
      if (callbacks.onResize) callbacks.onResize(elementData.gridW, elementData.gridH);
    };

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchend',  onUp);
  }

  // ── z-index bump ─────────────────────────────────────────────────────────
  let _zCounter = 0;
  function bumpZ() {
    _zCounter++;
    islandEl.style.zIndex = String(Date.now()); // last-touched-on-top
  }

  // Cleanup
  return () => {
    overlay.remove();
    handles.forEach(({ el }) => el.remove());
    islandEl.removeEventListener('mousedown',  onBodyDown);
    islandEl.removeEventListener('touchstart', onBodyDown);
  };
}

// ─── Canvas-level Edit mode ───────────────────────────────────────────────────

/**
 * Activates Edit mode on all islands.
 * Returns deactivate function.
 */
export function activateEditMode(canvasEl, layout, callbacks) {
  // callbacks: { onTap(elementData), onRefresh() }
  const cleanups = [];

  for (const island of canvasEl.querySelectorAll('.island')) {
    const id = island.dataset.id;
    const elementData = layout.elements.find(e => e.id === id);
    if (!elementData) continue;

    island.classList.add('is-edit');

    const cleanup = attachEditMode(island, elementData, layout, {
      onTap: () => callbacks.onTap(elementData),
      onMove: () => saveLayout(layout),
      onResize: () => saveLayout(layout),
    });
    cleanups.push({ cleanup, island });
  }

  // Tap on empty canvas → close drawer
  const onCanvasTap = (e) => {
    if (e.target === canvasEl) callbacks.onTap(null);
  };
  canvasEl.addEventListener('click', onCanvasTap);

  return () => {
    for (const { cleanup, island } of cleanups) {
      cleanup();
      island.classList.remove('is-edit');
    }
    canvasEl.removeEventListener('click', onCanvasTap);
  };
}
