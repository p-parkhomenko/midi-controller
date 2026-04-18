/**
 * Right-side Drawer for element editing and element palette.
 *
 * Usage:
 *   const drawer = createDrawer(containerEl);
 *   drawer.openElement(elementData, { onSave, onDelete, onDuplicate });
 *   drawer.openPalette(onSelect);
 *   drawer.close();
 */
export function createDrawer(containerEl) {
  const el = document.createElement('div');
  el.className = 'drawer';
  containerEl.appendChild(el);

  let _visible = false;

  function show(content) {
    el.innerHTML = '';
    el.appendChild(content);
    if (!_visible) {
      _visible = true;
      requestAnimationFrame(() => el.classList.add('is-open'));
    }
  }

  function close() {
    if (!_visible) return;
    _visible = false;
    el.classList.remove('is-open');
  }

  // ── Element editor ────────────────────────────────────────────────────────
  function openElement(data, { onSave, onDelete, onDuplicate }) {
    const frag = document.createElement('div');
    frag.className = 'drawer-content';

    frag.innerHTML = `
      <div class="drawer-header">
        <span class="drawer-title">${data.type.toUpperCase()}</span>
        <button class="drawer-close" aria-label="Close">✕</button>
      </div>
      <div class="drawer-fields">
        <label class="drawer-field">
          <span>Label</span>
          <input type="text" name="label" value="${data.label}" maxlength="12">
        </label>
        <label class="drawer-field">
          <span>Channel</span>
          <input type="number" name="channel" value="${data.channel}" min="1" max="16">
        </label>
        ${data.type === 'fader' ? `
        <label class="drawer-field">
          <span>CC#</span>
          <input type="number" name="cc" value="${data.cc}" min="70" max="119">
        </label>
        ` : ''}
        ${data.type === 'button' ? `
        <label class="drawer-field">
          <span>Note#</span>
          <input type="number" name="note" value="${data.note}" min="0" max="127">
        </label>
        <div class="drawer-field drawer-field--segmented">
          <span>Type</span>
          <div class="seg seg--3">
            <button class="seg-btn ${data.mode==='toggle'?'is-active':''}"    data-mode="toggle">Toggle</button>
            <button class="seg-btn ${data.mode==='momentary'?'is-active':''}" data-mode="momentary">Moment</button>
            <button class="seg-btn ${data.mode==='trigger'?'is-active':''}"   data-mode="trigger">Trigger</button>
          </div>
        </div>
        ` : ''}
      </div>
      <div class="drawer-actions">
        <button class="drawer-btn drawer-btn--secondary" data-action="duplicate">Duplicate</button>
        <button class="drawer-btn drawer-btn--danger"    data-action="delete">Delete</button>
      </div>
    `;

    // Close button
    frag.querySelector('.drawer-close').addEventListener('click', close);

    // Field changes → autosave
    frag.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const patch = {};
        const val = input.type === 'number' ? Number(input.value) : input.value;
        patch[input.name] = val;
        onSave(patch);
      });
    });

    // Mode segmented control (button only)
    frag.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        frag.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        onSave({ mode: btn.dataset.mode });
      });
    });

    // Actions
    frag.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => {
      onDuplicate();
      close();
    });
    frag.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      onDelete();
      close();
    });

    show(frag);
  }

  // ── Palette ───────────────────────────────────────────────────────────────
  function openPalette(onSelect) {
    const frag = document.createElement('div');
    frag.className = 'drawer-content';

    frag.innerHTML = `
      <div class="drawer-header">
        <span class="drawer-title">ADD ELEMENT</span>
        <button class="drawer-close" aria-label="Close">✕</button>
      </div>
      <div class="drawer-palette">
        <button class="palette-item" data-type="fader">
          <div class="palette-icon palette-icon--fader"></div>
          <span>Fader</span>
        </button>
        <button class="palette-item" data-type="button">
          <div class="palette-icon palette-icon--button"></div>
          <span>Button</span>
        </button>
      </div>
    `;

    frag.querySelector('.drawer-close').addEventListener('click', close);

    frag.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        onSelect(btn.dataset.type);
        // Drawer will be repopulated with element editor by caller
      });
    });

    show(frag);
  }

  return { el, openElement, openPalette, close, isOpen: () => _visible };
}
