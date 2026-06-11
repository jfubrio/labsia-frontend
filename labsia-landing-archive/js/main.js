/* ============================================================
   main.js  ·  Entry point — orquesta todos los módulos
   ------------------------------------------------------------
   Orden importante:
   1. initScene()         crea window.__three (lo usa scroll.js)
   2. initCursor()        magnetic buttons
   3. animateHero()       timeline de entrada
   4. initScrollAnimations() ScrollTriggers + sub-secciones

   Cada módulo es un IIFE que se auto-registra en window.LABSIA
   al cargar su <script>.
   ============================================================ */
(function () {
  'use strict';

  // ── Captura global de errores · útil para debug en prod ──
  window.addEventListener('error', (e) => {
    console.error('[LABSIA][ERR]', e.message, e.filename + ':' + e.lineno);
  });

  function loadThree(callback) {
    if (typeof THREE !== 'undefined') return callback();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.min.js';
    script.onload = callback;
    script.onerror = () => console.error('[LABSIA] Error al cargar Three.js desde CDN');
    document.head.appendChild(script);
  }

  function start() {
    if (!window.LABSIA) {
      console.error('[LABSIA] Módulos no cargados — revisa el orden de <script>');
      return;
    }

    // 1. Three.js — escena del hero (lazy-loaded para optimizar carga inicial)
    const canvas = document.getElementById('three-canvas');
    if (canvas && window.LABSIA.initScene) {
      const initThreeScene = () => {
        loadThree(() => {
          window.__three = window.LABSIA.initScene(canvas);
        });
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(initThreeScene);
      } else {
        setTimeout(initThreeScene, 100);
      }
    }

    // 2. Cursor + magnetic buttons
    if (window.LABSIA.initCursor) window.LABSIA.initCursor();

    // 3. Hero entrance
    if (window.LABSIA.animateHero) window.LABSIA.animateHero();

    // 4. ScrollTriggers + sub-secciones (how, timeline, gallery, counters,
    //    reveals genéricos para stack/compare/testimonials/faq/pricing)
    if (window.LABSIA.initScrollAnimations) window.LABSIA.initScrollAnimations();
  }

  // Esperar al DOM listo antes de tocar el canvas o medir elementos
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
