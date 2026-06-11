/* ============================================================
   gallery.js  ·  Galería de casos — horizontal scroll
   ------------------------------------------------------------
   Mismo patrón que timeline.js pero anclada al centro:
   la galería se centra en el viewport y a partir de ahí
   convierte el scroll vertical en scroll horizontal.
   En móvil queda como scroll horizontal natural.

   Export: window.LABSIA.initGallery()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.initGallery = function initGallery() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const track = document.getElementById('galleryTrack');
    if (!track) return;
    const cards = track.querySelectorAll('.gallery-card');

    // ── HORIZONTAL PIN (solo desktop) ──
    if (window.innerWidth > 768 && cards.length > 0) {
      const cardWidth  = cards[0].offsetWidth + 32; // card + gap
      const totalWidth = cards.length * cardWidth;
      const distance   = totalWidth - window.innerWidth + 64;

      if (distance > 0) {
        gsap.to(track, {
          x: -distance,
          ease: 'none',
          scrollTrigger: {
            trigger:       '.gallery-section',
            start:         'center center',
            end:           () => '+=' + distance,
            pin:           true,
            scrub:         1,
            anticipatePin: 1,
          },
        });
      }
    }

    // ── REVEAL en cascada ──
    gsap.utils.toArray('.gallery-card').forEach((card, i) => {
      gsap.from(card, {
        opacity:  0,
        y:        60,
        duration: 1,
        delay:    i * 0.05,
        scrollTrigger: {
          trigger: '.gallery-section',
          start:   'top 80%',
        },
      });
    });

    // ── 3D TILT EFFECT & PARALLAX DEPTH (solo desktop) ──
    if (window.innerWidth > 768 && cards.length > 0) {
      cards.forEach((card) => {
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const xc = rect.width / 2;
          const yc = rect.height / 2;
          
          // Rotación máxima de 12 grados basada en la posición relativa del cursor
          const rotateX = ((yc - y) / yc) * 12;
          const rotateY = ((x - xc) / xc) * 12;

          card.style.transition = 'transform 0.08s ease-out, border-color 0.4s';
          card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
          
          // Efecto de paralaje sutil en la miniatura interna
          const thumb = card.querySelector('.gallery-card-thumb');
          if (thumb) {
            thumb.style.transition = 'transform 0.08s ease-out';
            thumb.style.transform = `translate3d(${(x - xc) / xc * 8}px, ${(y - yc) / yc * 8}px, 0) scale(1.04)`;
          }
        });

        card.addEventListener('mouseleave', () => {
          card.style.transition = 'transform 0.5s var(--ease-standard), border-color 0.4s';
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
          
          const thumb = card.querySelector('.gallery-card-thumb');
          if (thumb) {
            thumb.style.transition = 'transform 0.5s var(--ease-standard)';
            thumb.style.transform = 'translate3d(0, 0, 0) scale(1)';
          }
        });
      });
    }
  };
})();
