/* ============================================================
   cursor.js  ·  Cursor glow + magnetic buttons
   ------------------------------------------------------------
   El glow circular sigue al puntero (lo mueve scene.js para
   evitar dos listeners de mousemove).
   Los botones se magnetizan al puntero al hacer hover.

   Export: window.LABSIA.initCursor()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.initCursor = function initCursor() {
    if (typeof gsap === 'undefined') return;

    document.querySelectorAll('.btn').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width  / 2;
        const y = e.clientY - rect.top  - rect.height / 2;
        gsap.to(btn, {
          x: x * 0.25, y: y * 0.25,
          duration: 0.3, ease: 'power2.out',
        });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          x: 0, y: 0,
          duration: 0.5, ease: 'elastic.out(1, 0.5)',
        });
      });
    });
  };
})();
