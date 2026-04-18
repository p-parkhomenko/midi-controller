import { ELEMENT_DEFS, gridToPx } from '../core/layout.js';

// ─── ButtonElement ──────────────────────────────────────────────────────────

class ButtonElement {
  constructor(data, transport) {
    this._d = data;
    this._t = transport;
    this._onChange = null;
  }

  onStateChange(cb) { this._onChange = cb; }

  onPressStart() {
    if (this._d.mode === 'toggle') {
      this._set(!this._d.state);
      this._noteOn();
      setTimeout(() => this._noteOff(), 50);
    } else if (this._d.mode === 'momentary') {
      this._set(true);
      this._noteOn();
    } else if (this._d.mode === 'trigger') {
      this._set(true);
      this._noteOn();
      setTimeout(() => { this._noteOff(); this._set(false); }, 90);
    }
  }

  onPressEnd() {
    if (this._d.mode === 'momentary') {
      this._set(false);
      this._noteOff();
    }
  }

  _noteOn()  { this._t.send({ type: 'note_on',  channel: this._d.channel, note: this._d.note, velocity: 100 }); }
  _noteOff() { this._t.send({ type: 'note_off', channel: this._d.channel, note: this._d.note }); }

  _set(v) {
    this._d.state = v;
    if (this._onChange) this._onChange(v);
  }
}

// ─── FaderElement ───────────────────────────────────────────────────────────

class FaderElement {
  constructor(data, transport) {
    this._d = data;
    this._t = transport;
    this._onChange = null;
    this._active = false;
    this._rect = null;
  }

  onValueChange(cb) { this._onChange = cb; }

  isActive() { return this._active; }

  dragStart(clientY, trackEl) {
    this._active = true;
    this._rect = trackEl.getBoundingClientRect();
    this._calc(clientY);
  }

  dragMove(clientY) {
    if (!this._active) return;
    this._calc(clientY);
  }

  dragEnd() { this._active = false; }

  _calc(clientY) {
    const ratio = 1 - Math.max(0, Math.min(1,
      (clientY - this._rect.top) / this._rect.height
    ));
    const val = Math.round(ratio * 127);
    if (val === this._d.value) return;
    this._d.value = val;
    this._t.send({ type: 'cc', channel: this._d.channel, cc: this._d.cc, value: val });
    if (this._onChange) this._onChange(val);
  }
}

// ─── Fader render ────────────────────────────────────────────────────────────

export function renderFader(data, transport, ui) {
  const inst = new FaderElement(data, transport);

  const wrap = document.createElement('div');
  wrap.className = 'fader';
  wrap.innerHTML = `
    <div class="fader-top">
      <div class="fader-val">000</div>
      <div class="fader-lbl">${data.label.toUpperCase()}</div>
    </div>
    <div class="fader-wrap">
      <div class="fader-ticks"></div>
      <div class="fader-track"><div class="fader-fill"></div></div>
      <div class="fader-handle"></div>
      <div class="fader-scale">
        <div class="fader-scale-num">127</div>
        <div class="fader-scale-num">96</div>
        <div class="fader-scale-num">64</div>
        <div class="fader-scale-num">32</div>
        <div class="fader-scale-num">0</div>
      </div>
    </div>
  `;

  const ticksEl = wrap.querySelector('.fader-ticks');
  for (let i = 0; i <= 20; i++) {
    const t = document.createElement('div');
    t.className = 'fader-tick' + (i % 5 === 0 ? ' fader-tick--major' : ' fader-tick--minor');
    t.style.top = (i / 20 * 100) + '%';
    ticksEl.appendChild(t);
  }

  const trackWrap = wrap.querySelector('.fader-wrap');
  const trackEl   = wrap.querySelector('.fader-track');
  const fillEl    = wrap.querySelector('.fader-fill');
  const handleEl  = wrap.querySelector('.fader-handle');
  const valEl     = wrap.querySelector('.fader-val');

  function updateVisual(value) {
    const pct = (value / 127) * 100;
    fillEl.style.height   = pct + '%';
    handleEl.style.bottom = pct + '%';
    valEl.textContent     = String(value).padStart(3, '0');
  }

  inst.onValueChange((val) => {
    updateVisual(val);
    ui.showVal(val, `${data.label.toUpperCase()} · CC ${data.cc}`);
    ui.pulseStart();
  });

  updateVisual(data.value);

  const onStart = (e) => {
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    inst.dragStart(y, trackEl);
    wrap.classList.add('is-dragging');

    const onMove = (e) => {
      e.preventDefault();
      inst.dragMove(e.touches ? e.touches[0].clientY : e.clientY);
    };
    const onEnd = () => {
      inst.dragEnd();
      wrap.classList.remove('is-dragging');
      ui.hideVal();
      ui.pulseEnd();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
    };

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup',   onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onEnd);
  };

  trackWrap.addEventListener('mousedown',  onStart);
  trackWrap.addEventListener('touchstart', onStart, { passive: false });

  // Inbound: CC from Ableton updates visual without re-emitting.
  // Local gesture wins: игнорируем эхо, пока пользователь держит фейдер.
  const applyInput = (msg) => {
    if (inst.isActive()) return;
    if (msg.type !== 'cc') return;
    if (msg.channel !== data.channel || msg.cc !== data.cc) return;
    if (msg.value === data.value) return;
    data.value = msg.value;
    updateVisual(msg.value);
  };

  return {
    el: wrap,
    entries: [[`cc:${data.channel}:${data.cc}`, applyInput]],
  };
}

