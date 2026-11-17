/* ==========================================================
   Aaditya Raj Shah: Homepage interactions (v2)
   Vanilla JS, no libraries, no eval, no innerHTML with user data.
   Everything is scoped to #ars-home and runs once per page.
   ========================================================== */
(function () {
  'use strict';

  function init(root) {
  root.setAttribute('data-ars-init', '1');
  root.classList.add('ars-ready');

  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var fine = mq('(hover: hover) and (pointer: fine)');
  var $ = function (s, c) { return (c || root).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var raf = window.requestAnimationFrame.bind(window);

  /* Motion setting. Many Windows, Mac and Android devices have "reduce motion" switched on
     (battery saver does it too). Then the page stays calm, and shows a small button that lets
     the visitor turn the animations on for themselves. */
  var osReduce = mq('(prefers-reduced-motion: reduce)');
  var forced = /[?&]motion=on\b/.test(window.location.search);
  try { if (window.localStorage.getItem('ars-motion') === 'on') forced = true; } catch (e) {}
  var reduce = osReduce && !forced;
  if (forced) root.classList.add('ars-motion-on');
  if (reduce) root.classList.add('ars-calm');

  /* Fixed elements (progress bar, cursor, motion button) are moved to <body>.
     Page builders such as Elementor wrap content in transformed boxes, which would
     otherwise break position:fixed. */
  Array.prototype.slice.call(document.querySelectorAll('body > [data-ars-fixed]')).forEach(function (n) { n.parentNode.removeChild(n); });
  var fixedProgress = $('.ars-progress');
  var fixedCursor = $('.ars-cursor');
  [fixedProgress, fixedCursor].forEach(function (n) {
    if (n) { n.setAttribute('data-ars-fixed', '1'); document.body.appendChild(n); }
  });
  if (reduce) {
    var chip = document.createElement('div');
    chip.className = 'ars-motionchip';
    chip.setAttribute('data-ars-fixed', '1');
    chip.setAttribute('role', 'region');
    chip.setAttribute('aria-label', 'Animation settings');
    var cap = document.createElement('span');
    cap.textContent = 'Animations are reduced by your device settings.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Turn on animations';
    btn.addEventListener('click', function () {
      try { window.localStorage.setItem('ars-motion', 'on'); } catch (e) {}
      var u = window.location.href.split('#')[0];
      window.location.href = u + (u.indexOf('?') > -1 ? '&' : '?') + 'motion=on';
    });
    chip.appendChild(cap);
    chip.appendChild(btn);
    document.body.appendChild(chip);
  }

  /* ---------- 1. Emerging effects: text rises in, images wipe in ---------- */
  var RISE = [
    '.ars-hero .ars-eyebrow', '.ars-hero h1', '.ars-lead', '.ars-hero .ars-actions', '.ars-hero__loc',
    '.ars-sec .ars-eyebrow', '.ars-sec .ars-h2', '.ars-sub',
    '.ars-intro__body > p', '.ars-svc__head', '.ars-svc__body', '.ars-proj', '.ars-closing',
    '.ars-step', '.ars-principle', '.ars-seo__intro > p', '.ars-seo__sub', '.ars-benefit', '.ars-note',
    '.ars-about__copy > p:not(.ars-eyebrow)', '.ars-about__copy .ars-actions', '.ars-tile',
    '.ars-acc__item', '.ars-contact__copy > p:not(.ars-eyebrow)', '.ars-contactlist', '.ars-form', '.ars-signoff'
  ].join(',');

  if ('IntersectionObserver' in window && !reduce) {
    root.classList.add('ars-js');
    var risers = $$(RISE);
    var frames = $$('.ars-frame');
    risers.forEach(function (el) { el.setAttribute('data-rise', ''); });
    var io = new IntersectionObserver(function (entries) {
      var seen = entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
      seen.forEach(function (en, i) {
        var el = en.target, d = Math.min(i * 0.09, 0.45);
        io.unobserve(el);
        el.style.setProperty('--d', d + 's');
        if (el.__arsFrames) {
          // image frames are revealed when their wrapper scrolls into view
          // (a fully clipped element can never report itself as visible)
          el.__arsFrames.forEach(function (f) { f.style.setProperty('--d', d + 's'); f.classList.add('is-in'); });
        }
        if (!el.classList.contains('ars-frame')) el.classList.add('is-in');
        if (el.hasAttribute('data-rise')) {
          // once landed, drop the helper attribute so the element's own hover styles take over again
          window.setTimeout(function () {
            el.removeAttribute('data-rise');
            el.classList.remove('is-in');
            el.style.removeProperty('--d');
          }, 1300 + d * 1000);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    var hosts = [];
    frames.forEach(function (f) {
      var h = f.parentElement;
      if (!h.__arsFrames) { h.__arsFrames = []; hosts.push(h); }
      h.__arsFrames.push(f);
    });
    risers.forEach(function (el) { io.observe(el); });
    hosts.forEach(function (h) { if (risers.indexOf(h) < 0) io.observe(h); });
  }

  /* ---------- 2. Scroll-linked effects (one throttled handler) ---------- */
  var progress = fixedProgress;
  var bigtext = $('[data-words]');
  var words = [];
  if (bigtext) {
    var raw = bigtext.textContent.trim().split(/\s+/);
    bigtext.setAttribute('aria-label', raw.join(' '));
    while (bigtext.firstChild) bigtext.removeChild(bigtext.firstChild);
    raw.forEach(function (t, i) {
      var sp = document.createElement('span');
      sp.className = 'w';
      sp.setAttribute('aria-hidden', 'true');
      sp.textContent = t;
      bigtext.appendChild(sp);
      if (i < raw.length - 1) bigtext.appendChild(document.createTextNode(' '));
      words.push(sp);
    });
  }
  var steps = $('.ars-steps');
  var stepItems = steps ? $$('.ars-step', steps) : [];
  var ticking = false;

  var onScroll = function () {
    ticking = false;
    var vh = window.innerHeight;
    if (progress) {
      var rr = root.getBoundingClientRect();
      progress.style.setProperty('--p', clamp(-rr.top / Math.max(1, rr.height - vh), 0, 1).toFixed(4));
    }
    if (words.length) {
      var b = bigtext.getBoundingClientRect();
      var p = clamp((vh * 0.82 - b.top) / (b.height + vh * 0.3), 0, 1);
      var n = reduce ? words.length : Math.round(p * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n);
    }
    if (steps) {
      var sb = steps.getBoundingClientRect();
      var sp = clamp((vh * 0.8 - sb.top) / Math.max(sb.height, vh * 0.35), 0, 1);
      steps.style.setProperty('--prog', sp.toFixed(4));
      stepItems.forEach(function (el, idx) { el.classList.toggle('is-on', sp >= idx / stepItems.length + 0.02); });
    }
  };
  var request = function () { if (!ticking) { ticking = true; raf(onScroll); } };
  // capture:true also catches scrolling inside wrapper boxes (page builders, iframes)
  window.addEventListener('scroll', request, { passive: true, capture: true });
  window.addEventListener('resize', request);
  onScroll();

  /* ---------- 3. Simple cursor: a dot and a trailing ring ---------- */
  var cur = fixedCursor;
  if (cur && fine && !reduce) {
    var ring = $('.ars-cursor__ring', cur), dot = $('.ars-cursor__dot', cur);
    var mx = -100, my = -100, rx = -100, ry = -100, running = false;
    var loop = function () {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      if (Math.abs(mx - rx) > 0.3 || Math.abs(my - ry) > 0.3) raf(loop); else running = false;
    };
    root.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      cur.classList.add('is-on');
      var t = e.target && e.target.closest ? e.target.closest('a,button,select,textarea,input,[data-track]') : null;
      cur.classList.toggle('is-link', !!t);
      if (!running) { running = true; raf(loop); }
    });
    root.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
    root.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    window.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
  }

  /* ---------- 4. Marquees (seamless, speed in px/second) ---------- */
  $$('[data-marquee]').forEach(function (track) {
    if (reduce) return;
    var speed = parseFloat(track.getAttribute('data-speed')) || 50;
    var kids = Array.prototype.slice.call(track.children);
    var baseW = track.scrollWidth;
    if (!baseW) return;
    var reps = Math.max(1, Math.ceil((window.innerWidth + 200) / baseW));
    for (var r = 1; r < reps; r++) kids.forEach(function (k) { track.appendChild(k.cloneNode(true)); });
    Array.prototype.slice.call(track.children).forEach(function (k) {
      var c = k.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.removeAttribute('role');
      track.appendChild(c);
    });
    track.style.setProperty('--dur', ((baseW * reps) / speed).toFixed(1) + 's');
    track.classList.add('is-ready');
  });

  /* ---------- 5. Hover polish: hero glow, service spotlight, magnetic buttons ---------- */
  var hero = $('[data-hero]');
  if (hero && fine && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      hero.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
  }
  if (fine && !reduce) {
    $$('[data-spot]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    $$('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- 6. Projects carousel: arrows, drag, progress ---------- */
  var track = $('[data-track]');
  if (track) {
    var prev = $('[data-prev]'), next = $('[data-next]'), thumb = $('[data-trackbar]');
    var step = function () { var c = $('.ars-proj', track); return c ? c.getBoundingClientRect().width + 28 : 360; };
    var sync = function () {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft >= max - 4;
      if (thumb) {
        var wPct = clamp(track.clientWidth / track.scrollWidth, 0.08, 1);
        thumb.style.setProperty('--w', (wPct * 100).toFixed(1) + '%');
        thumb.style.setProperty('--x', (max > 0 ? (track.scrollLeft / max) * thumb.parentNode.clientWidth * (1 - wPct) : 0).toFixed(1) + 'px');
      }
    };
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    var down = false, moved = false, startX = 0, startL = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startL = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = startL - dx;
    });
    var up = function () { if (down) { down = false; track.classList.remove('is-drag'); } };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  }

  /* ---------- 7. FAQ accordion ---------- */
  $$('[data-acc] .ars-acc__item').forEach(function (item, _i, all) {
    var btn = $('.ars-acc__btn', item);
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      all.forEach(function (o) {
        o.classList.remove('is-open');
        $('.ars-acc__btn', o).setAttribute('aria-expanded', 'false');
      });
      if (!open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---------- 8. Smooth in-page links ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------- 9. Contact form ----------
     No server code needed.
     A: default, opens the visitor's email app with the message filled in.
     B: set data-endpoint to an https:// form service URL (Formspree, Web3Forms...) to post there.
     Safety: input length limits, honeypot field, https-only endpoint, 8 second cooldown,
     no HTML is ever inserted from form values (text only).                                  */
  var form = $('[data-form]');
  if (form) {
    var msg = $('[data-formmsg]', form);
    var lastSend = 0;
    var say = function (text, kind) { msg.textContent = text; msg.className = 'ars-form__msg' + (kind ? ' is-' + kind : ''); };
    var cut = function (v, n) { return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.company_site && form.elements.company_site.value) return; // bot: do nothing
      if (Date.now() - lastSend < 8000) { say('Please wait a few seconds before sending again.', 'bad'); return; }
      var ok = true, first = null;
      $$('.ars-field', form).forEach(function (f) {
        var inp = f.querySelector('input,select,textarea');
        var v = inp.value.trim();
        var bad = inp.hasAttribute('required') && !v;
        if (inp.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) bad = true;
        if (inp.name === 'url' && v && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) bad = true;
        f.classList.toggle('is-bad', bad);
        inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) { ok = false; if (!first) first = inp; }
      });
      if (!ok) { say('Please complete the highlighted fields. Check that your email address and website address are valid.', 'bad'); first.focus(); return; }
      var data = {
        name: cut(form.elements.name.value, 80),
        email: cut(form.elements.email.value, 120),
        url: cut(form.elements.url.value, 200),
        need: cut(form.elements.need.value, 80),
        message: cut(form.elements.message.value, 2000)
      };
      var to = form.getAttribute('data-email');
      var endpoint = (form.getAttribute('data-endpoint') || '').trim();
      lastSend = Date.now();
      if (/^https:\/\//i.test(endpoint)) {
        say('Sending your message...');
        var ctl = ('AbortController' in window) ? new AbortController() : null;
        var timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 12000) : null;
        fetch(endpoint, {
          method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data), signal: ctl ? ctl.signal : undefined
        }).then(function (r) {
          if (!r.ok) throw new Error('bad');
          say('Thank you. Your message is sent, and I will reply by email.', 'ok');
          form.reset();
        }).catch(function () {
          say('Your message could not be sent. Please email ' + to + ' instead.', 'bad');
        }).then(function () { if (timer) window.clearTimeout(timer); });
        return;
      }
      var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nWebsite: ' + (data.url || 'n/a') + '\nNeed: ' + data.need + '\n\n' + data.message;
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent('Project enquiry from ' + data.name) + '&body=' + encodeURIComponent(body);
      say('Opening your email app. If nothing opens, write to ' + to + '.', 'ok');
      window.location.href = href;
    });
  }

  root.setAttribute('data-ars-ready', reduce ? 'calm' : 'full');
  if (window.console && console.info) console.info('[ARS] animations ' + (reduce ? 'calm (reduced motion is on)' : 'running'));
  }

  /* Start-up: works whether the script loads before or after the markup (page builders, delayed scripts). */
  var tries = 0;
  function boot() {
    var root = document.getElementById('ars-home');
    if (root && !root.getAttribute('data-ars-init')) { init(root); return true; }
    return !!root;
  }
  if (!boot()) {
    var timer = window.setInterval(function () { tries += 1; if (boot() || tries > 40) window.clearInterval(timer); }, 250);
    document.addEventListener('DOMContentLoaded', boot);
    window.addEventListener('load', boot);
  }
})();
