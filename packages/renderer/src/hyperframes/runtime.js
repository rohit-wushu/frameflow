/* Frameflow composition runtime for HyperFrames (inlined into index.html).
 *
 * Composition contract, adapted from motion-video-skill (references/composition-contract.md),
 * Copyright (c) 2026 BestAgentKits, MIT License:
 *  - every time comes from window.TIMING; no Date, no requestAnimationFrame, no CSS animations;
 *  - randomness only through the seeded rng();
 *  - all DOM is built synchronously before the first tween;
 *  - one paused GSAP timeline, registered as window.__timelines["main"].
 *
 * Templates call FF.register(name, build). build(ctx) builds its DOM inside ctx.el and adds tweens
 * to ctx.tl at absolute times (ctx.t0 = scene start). The shell owns scene visibility, transitions,
 * the background, captions and the fades.
 */
(function () {
  "use strict";
  var FF = (window.FF = { templates: {} });
  FF.register = function (name, build) {
    FF.templates[name] = build;
  };

  // ---------- small helpers ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function norm(w) {
    return String(w).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}']/gu, ""); // same rule as scene-schema normalizeWord
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // visible characters: a Devanagari consonant with its vowel signs is one cluster, not three code points
  var graphemes = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("hi", { granularity: "grapheme" }) : null;
  function visibleLength(word) {
    if (!graphemes || /^[\x00-\x7f]*$/.test(word)) return word.length;
    return Array.from(graphemes.segment(word)).length * 1.1; // clusters run a little wider than latin letters
  }
  function wrapLines(text, perLine) {
    var lines = 1, cur = 0;
    var ws = String(text).split(/\s+/).filter(Boolean);
    for (var i = 0; i < ws.length; i++) {
      var n = visibleLength(ws[i]);
      if (n > perLine) return Infinity;
      if (cur === 0) cur = n;
      else if (cur + 1 + n <= perLine) cur += 1 + n;
      else { lines++; cur = n; }
    }
    return lines;
  }
  // Deterministic font size (no DOM measuring): the largest size <= `size` at which `text`
  // wraps into at most `lines` lines of `width` px, assuming ~charWidth em per character.
  function fit(text, o) {
    var floor = o.min || o.size * 0.45;
    var cw = o.charWidth || 0.56;
    var s = o.size;
    while (s > floor && wrapLines(text, Math.floor(o.width / (s * cw))) > o.lines) s -= 1;
    return Math.round(s);
  }
  // Words as masked spans, for rise-in reveals.
  function words(parent, text, cls) {
    return String(text).trim().split(/\s+/).map(function (w, i) {
      if (i) parent.append(document.createTextNode(" "));
      var mask = el("span", "ff-mask");
      var s = el("span", "ff-w" + (cls ? " " + cls : ""), w);
      mask.append(s);
      parent.append(mask);
      return s;
    });
  }
  function letters(parent, text) {
    return Array.from(String(text)).map(function (ch) {
      var s = el("span", "ff-l", ch === " " ? " " : ch);
      parent.append(s);
      return s;
    });
  }

  // ---------- run ----------
  FF.start = function () {
    var T = window.TIMING;
    var P = window.PLAN;
    var root = document.getElementById("root");
    var W = Number(root.dataset.width), H = Number(root.dataset.height);
    var u = Math.min(W, H) / 100;
    var tl = gsap.timeline({ paused: true });
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = tl;
    var colors = P.brand.colors;

    function icon(name) {
      var holder = el("span", "ff-icon");
      holder.innerHTML = P.icons[name] || P.icons.__fallback || "";
      var svg = holder.querySelector("svg");
      if (svg) {
        svg.removeAttribute("class"); // Tabler's class="icon ..." would pick up template styles
        svg.querySelectorAll("path,line,circle,rect,polyline,polygon,ellipse").forEach(function (n) {
          if (n.getAttribute("stroke") === "none") n.remove();
          else n.setAttribute("pathLength", "1");
        });
      }
      return holder;
    }

    // animation vocabulary shared by all templates
    var A = {
      rise: function (t, at, o) {
        o = o || {};
        return tl.fromTo(t, { autoAlpha: 0, y: o.y !== undefined ? o.y : 4 * u }, { autoAlpha: 1, y: 0, duration: o.d || 0.6, ease: o.ease || "power3.out", stagger: o.stagger || 0 }, at);
      },
      pop: function (t, at, o) {
        o = o || {};
        return tl.fromTo(t, { autoAlpha: 0, scale: o.from !== undefined ? o.from : 0.6 }, { autoAlpha: 1, scale: 1, duration: o.d || 0.5, ease: o.ease || "back.out(1.8)", stagger: o.stagger || 0 }, at);
      },
      fade: function (t, at, o) {
        o = o || {};
        return tl.fromTo(t, { autoAlpha: 0 }, { autoAlpha: 1, duration: o.d || 0.5, ease: o.ease || "power1.out", stagger: o.stagger || 0 }, at);
      },
      // masked word reveal, one time per word
      reveal: function (spans, times, o) {
        o = o || {};
        spans.forEach(function (s, i) {
          tl.fromTo(s, { yPercent: 110 }, { yPercent: 0, duration: o.d || 0.55, ease: o.ease || "power3.out" }, times[i]);
        });
      },
      draw: function (holder, at, d) {
        d = d || 0.7;
        var parts = holder.querySelectorAll("[pathLength]");
        if (parts.length) tl.fromTo(parts, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: d, ease: "power2.inOut", stagger: d * 0.12 }, at);
      },
      bump: function (t, at, o) {
        o = o || {};
        tl.to(t, { scale: o.scale || 1.06, duration: 0.08, ease: "power1.out" }, at);
        tl.to(t, { scale: 1, duration: o.d || 0.35, ease: "power2.out" }, at + 0.08);
      },
    };

    // background: brand color + two soft glows that drift and breathe on downbeats
    (function background() {
      var bg = document.getElementById("bg");
      var a = el("div", "ff-glow ff-glow-a"), b = el("div", "ff-glow ff-glow-b");
      bg.append(a, b);
      var r = rng(7), step = 5;
      for (var t = 0; t < T.duration; t += step) {
        tl.to(a, { x: (r() - 0.5) * 18 * u, y: (r() - 0.5) * 14 * u, duration: step, ease: "sine.inOut" }, t);
        tl.to(b, { x: (r() - 0.5) * 18 * u, y: (r() - 0.5) * 14 * u, duration: step, ease: "sine.inOut" }, t);
      }
      T.downbeats.forEach(function (d) {
        tl.fromTo([a, b], { scale: 1.08 }, { scale: 1, duration: 0.55, ease: "power2.out", immediateRender: false }, d);
      });
    })();

    // scenes
    var stage = document.getElementById("stage");
    var sections = P.scenes.map(function (scene, i) {
      var st = T.scenes[i];
      var section = el("section", "scene layer t-" + scene.template);
      section.id = "scene-" + i;
      var inner = el("div", "scene-inner");
      section.append(inner);
      stage.append(section);
      var build = FF.templates[scene.template];
      if (!build) throw new Error("template not loaded: " + scene.template);
      var ctx = {
        el: inner, section: section, content: scene.content, brand: P.brand, logo: P.logo, images: P.images || {}, format: P.format,
        W: W, H: H, u: u, tl: tl,
        t0: st.start, t1: st.end, dur: st.duration, voiceStart: st.voiceStart, voiceEnd: st.voiceEnd,
        words: st.words, items: st.items, accent: st.accent,
        beats: T.beats.filter(function (b) { return b >= st.start && b < st.end; }),
      };
      // onset of a spoken word in this scene (after `after`), or `fallback`
      ctx.say = function (word, after, fallback) {
        var n = norm(word);
        var from = after === undefined ? st.start - 0.01 : after;
        for (var k = 0; k < st.words.length; k++) if (st.words[k].s > from && st.words[k].w === n) return st.words[k].s;
        return fallback;
      };
      // reveal times for word spans: on the spoken words when most are spoken, else a stagger from `start`
      ctx.wordTimes = function (spans, start, stagger) {
        stagger = stagger || 0.06;
        var after = st.start - 0.01, hits = 0;
        var times = spans.map(function (s) {
          var n = norm(s.textContent);
          for (var k = 0; k < st.words.length; k++) {
            if (st.words[k].s > after && st.words[k].w === n) { after = st.words[k].s; hits++; return st.words[k].s; }
          }
          return null;
        });
        if (hits >= Math.max(2, spans.length * 0.6)) {
          var prev = start - stagger;
          return times.map(function (t) { prev = t === null ? prev + stagger : Math.max(t - 0.06, prev + 0.02); return prev; });
        }
        return spans.map(function (_, k) { return start + k * stagger; });
      };
      // scene.textScale (from a "make the text bigger" edit) scales the main text; it still has to fit
      var scale = scene.textScale || 1;
      var scaledFit = function (text, o) {
        return fit(text, Object.assign({}, o, { size: o.size * scale, min: (o.min || o.size * 0.45) * Math.min(scale, 1) }));
      };
      ctx.h = { el: el, words: words, letters: letters, fit: scaledFit, icon: icon, rng: rng, norm: norm, A: A };
      build(ctx);
      return section;
    });

    // transitions: the shell owns scene visibility; each cut sits on a beat (see packages/timing)
    var wipe = document.getElementById("wipe");
    tl.set(wipe, { xPercent: -101 }, 0);
    tl.set(sections[0], { autoAlpha: 1 }, 0);
    for (var i = 0; i < sections.length - 1; i++) {
      var out = sections[i], inn = sections[i + 1];
      var c = T.scenes[i].end;
      var kind = P.scenes[i].transitionOut;
      if (kind === "fade") {
        tl.to(out, { autoAlpha: 0, duration: 0.45, ease: "power1.inOut" }, c - 0.25);
        tl.fromTo(inn, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: "power1.inOut" }, c - 0.25);
      } else if (kind === "slide") {
        tl.to(out, { x: -0.3 * W, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, c - 0.3);
        tl.fromTo(inn, { x: 0.3 * W, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" }, c);
      } else if (kind === "zoom") {
        tl.to(out, { scale: 1.3, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, c - 0.3);
        tl.fromTo(inn, { scale: 0.85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "power3.out" }, c);
      } else if (kind === "wipe") {
        tl.fromTo(wipe, { xPercent: -101 }, { xPercent: 0, duration: 0.3, ease: "power2.in", immediateRender: false }, c - 0.3);
        tl.set(out, { autoAlpha: 0 }, c);
        tl.set(inn, { autoAlpha: 1 }, c);
        tl.fromTo(wipe, { xPercent: 0 }, { xPercent: 101, duration: 0.4, ease: "power2.out", immediateRender: false }, c);
      } else {
        // hard cut, with a small punch-in so the beat is felt
        tl.set(out, { autoAlpha: 0 }, c);
        tl.set(inn, { autoAlpha: 1 }, c);
        tl.fromTo(inn, { scale: 1.035 }, { scale: 1, duration: 0.45, ease: "power2.out", immediateRender: false }, c);
      }
    }

    // burned-in word captions (optional)
    if (P.captions && T.captions) {
      var layer = document.getElementById("captions");
      T.captions.forEach(function (cap) {
        var wrap = el("div", "ff-cap"), box = el("div", "ff-cap-box");
        var spans = cap.words.map(function (w, j) {
          if (j) box.append(document.createTextNode(" "));
          var s = el("span", "ff-cw", w.text);
          box.append(s);
          return s;
        });
        wrap.append(box);
        layer.append(wrap);
        tl.fromTo(wrap, { autoAlpha: 0, y: 1.2 * u }, { autoAlpha: 1, y: 0, duration: 0.12, ease: "power2.out" }, cap.start);
        tl.to(wrap, { autoAlpha: 0, duration: 0.1, ease: "power1.in" }, Math.max(cap.start + 0.2, cap.end - 0.1));
        cap.words.forEach(function (w, j) {
          tl.fromTo(spans[j], { color: "#ffffff" }, { color: colors.primary, duration: 0.05, immediateRender: false }, w.s);
          tl.to(spans[j], { color: "#ffffff", duration: 0.15 }, j < cap.words.length - 1 ? cap.words[j + 1].s : w.e + 0.1);
        });
      });
    }

    // fade up from black, fade out at the end
    var fade = document.getElementById("fade");
    tl.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: "power1.out" }, 0);
    tl.fromTo(fade, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.in", immediateRender: false }, T.duration - 0.6);
    tl.set({}, {}, T.duration); // pin the timeline length to the video length
  };
})();
