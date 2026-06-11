/* ============================================================
   how.js  ·  Sección "Cómo funciona" — pin de 3 pasos
   ------------------------------------------------------------
   Pin de 300vh: el sticky se queda fijo mientras el scroll
   avanza, y según el progreso (0→1) se activa step 1, 2 o 3.
   Cada step tiene un .step-num + h3 + p del lado izquierdo
   y un .step-visual del lado derecho (form / orb / checks).

   Export: window.LABSIA.initHow()
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  window.LABSIA.initHow = function initHow() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const howPin = document.getElementById('howPin');
    if (!howPin) return;

    const steps = document.querySelectorAll('.how-step');
    const dots  = document.querySelectorAll('.how-progress-dot');
    const typeValues = document.querySelectorAll('.step-1-visual .type-value');
    const voiceChecks = document.querySelectorAll('.voice-check');
    const voicePlay = document.querySelector('.voice-play');
    const validationAudio = new Audio('assets/audio/ia-validacion.mp3');
    let stepOneTyped = false;
    let stepTwoConfirmed = false;

    function sleep(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function typeStepOne() {
      if (stepOneTyped || !typeValues.length) return;
      stepOneTyped = true;

      typeValues.forEach((value) => {
        value.textContent = '';
        value.classList.remove('typing');
      });

      for (const value of typeValues) {
        const text = value.dataset.type || '';
        value.classList.add('typing');

        for (let i = 0; i <= text.length; i += 1) {
          value.textContent = text.slice(0, i);
          await sleep(24 + Math.random() * 18);
        }

        value.classList.remove('typing');
        await sleep(160);
      }
    }

    function speak(text) {
      if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-MX';
        utterance.rate = 0.98;
        utterance.pitch = 0.92;
        utterance.volume = 0.72;
        return;
      } catch (_) {
        // Si el navegador bloquea audio automático, la animación visual sigue funcionando.
      }
    }

    async function confirmStepTwo() {
      if (stepTwoConfirmed || !voiceChecks.length) return;
      stepTwoConfirmed = true;

      voiceChecks.forEach((check) => check.classList.remove('done'));

      for (const check of voiceChecks) {
        await sleep(360);
        check.classList.add('done');
      }
    }

    // Step 1 activo desde el inicio (mientras CSS opacity=0 en .how-step)
    document.querySelectorAll('.how-step[data-step="1"]').forEach((s) => {
      s.classList.add('active');
    });

    ScrollTrigger.create({
      trigger: howPin,
      start:   'top top',
      end:     'bottom bottom',
      onUpdate: (self) => {
        const progress = self.progress;     // 0 → 1
        let active;
        if      (progress < 0.33) active = 1;
        else if (progress < 0.66) active = 2;
        else                      active = 3;

        steps.forEach((s) => {
          s.classList.toggle('active', parseInt(s.dataset.step, 10) === active);
        });
        dots.forEach((d) => {
          d.classList.toggle('active', parseInt(d.dataset.dot, 10) === active);
        });

        if (active === 1) typeStepOne();
        if (active === 2) confirmStepTwo();
      },
    });

    ScrollTrigger.create({
      trigger: '.step-1-visual',
      start: 'top 72%',
      once: true,
      onEnter: typeStepOne,
    });

    ScrollTrigger.create({
      trigger: '.step-2-visual',
      start: 'top 66%',
      once: true,
      onEnter: confirmStepTwo,
    });

    if (voicePlay) {
      voicePlay.addEventListener('click', () => {
        confirmStepTwo();
        validationAudio.currentTime = 0;
        validationAudio.play().catch(() => {
          voicePlay.classList.add('audio-blocked');
        });
        /*
        const utterance = new SpeechSynthesisUtterance(
          'Validación completada. Intención clasificada. Servicio detectado. Alto ticket evaluado. Plantilla Meta lista. Operador asignado.'
        );
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = preferredVoice?.lang || 'es-MX';
        utterance.rate = 0.94;
        utterance.pitch = 0.82;
        utterance.volume = 0.86;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        */
      });
    }
  };
})();