// ─── Button render ───────────────────────────────────────────────────────────

export function renderButton(data, transport, ui) {
  const inst = new ButtonElement(data, transport);

  const wrap = document.createElement('div');
  wrap.className = 'mel';

  const btn = document.createElement('div');
  btn.className = 'mbtn';
  btn.innerHTML = '<div class="mbtn-dot"></div>';

  const lbl = document.createElement('div');
  lbl.className = 'blbl';
  lbl.textContent = data.label.toUpperCase();

  wrap.appendChild(btn);
  wrap.appendChild(lbl);

  inst.onStateChange((state) => {
    btn.classList.toggle('is-on', state);
    lbl.style.color = state ? 'var(--accent)' : '';
  });

  const pressStart = (e) => {
    e.preventDefault();
    btn.classList.add('is-pressing');
    inst.onPressStart();
    const stateLabel = data.mode === 'momentary' ? 'ON' : (data.state ? 'ON' : 'OFF');
    ui.showVal(stateLabel, `${data.label.toUpperCase()} · NOTE ${data.note}`);
    ui.pulseStart();
  };

  const pressEnd = () => {
    btn.classList.remove('is-pressing');
    inst.onPressEnd();
    ui.hideVal();
    ui.pulseEnd();
  };

  btn.addEventListener('mousedown',   pressStart);
  btn.addEventListener('touchstart',  pressStart, { passive: false });
  btn.addEventListener('mouseup',     pressEnd);
  btn.addEventListener('mouseleave',  pressEnd);
  btn.addEventListener('touchend',    pressEnd);
  btn.addEventListener('touchcancel', pressEnd);

  // Inbound: mirror Ableton state without re-emitting.
  const applyInput = (msg) => {
    if (msg.type === 'note_on' && msg.note === data.note && msg.channel === data.channel) {
      const newState = msg.velocity > 0;
      if (newState !== data.state) { data.state = newState; inst._set(newState); }
    } else if (msg.type === 'note_off' && msg.note === data.note && msg.channel === data.channel) {
      if (data.state) { data.state = false; inst._set(false); }
    }
  };

  return {
    el: wrap,
    entries: [[`note:${data.channel}:${data.note}`, applyInput]],
  };
}

// ─── XYElement ──────────────────────────────────────────────────────────────

class XYElement {
  constructor(data, transport) {
    this._d = data;
    this._t = transport;
    this._onChange = null;
    this._active = false;
    this._rect = null;
  }

  onValueChange(cb) { this._onChange = cb; }

  isActive() { return this._active; }

  dragStart(clientX, clientY, padEl) {
    this._active = true;
    this._rect = padEl.getBoundingClientRect();
    this._calc(clientX, clientY);
  }

  dragMove(clientX, clientY) {
    if (!this._active) return;
    this._calc(clientX, clientY);
  }

  dragEnd() { this._active = false; }

  _calc(clientX, clientY) {
    const rx = Math.max(0, Math.min(1, (clientX - this._rect.left) / this._rect.width));
    const ry = 1 - Math.max(0, Math.min(1, (clientY - this._rect.top) / this._rect.height));
    const vx = Math.round(rx * 127);
    const vy = Math.round(ry * 127);
    const changedX = vx !== this._d.valueX;
    const changedY = vy !== this._d.valueY;
    if (!changedX && !changedY) return;
    if (changedX) {
      this._d.valueX = vx;
      this._t.send({ type: 'cc', channel: this._d.channel, cc: this._d.ccX, value: vx });
    }
    if (changedY) {
      this._d.valueY = vy;
      this._t.send({ type: 'cc', channel: this._d.channel, cc: this._d.ccY, value: vy });
    }
    if (this._onChange) this._onChange(this._d.valueX, this._d.valueY);
  }
}

// ─── XY render ──────────────────────────────────────────────────────────────

