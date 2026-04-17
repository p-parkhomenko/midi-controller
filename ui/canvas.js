class ButtonElement {
  constructor(data, transport) {
    this._d = data;
    this._t = transport;
    this._onChange = null;
  }

  onStateChange(cb) { this._onChange = cb; }

  onPressStart() {
    const d = this._d;
    if (d.mode === 'toggle') {
      this._set(!d.state);
      this._t.send({ type: 'cc', channel: d.channel, cc: d.cc, value: d.state ? 127 : 0 });
    } else if (d.mode === 'momentary') {
      this._set(true);
      this._noteOn();
    } else if (d.mode === 'trigger') {
      this._noteOn();
      setTimeout(() => this._noteOff(), 50);
      this._set(true);
      setTimeout(() => this._set(false), 90);
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

class FaderElement {
  constructor(data, transport) {
    this._d = data;
    this._t = transport;
    this._onChange = null;
    this._active = false;
    this._rect = null;
  }

  onValueChange(cb) { this._onChange = cb; }

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

function mkDivider() {
  const d = document.createElement('div');
  d.className = 'divider';
  return d;
}

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

  const ticksEl  = wrap.querySelector('.fader-ticks');
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
    handleEl.style.bottom = `calc(${pct}% - 6px)`;
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

  return wrap;
}

export function renderButton(data, transport, variant, ui) {
  const inst = new ButtonElement(data, transport);

  const wrap = document.createElement('div');
  wrap.className = 'mel';

  const btn = document.createElement('div');
  btn.className = 'mbtn' + (variant ? ` mbtn--${variant}` : '');
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
    const target = data.mode === 'toggle' ? `CC ${data.cc}` : `NOTE ${data.note}`;
    ui.showVal(stateLabel, `${data.label.toUpperCase()} · ${target}`);
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

  return wrap;
}

export function renderStrip(strip, transport, ui) {
  const el = document.createElement('div');
  el.className = 'strip';

  const idx = document.createElement('span');
  idx.className = 'strip-idx';
  idx.textContent = '01';

  const jp = document.createElement('span');
  jp.className = 'strip-jp';
  jp.textContent = 'チャンネル';

  el.appendChild(idx);
  el.appendChild(jp);
  el.appendChild(renderFader(strip.fader, transport, ui));
  el.appendChild(mkDivider());
  el.appendChild(renderButton(strip.mute, transport, '', ui));
  el.appendChild(mkDivider());

  const kills = document.createElement('div');
  kills.className = 'kill-group';
  kills.appendChild(renderButton(strip.killLow, transport, 'kill', ui));
  kills.appendChild(renderButton(strip.killMid, transport, 'kill', ui));
  kills.appendChild(renderButton(strip.killHi,  transport, 'kill', ui));
  el.appendChild(kills);

  el.appendChild(mkDivider());
  el.appendChild(renderButton(strip.impulse, transport, 'momentary', ui));

  const lbl = document.createElement('div');
  lbl.className = 'strip-lbl';
  lbl.textContent = strip.label;
  el.appendChild(lbl);

  return el;
}

export function renderCanvas(rootEl, layout, transport, ui) {
  rootEl.innerHTML = '';
  for (const strip of layout.strips) {
    rootEl.appendChild(renderStrip(strip, transport, ui));
  }
}
