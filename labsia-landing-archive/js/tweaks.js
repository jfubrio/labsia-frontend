/* ============================================================
   tweaks.js  ·  Panel de Tweaks (vanilla JS)
   ------------------------------------------------------------
   Permite comparar 4 opciones de tipografía profesional en vivo.
   Sigue el protocolo del host:
   - Escucha __activate_edit_mode / __deactivate_edit_mode
   - Anuncia disponibilidad con __edit_mode_available
   - Persiste cambios con __edit_mode_set_keys
   ============================================================ */
(function () {
  'use strict';

  // ── Defaults (el host reescribe este bloque al persistir) ──
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "fontPair": "geist",
    "accent": "teal-purple"
  }/*EDITMODE-END*/;

  // ── Opciones de tipografía (todas son Google Fonts, todas profesionales) ──
  const FONT_PAIRS = {
    geist: {
      label: 'Geist',
      sublabel: 'Vercel · default',
      googleFonts: 'Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500',
      display:  "'Geist', system-ui, sans-serif",
      mono:     "'Geist Mono', ui-monospace, monospace",
    },
    jakarta: {
      label: 'Plus Jakarta Sans',
      sublabel: 'Stripe-adjacent · cálido',
      googleFonts: 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500',
      display:  "'Plus Jakarta Sans', system-ui, sans-serif",
      mono:     "'JetBrains Mono', ui-monospace, monospace",
    },
    manrope: {
      label: 'Manrope',
      sublabel: 'Limpia · redonda',
      googleFonts: 'Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500',
      display:  "'Manrope', system-ui, sans-serif",
      mono:     "'JetBrains Mono', ui-monospace, monospace",
    },
    sora: {
      label: 'Sora',
      sublabel: 'Tech-forward · expresiva',
      googleFonts: 'Sora:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500',
      display:  "'Sora', system-ui, sans-serif",
      mono:     "'IBM Plex Mono', ui-monospace, monospace",
    },
  };

  const ACCENT_PALETTES = {
    'teal-purple':   { accent: '#00f5d4', accent2: '#7c3aed', label: 'Teal · Purple', sub: 'default' },
    'cyan-blue':     { accent: '#22d3ee', accent2: '#3b82f6', label: 'Cyan · Blue',   sub: 'corporativo' },
    'lime-emerald':  { accent: '#a3e635', accent2: '#10b981', label: 'Lime · Emerald', sub: 'fresh' },
    'amber-rose':    { accent: '#fbbf24', accent2: '#f43f5e', label: 'Amber · Rose',  sub: 'cálido' },
  };

  // ── Estado actual ──
  let state = { ...TWEAK_DEFAULTS };

  // ── Cargar font dinámicamente ──
  function loadGoogleFonts(query) {
    const id = 'tweaks-font-link';
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  }

  // ── Aplicar tweaks al DOM ──
  function applyTweaks() {
    const pair = FONT_PAIRS[state.fontPair] || FONT_PAIRS.geist;
    loadGoogleFonts(pair.googleFonts);
    document.documentElement.style.setProperty('--font-display', pair.display);
    document.documentElement.style.setProperty('--font-mono',    pair.mono);

    const palette = ACCENT_PALETTES[state.accent] || ACCENT_PALETTES['teal-purple'];
    document.documentElement.style.setProperty('--accent',   palette.accent);
    document.documentElement.style.setProperty('--accent-2', palette.accent2);

    // Update selected visual state in panel
    document.querySelectorAll('[data-tweak-font]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.tweakFont === state.fontPair);
    });
    document.querySelectorAll('[data-tweak-accent]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.tweakAccent === state.accent);
    });
  }

  // ── Persistir cambios al host ──
  function persist(patch) {
    state = { ...state, ...patch };
    applyTweaks();
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  }

  // ── Construir el panel UI ──
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'labsia-tweaks-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <style>
        #labsia-tweaks-panel {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: 320px;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: rgba(15, 15, 18, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 20px;
          z-index: 9999;
          font-family: 'Geist', system-ui, sans-serif;
          color: #f5f5f7;
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
          transition: opacity .3s, transform .3s;
          box-shadow: 0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(0,245,212,.08);
        }
        #labsia-tweaks-panel.visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        #labsia-tweaks-panel .tw-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        #labsia-tweaks-panel .tw-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #00f5d4;
        }
        #labsia-tweaks-panel .tw-close {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,.06);
          color: #a1a1a6;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          line-height: 1;
          transition: background .2s, color .2s;
          border: none;
        }
        #labsia-tweaks-panel .tw-close:hover {
          background: rgba(255,255,255,.12);
          color: #f5f5f7;
        }
        #labsia-tweaks-panel .tw-section {
          margin-bottom: 18px;
        }
        #labsia-tweaks-panel .tw-section:last-child { margin-bottom: 0; }
        #labsia-tweaks-panel .tw-label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #a1a1a6;
          margin-bottom: 8px;
          font-weight: 500;
        }
        #labsia-tweaks-panel .tw-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          margin-bottom: 4px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 10px;
          cursor: pointer;
          background: rgba(255,255,255,.02);
          transition: all .2s;
        }
        #labsia-tweaks-panel .tw-option:hover {
          background: rgba(255,255,255,.05);
          border-color: rgba(0,245,212,.2);
        }
        #labsia-tweaks-panel .tw-option.selected {
          background: rgba(0,245,212,.08);
          border-color: rgba(0,245,212,.4);
        }
        #labsia-tweaks-panel .tw-option-label {
          font-size: 14px;
          font-weight: 500;
          flex: 1;
        }
        #labsia-tweaks-panel .tw-option-sub {
          font-size: 10px;
          color: #a1a1a6;
          letter-spacing: 0.05em;
        }
        #labsia-tweaks-panel .tw-swatches {
          display: flex;
          gap: 3px;
        }
        #labsia-tweaks-panel .tw-swatch {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        #labsia-tweaks-panel .tw-option.selected .tw-check {
          color: #00f5d4;
        }
        #labsia-tweaks-panel .tw-check {
          width: 14px;
          height: 14px;
          color: transparent;
          flex-shrink: 0;
        }
      </style>
      <div class="tw-header">
        <span class="tw-title">Tweaks</span>
        <button class="tw-close" aria-label="Cerrar panel">×</button>
      </div>

      <div class="tw-section">
        <div class="tw-label">Tipografía</div>
        ${Object.entries(FONT_PAIRS).map(([key, v]) => `
          <div class="tw-option" data-tweak-font="${key}">
            <span class="tw-option-label" style="font-family: ${v.display};">${v.label}</span>
            <span class="tw-option-sub">${v.sublabel}</span>
            <svg class="tw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        `).join('')}
      </div>

      <div class="tw-section">
        <div class="tw-label">Paleta acento</div>
        ${Object.entries(ACCENT_PALETTES).map(([key, v]) => `
          <div class="tw-option" data-tweak-accent="${key}">
            <div class="tw-swatches">
              <div class="tw-swatch" style="background:${v.accent}"></div>
              <div class="tw-swatch" style="background:${v.accent2}"></div>
            </div>
            <span class="tw-option-label">${v.label}</span>
            <span class="tw-option-sub">${v.sub}</span>
            <svg class="tw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        `).join('')}
      </div>
    `;

    document.body.appendChild(panel);

    // Wire events
    panel.querySelector('.tw-close').addEventListener('click', () => {
      panel.classList.remove('visible');
      window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
    });

    panel.querySelectorAll('[data-tweak-font]').forEach((el) => {
      el.addEventListener('click', () => persist({ fontPair: el.dataset.tweakFont }));
    });
    panel.querySelectorAll('[data-tweak-accent]').forEach((el) => {
      el.addEventListener('click', () => persist({ accent: el.dataset.tweakAccent }));
    });

    return panel;
  }

  // ── Init ──
  let panel = null;

  function show() {
    if (!panel) panel = buildPanel();
    applyTweaks();
    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
  }

  function hide() {
    if (panel) {
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  // Aplica defaults al cargar (sin mostrar panel — sólo respeta cambios persistidos)
  applyTweaks();

  // Escuchar mensajes del host
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === '__activate_edit_mode')   show();
    if (e.data.type === '__deactivate_edit_mode') hide();
  });

  // Anunciar disponibilidad — debe ir DESPUÉS del listener
  window.parent.postMessage({ type: '__edit_mode_available' }, '*');
})();
