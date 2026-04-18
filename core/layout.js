const STORAGE_KEY = 'midi-controller-layout';

export const ELEMENT_DEFS = {
  fader: {
    preserveAspectRatio: true,
    aspectRatio: 1 / 4,          // width / height
    padding: { x: 12, y: 16 },
    defaultW: 4, defaultH: 14,
    minW: 2, minH: 8,
  },
  button: {
    preserveAspectRatio: false,
    padding: { x: 8, y: 8 },
    defaultW: 3, defaultH: 3,
    minW: 2, minH: 2,
  },
};

const GRID = 22; // px per grid unit

export function gridToPx(units) { return units * GRID; }
export function pxToGrid(px)    { return Math.round(px / GRID); }

const uuid = () => Math.random().toString(36).slice(2);

function firstFreeCell(elements, w, h) {
  const cols = Math.floor(window.innerWidth  / GRID);
  const rows = Math.floor(window.innerHeight / GRID);
  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const overlaps = elements.some(el =>
        x < el.gridX + el.gridW && x + w > el.gridX &&
        y < el.gridY + el.gridH && y + h > el.gridY
      );
      if (!overlaps) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function addElement(layout, type) {
  const def = ELEMENT_DEFS[type];
  const { x, y } = firstFreeCell(layout.elements, def.defaultW, def.defaultH);

  let el;
  if (type === 'fader') {
    el = {
      id: uuid(), type: 'fader',
      cc: layout._nextCC++, channel: 1, value: 0, label: 'NEW',
      gridX: x, gridY: y, gridW: def.defaultW, gridH: def.defaultH,
    };
  } else if (type === 'button') {
    el = {
      id: uuid(), type: 'button',
      note: layout._nextNote++, channel: 1, state: false, mode: 'toggle', label: 'BTN',
      gridX: x, gridY: y, gridW: def.defaultW, gridH: def.defaultH,
    };
  }

  layout.elements.push(el);
  saveLayout(layout);
  return el;
}

export function removeElement(layout, id) {
  const idx = layout.elements.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const [removed] = layout.elements.splice(idx, 1);
  saveLayout(layout);
  return removed;
}

export function updateElement(layout, id, patch) {
  const el = layout.elements.find(e => e.id === id);
  if (!el) return;
  Object.assign(el, patch);
  saveLayout(layout);
}

export function duplicateElement(layout, id) {
  const src = layout.elements.find(e => e.id === id);
  if (!src) return null;
  const def = ELEMENT_DEFS[src.type];
  const { x, y } = firstFreeCell(layout.elements, src.gridW, src.gridH);

  const clone = { ...src, id: uuid(), gridX: x, gridY: y };
  if (src.type === 'fader')  clone.cc   = layout._nextCC++;
  if (src.type === 'button') clone.note = layout._nextNote++;

  layout.elements.push(clone);
  saveLayout(layout);
  return clone;
}

export function saveLayout(layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultLayout();
}

function defaultLayout() {
  return { elements: [], _nextCC: 70, _nextNote: 36 };
}

export const layout = loadLayout();
