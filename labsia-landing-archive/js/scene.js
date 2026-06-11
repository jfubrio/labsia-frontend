/* ============================================================
   scene.js  ·  Three.js — hero canvas
   ------------------------------------------------------------
   Renderiza una esfera de ~8000 partículas con shader custom
   (ondas radiales + aditivo) y un núcleo esférico pulsante.
   La cámara se inclina suavemente siguiendo el cursor.

   Export: window.LABSIA.initScene(canvasEl) → { particles, destroy }
   ============================================================ */
(function () {
  'use strict';

  window.LABSIA = window.LABSIA || {};

  /**
   * Inicializa la escena Three.js sobre el canvas dado.
   * @param {HTMLCanvasElement} canvasEl
   * @returns {{ particles: THREE.Points, destroy: Function }}
   */
  window.LABSIA.initScene = function initScene(canvasEl) {
    if (typeof THREE === 'undefined') {
      console.error('[LABSIA] Three.js no disponible');
      return null;
    }
    if (!canvasEl) {
      console.error('[LABSIA] Canvas element no encontrado');
      return null;
    }

    // ── 1. SETUP ──
    const renderer = new THREE.WebGLRenderer({
      canvas:    canvasEl,
      alpha:     true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 4.5;

    // ── 2. PARTÍCULAS — distribución esférica uniforme ──
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 3000 : 8000;
    const radius = 2;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors    = new Float32Array(PARTICLE_COUNT * 3);
    const scales    = new Float32Array(PARTICLE_COUNT);

    const COLOR_TEAL   = new THREE.Color('#00f5d4');
    const COLOR_PURPLE = new THREE.Color('#7c3aed');
    const COLOR_WHITE  = new THREE.Color('#ffffff');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Fibonacci sphere — distribución uniforme sin clustering
      const phi   = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
      const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
      const r     = radius * (0.92 + Math.random() * 0.16);

      positions[i * 3]     = r * Math.cos(theta) * Math.sin(phi);
      positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // 50% teal, 30% purple, 20% white
      const t = Math.random();
      const c = t < 0.5 ? COLOR_TEAL : (t < 0.8 ? COLOR_PURPLE : COLOR_WHITE);
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      scales[i] = Math.random() * 0.6 + 0.6;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    geometry.setAttribute('scale',    new THREE.BufferAttribute(scales,    1));

    // Shader: ola radial + tamaño por distancia + disco con alpha smooth + deformación por mouse
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time:       { value: 0 },
        pixelRatio: { value: renderer.getPixelRatio() },
        uMouse:     { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        uniform float time;
        uniform float pixelRatio;
        uniform vec2 uMouse;
        attribute float scale;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 pos = position;
          
          // Ondulación radial basada en tiempo
          float wave = sin(time * 1.2 + pos.x * 2.5 + pos.y * 2.0) * 0.06;
          
          // Deformación tridimensional premium e interactiva con el mouse
          vec2 pos2D = pos.xy;
          float distToMouse = distance(pos2D, uMouse * 1.8);
          float mouseForce = smoothstep(1.5, 0.0, distToMouse) * 0.22;
          
          // Aplica desplazamiento hacia afuera en la esfera
          pos += normalize(pos) * (wave + mouseForce);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = scale * 14.0 * pixelRatio * (1.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * 1.4, alpha);
        }
      `,
      vertexColors: true,
      transparent:  true,
      blending:     THREE.AdditiveBlending,
      depthWrite:   false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // ── 3. NÚCLEO INTERNO — esfera pulsante ──
    const innerGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const innerMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        void main() {
          float pulse = sin(time * 2.0) * 0.2 + 0.8;
          vec3 col = mix(vec3(0.0, 0.96, 0.83), vec3(0.49, 0.23, 0.93), 0.5);
          float a = pow(1.0 - abs(vNormal.z), 2.0) * pulse;
          gl_FragColor = vec4(col, a * 0.6);
        }
      `,
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });

    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerSphere);

    // ── 4. MOUSE — inclinación + cursor glow ──
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    const cursorGlow = document.getElementById('cursorGlow');

    function onMouseMove(e) {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2; // Y invertida para coordenadas WebGL
      if (cursorGlow) {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top  = e.clientY + 'px';
        cursorGlow.style.opacity = '1';
      }
    }

    function onMouseLeave() {
      if (cursorGlow) cursorGlow.style.opacity = '0';
    }

    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    // ── 5. RESIZE ──
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // ── 6. LOOP ──
    const clock = new THREE.Clock();
    let rafId;

    function animate() {
      const elapsed = clock.getElapsedTime();
      material.uniforms.time.value = elapsed;
      innerMat.uniforms.time.value = elapsed;

      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;

      material.uniforms.uMouse.value.set(targetX, targetY);

      particles.rotation.y = elapsed * 0.08 + targetX * 0.4;
      particles.rotation.x = -targetY * 0.25; // Negativo para coincidir con la rotación física del mouse invertido

      innerSphere.rotation.y = elapsed * 0.15;
      innerSphere.rotation.x = elapsed * 0.10;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    animate();

    // ── 7. PAUSAR EN TAB OCULTO (ahorra batería) ──
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        clock.start();
        animate();
      }
    });

    return {
      particles,
      destroy: () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove',  onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('resize',     onResize);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        innerGeo.dispose();
        innerMat.dispose();
      },
    };
  };
})();
