/* ============================================================
   counters.js  ·  Contadores numéricos animados
   ------------------------------------------------------------
   Anima los .stat-number que tienen un target numérico definido
   en este módulo (no en HTML, para mantener el DOM limpio).
   Se dispara cuando .stats-row entra en viewport.

   Export: window.LABSIA.initCounters()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  // Mapa de stats a animar (4 stats en el bloque de "Pruebas · Beta").
  // Las que tienen target numérico se animan, las demás (suffix-only) se quedan estáticas.
  const COUNTERS = [
    { index: 0, target: 3,  suffix: ''  },   // "3 segundos · respuesta IA"
    { index: 1, target: 99, suffix: ''  },   // "99% uptime objetivo"
    { index: 2, target: 24, suffix: ''  },   // "24/7 follow-ups"
    // index 3: "0 leads duplicados" — ya está en 0, no se anima
  ];

  window.LABSIA.initCounters = function initCounters() {
    if (typeof gsap === 'undefined') return;

    const els = document.querySelectorAll('.stat-number');

    COUNTERS.forEach(({ index, target, suffix }) => {
      const el = els[index];
      if (!el) return;

      const obj = { val: 0 };
      gsap.to(obj, {
        val:      target,
        duration: 2,
        ease:     'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.val) + suffix; },
        scrollTrigger: {
          trigger: el,
          start:   'top 85%',
        },
      });
    });
  };
})();
