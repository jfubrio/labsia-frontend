/* ============================================================
   scroll.js  ·  ScrollTrigger coordinator
   ------------------------------------------------------------
   Registra el plugin, dispara las animaciones específicas
   por sección (delegando a sus módulos) y agrupa los reveals
   genéricos por scroll (stack, compare, testimonials, faq,
   pricing) que no merecen módulo propio.

   Export: window.LABSIA.initScrollAnimations()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.initScrollAnimations = function initScrollAnimations() {
    if (typeof gsap === 'undefined') return;

    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    // ───────── HERO · rotación de partículas al scrollear el hero ─────────
    if (window.__three && window.__three.particles && typeof ScrollTrigger !== 'undefined') {
      gsap.to(window.__three.particles.rotation, {
        y: '+=3.14',
        scrollTrigger: {
          trigger: '.hero',
          start:   'top top',
          end:     'bottom top',
          scrub:   1,
        },
      });
    }

    // ───────── SECCIONES ESPECÍFICAS — delegan a sus módulos ─────────
    if (window.LABSIA.initHow)      window.LABSIA.initHow();
    if (window.LABSIA.initTimeline) window.LABSIA.initTimeline();
    if (window.LABSIA.initGallery)  window.LABSIA.initGallery();
    if (window.LABSIA.initCounters) window.LABSIA.initCounters();

    // ───────── STACK · cards reveal + hover spotlight ─────────
    gsap.utils.toArray('.stack-card').forEach((card, i) => {
      gsap.from(card, {
        opacity: 0, y: 40,
        duration: 0.8,
        delay: (i % 3) * 0.1,
        scrollTrigger: { trigger: '.stack-section', start: 'top 70%' },
      });

      // Spotlight radial que sigue al mouse (var --mx / --my en CSS)
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width  * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - rect.top)  / rect.height * 100) + '%');
      });
    });

    // ───────── COMPARATIVA · filas reveal ─────────
    gsap.utils.toArray('.compare-row').forEach((row, i) => {
      gsap.to(row, {
        opacity: 1, y: 0,
        duration: 0.6, ease: 'power2.out',
        delay: i * 0.06,
        scrollTrigger: { trigger: '.compare-table', start: 'top 75%' },
      });
    });

    // ───────── TESTIMONIOS · stats + cards ─────────
    gsap.utils.toArray('.stat').forEach((stat, i) => {
      gsap.from(stat, {
        opacity: 0, y: 30,
        duration: 0.8, delay: i * 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.stats-row', start: 'top 75%' },
      });
    });

    gsap.utils.toArray('.testimonial-card').forEach((card, i) => {
      gsap.from(card, {
        opacity: 0, y: 50,
        duration: 0.9, delay: i * 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.testimonials-grid', start: 'top 75%' },
      });
    });

    // ───────── FAQ · items reveal ─────────
    gsap.utils.toArray('.faq-item').forEach((item, i) => {
      gsap.from(item, {
        opacity: 0, x: -30,
        duration: 0.6, delay: i * 0.05, ease: 'power2.out',
        scrollTrigger: { trigger: '.faq-wrap', start: 'top 80%' },
      });
    });

    // ───────── PRICING · card + features + addons ─────────
    gsap.from('.pricing-card-main', {
      opacity: 0, y: 60,
      duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.pricing-section', start: 'top 70%' },
    });

    gsap.utils.toArray('.pricing-features li').forEach((li, i) => {
      gsap.from(li, {
        opacity: 0, x: -20,
        duration: 0.4,
        delay: 0.4 + i * 0.06, ease: 'power2.out',
        scrollTrigger: { trigger: '.pricing-card-main', start: 'top 70%' },
      });
    });

    gsap.utils.toArray('.addon').forEach((addon, i) => {
      gsap.from(addon, {
        opacity: 0, y: 20,
        duration: 0.6,
        delay: i * 0.1, ease: 'power2.out',
        scrollTrigger: { trigger: '.pricing-addons', start: 'top 85%' },
      });
    });
  };
})();