export function renderXY(data, transport, ui) {
  const inst = new XYElement(data, transport);

  const wrap = document.createElement('div');
  wrap.className = 'xy';
  wrap.innerHTML = `
    <div class="xy-top">
      <div class="xy-val">X:064 Y:064</div>
      <div class="xy-lbl">${data.label.toUpperCase()}</div>
    </div>
    <div class="xy-pad">
      <div class="xy-cross xy-cross--h"></div>
      <div class="xy-cross xy-cross--v"></div>
      <div class="xy-dot"></div>
    </div>
  `;

  const padEl  = wrap.querySelector('.xy-pad');
  const dotEl  = wrap.querySelector('.xy-dot');
  const crossH = wrap.querySelector('.xy-cross--h');
  const crossV = wrap.querySelector('.xy-cross--v');
  const valEl  = wrap.querySelector('.xy-val');

  function updateVisual(vx, vy) {
    const px = (vx / 127) * 100;
    const py = (1 - vy / 127) * 100;
    dotEl.style.left = px + '%';
    dotEl.style.top  = py + '%';
    crossV.style.left = px + '%';
    crossH.style.top  = py + '%';
    valEl.textContent =
      `X:${String(vx).padStart(3,'0')} Y:${String(vy).padStart(3,'0')}`;
  }

  inst.onValueChange((vx, vy) => {
    updateVisual(vx, vy);
    ui.showVal(`${String(vx).padStart(3,'0')}·${String(vy).padStart(3,'0')}`,
               `${data.label.toUpperCase()} · CC ${data.ccX}/${data.ccY}`);
    ui.pulseStart();
  });

  updateVisual(data.valueX, data.valueY);

  const onStart = (e) => {
    e.preventDefault();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    inst.dragStart(x, y, padEl);
    wrap.classList.add('is-dragging');

    const onMove = (e) => {
      e.preventDefault();
      const mx = e.touches ? e.touches[0].clientX : e.clientX;
      const my = e.touches ? e.touches[0].clientY : e.clientY;
      inst.dragMove(mx, my);
    };
    const onEnd = () => {
      inst.dragEnd();
      wrap.classList.remove('is-dragging');
      ui.hideVal();
      ui.pulseEnd();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
    };

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup',   onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onEnd);
  };

  padEl.addEventListener('mousedown',  onStart);
  padEl.addEventListener('touchstart', onStart, { passive: false });

  const applyInput = (msg) => {
    if (inst.isActive()) return;
    if (msg.type !== 'cc' || msg.channel !== data.channel) return;
    if (msg.cc === data.ccX && msg.value !== data.valueX) {
      data.valueX = msg.value;
      updateVisual(data.valueX, data.valueY);
    } else if (msg.cc === data.ccY && msg.value !== data.valueY) {
      data.valueY = msg.value;
      updateVisual(data.valueX, data.valueY);
    }
  };

  return {
    el: wrap,
    entries: [
      [`cc:${data.channel}:${data.ccX}`, applyInput],
      [`cc:${data.channel}:${data.ccY}`, applyInput],
    ],
  };
}

// ─── Island render ────────────────────────────────────────────────────────────

function renderIsland(elementData, transport, ui) {
  const def = ELEMENT_DEFS[elementData.type];

  const island = document.createElement('div');
  island.className = 'island';
  island.dataset.id = elementData.id;

  applyIslandGeometry(island, elementData);

  // Inner wrapper — padding + aspect-ratio fitting
  const inner = document.createElement('div');
  inner.className = 'island-inner';
  inner.style.position = 'absolute';
  inner.style.inset = `${def.padding.y}px ${def.padding.x}px`;

  let rendered;
  if (elementData.type === 'fader')  rendered = renderFader(elementData, transport, ui);
  if (elementData.type === 'button') rendered = renderButton(elementData, transport, ui);
  if (elementData.type === 'xy')     rendered = renderXY(elementData, transport, ui);

  if (!rendered) return null;

  const el = rendered.el;
  el.style.width  = '100%';
  el.style.height = '100%';

  inner.appendChild(el);
  island.appendChild(inner);

  return { island, entries: rendered.entries };
}

export function applyIslandGeometry(island, data) {
  island.style.left   = gridToPx(data.gridX) + 'px';
  island.style.top    = gridToPx(data.gridY) + 'px';
  island.style.width  = gridToPx(data.gridW) + 'px';
  island.style.height = gridToPx(data.gridH) + 'px';
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function renderCanvas(rootEl, layout, transport, ui) {
  rootEl.innerHTML = '';
  rootEl.style.position = 'relative';

  const routingMap = new Map();

  function mountElement(elementData) {
    const result = renderIsland(elementData, transport, ui);
    if (!result) return;
    const { island, entries } = result;
    rootEl.appendChild(island);
    for (const [key, fn] of entries) routingMap.set(key, fn);
    return island;
  }

  function unmountElement(id) {
    const el = rootEl.querySelector(`.island[data-id="${id}"]`);
    if (el) el.remove();
    // Clean up routing entries for this element
    for (const [key] of routingMap) {
      if (key.includes(':')) {
        // Re-check: routing entries don't store id, so we rebuild map on full refresh
      }
    }
  }

  function refresh(layout) {
    rootEl.innerHTML = '';
    routingMap.clear();
    for (const el of layout.elements) mountElement(el);
  }

  // Initial render
  refresh(layout);

  return {
    dispatch(msg) {
      if (!msg) return;
      const key = msg.type === 'cc'
        ? `cc:${msg.channel}:${msg.cc}`
        : `note:${msg.channel}:${msg.note}`;
      const handler = routingMap.get(key);
      if (handler) handler(msg);
    },
    refresh,
    mountElement,
    unmountElement,
  };
}
