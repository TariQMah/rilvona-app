// Rilvona site behaviour. Served as /app.js because the site's Content-Security-Policy only allows same-origin scripts.
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Twinkling starfield behind the page.
  var canvas = document.getElementById('stars');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var stars = [];
    var width = 0;
    var height = 0;
    var raf = 0;
    var draw = function (t) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = reduce ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }
    };
    var loop = function (t) {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    var resize = function () {
      // Phones fire resize while scrolling (the URL bar moving); only rebuild when the width really changes.
      if (stars.length && Math.abs(window.innerWidth - width) < 2) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(Math.round((width * height) / 8000), 260);
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.1 + 0.25,
          a: Math.random() * 0.65 + 0.15,
          speed: Math.random() * 0.0016 + 0.0004,
          phase: Math.random() * 6.28,
        });
      }
      draw(0);
    };
    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      raf = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) cancelAnimationFrame(raf);
        else raf = requestAnimationFrame(loop);
      });
    }
  }

  // Tell people on the wrong device what to do.
  var note = document.getElementById('platform-note');
  var ua = navigator.userAgent;
  if (note && !/Android/i.test(ua)) {
    note.hidden = false;
    note.textContent = /iPhone|iPad|iPod/i.test(ua)
      ? 'Rilvona is Android only for now. There is no iPhone version yet.'
      : 'Opening this on a computer? Open rilvona.com on your Android phone to install, or send it the link.';
  }

  // Copy the checksum.
  var buttons = document.querySelectorAll('[data-copy]');
  Array.prototype.forEach.call(buttons, function (button) {
    button.addEventListener('click', function () {
      var text = document.getElementById(button.getAttribute('data-copy')).textContent;
      var done = function () {
        button.textContent = 'Copied';
        setTimeout(function () {
          button.textContent = 'Copy checksum';
        }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  // Soft spotlight that follows the pointer on cards.
  if (!reduce) {
    var cards = document.querySelectorAll('.spot');
    Array.prototype.forEach.call(cards, function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }
})();
