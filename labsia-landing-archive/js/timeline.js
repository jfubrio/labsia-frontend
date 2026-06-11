/* ============================================================
   timeline.js  ·  Línea de tiempo 24h — horizontal scroll
   ------------------------------------------------------------
   En desktop (>768px): pinea la sección y traduce el track
   horizontalmente mientras el scroll vertical avanza.
   En móvil: se deja como scroll horizontal natural (no pin).

   Cada step se revela también con un fade-up al entrar
   en viewport por primera vez.

   Export: window.LABSIA.initTimeline()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.initTimeline = function initTimeline() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const pinWrap = document.getElementById('timelinePin');
    const track   = document.getElementById('timelineTrack');
    if (!pinWrap || !track) return;

    // ── HORIZONTAL PIN (solo desktop) ──
    if (window.innerWidth > 768) {
      const trackWidth = track.scrollWidth;
      const distance   = trackWidth - window.innerWidth + 64;

      if (distance > 0) {
        gsap.to(track, {
          x: -distance,
          ease: 'none',
          scrollTrigger: {
            trigger:       pinWrap,
            start:         'top top',
            end:           () => '+=' + distance,
            pin:           true,
            scrub:         1,
            anticipatePin: 1,
          },
        });
      }
    }

    // ── REVEAL en cascada ──
    gsap.utils.toArray('.timeline-step').forEach((step, i) => {
      gsap.from(step, {
        opacity:  0,
        y:        30,
        duration: 0.6,
        delay:    i * 0.08,
        scrollTrigger: {
          trigger: '.timeline-section',
          start:   'top 70%',
        },
      });
    });
  };
})();
