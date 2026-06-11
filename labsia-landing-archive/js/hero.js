/* ============================================================
   hero.js  ·  Timeline de entrada del hero
   ------------------------------------------------------------
   Anima en cascada: eyebrow → título (line-by-line) → sub →
   CTAs → scroll-indicator. Se dispara al cargar la página
   con un delay corto para evitar parpadeos durante el FOIT.

   Export: window.LABSIA.animateHero()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.animateHero = function animateHero() {
    if (typeof gsap === 'undefined') return;

    const tl = gsap.timeline({ delay: 0.2 });

    tl.to('.hero-eyebrow', {
        opacity: 1, y: 0,
        duration: 0.8, ease: 'power3.out',
      })
      .to('.hero-title .inner', {
        y: 0,
        duration: 1.1, stagger: 0.12, ease: 'power4.out',
      }, '-=0.4')
      .to('.hero-sub', {
        opacity: 1, y: 0,
        duration: 0.8, ease: 'power3.out',
      }, '-=0.6')
      .to('.hero-cta', {
        opacity: 1, y: 0,
        duration: 0.6, ease: 'power3.out',
      }, '-=0.3')
      .to('.scroll-indicator', {
        opacity: 0.7,
        duration: 1,
      }, '-=0.2');

    return tl;
  };
})();
