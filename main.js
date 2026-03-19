/* ─────────────────────────────────────────
   PORTFOLIO — main.js
   Scroll-controlled canvas frame animation
   + navbar + scroll-reveal
───────────────────────────────────────── */

(function () {
  'use strict';

  /* ── CONFIG ── */
  const TOTAL_FRAMES = 55;
  const FRAMES_DIR = './frames/';

  const frameSrc = (n) =>
    `${FRAMES_DIR}frame_${String(n).padStart(3, '0')}.jpg`;

  /* Subtle zoom: 1.0 → 0.98 as scroll progresses */
  const SCALE_START = 1.0;
  const SCALE_END = 0.98;

  /* ── STATE ── */
  let frames = [];
  let loadedCount = 0;
  let allLoaded = false;
  let currentFrame = 0;       // floating index 0…54
  let rafId = null;
  let targetFrame = 0;       // lerp target
  let displayFrame = 0;       // lerped current display frame

  /* Canvas & context */
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  const canvasWrap = canvas.parentElement;

  /* Navbar */
  const navbar = document.getElementById('navbar');

  /* Hero wrapper for scroll calculation */
  const heroWrapper = document.getElementById('hero');

  /* ── PRELOAD FRAMES ── */
  function preloadFrames() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = frameSrc(i);
      img.onload = onFrameLoad;
      img.onerror = onFrameLoad; // still count errors so we don't stall
      frames[i - 1] = img;
    }
  }

  function onFrameLoad() {
    loadedCount++;
    if (loadedCount >= TOTAL_FRAMES) {
      allLoaded = true;
      /* Size canvas once first frame is available */
      sizeCanvas();
      drawFrame(0);
      startLoop();
    }
  }

  /* ── CANVAS SIZING ── */
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function sizeCanvas() {
    const first = frames[0];
    if (!first || !first.naturalWidth) return;

    if (isMobile()) {
      /* On mobile: match the actual viewport so the canvas fills screen */
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      /* Desktop: natural image resolution — unchanged */
      canvas.width  = first.naturalWidth;
      canvas.height = first.naturalHeight;
    }
  }

  /* ── DRAW A SINGLE FRAME ── */
  function drawFrame(index) {
    const i = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(index)));
    const img = frames[i];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    if (isMobile()) {
      /* ── MOBILE: object-fit:cover with upward face-bias ─────────────
         Scale the image so it fully covers the canvas (like CSS cover),
         then offset vertically so the top 15% of the image is at the
         canvas top — keeping the subject's face visible.
      ─────────────────────────────────────────────────────────────── */
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      /* Scale factor: whichever axis needs more coverage */
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;

      /* Face-bias: anchor 15% from top of the image to top of canvas.
         Clamp so image never leaves the canvas edges. */
      const faceAnchor = 0.15;          /* 0 = very top, 0.5 = centre */
      let dx = (cw - dw) / 2;          /* always h-centred */
      let dy = -(dh * faceAnchor);     /* vertical anchor */
      /* Clamp dy: don't expose white above or below the frame */
      dy = Math.max(ch - dh, Math.min(0, dy));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);

    } else {
      /* ── DESKTOP: original rendering — completely unchanged ── */
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }

  /* ── SCROLL → FRAME MAPPING ── */
  function getScrollProgress() {
    const rect = heroWrapper.getBoundingClientRect();
    const wrapH = heroWrapper.offsetHeight;   // 300vh
    const viewH = window.innerHeight;

    /* scrolled distance into the wrapper */
    const scrolled = -rect.top;
    /* total scrollable distance (wrapper height minus one viewport) */
    const total = wrapH - viewH;

    return Math.max(0, Math.min(1, scrolled / total));
  }

  /* ── ANIMATION LOOP ── */
  function startLoop() {
    cancelAnimationFrame(rafId);
    loop();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);

    const progress = getScrollProgress();

    /* Frame target */
    targetFrame = progress * (TOTAL_FRAMES - 1);

    /* Lerp display frame → smooth, no jitter */
    displayFrame += (targetFrame - displayFrame) * 0.12;

    /* Draw */
    drawFrame(displayFrame);

    /* Zoom-out on canvas wrapper:
       Mobile gets a subtler range (1.0 → 0.99) to avoid visual noise.
       Desktop keeps the original range (1.0 → 0.98). */
    const scaleEnd = isMobile() ? 0.99 : SCALE_END;
    const scale = SCALE_START + (scaleEnd - SCALE_START) * progress;
    canvasWrap.style.transform = `scale(${scale.toFixed(4)})`;

    /* Fade hero label out as progression advances */
    const labelEl = document.getElementById('heroLabel');
    if (labelEl) {
      labelEl.style.opacity = Math.max(0, 0.35 * (1 - progress * 3)).toFixed(3);
    }
  }


  /* ── NAVBAR SCROLL BEHAVIOUR ── */
  function handleNavbar() {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  /* ── SCROLL-REVEAL FOR SECTIONS ── */
  const revealEls = document.querySelectorAll(
    '.intro-inner, .section-header, .proj-card, .contact-inner, .footer-inner'
  );

  function addRevealClasses() {
    revealEls.forEach(el => el.classList.add('reveal'));
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  function observeRevealEls() {
    let cardIdx = 0;
    revealEls.forEach((el) => {
      /* Stagger project cards with small incremental delay */
      if (el.classList.contains('proj-card')) {
        el.style.transitionDelay = `${cardIdx * 0.08}s`;
        cardIdx++;
      }
      revealObserver.observe(el);
    });
  }

  /* ── RESIZE ── */
  window.addEventListener('resize', () => {
    sizeCanvas();
    drawFrame(displayFrame);
  }, { passive: true });

  /* ── SCROLL ── */
  window.addEventListener('scroll', handleNavbar, { passive: true });

  /* ── INIT ── */
  function init() {
    addRevealClasses();
    observeRevealEls();
    preloadFrames();
    handleNavbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
