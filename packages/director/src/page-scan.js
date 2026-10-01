// Runs inside the website (Playwright page.evaluate). Plain JS, no imports: it is injected as a string.
// Returns raw samples; packages/director/src/brand.ts turns them into brand.json.
(() => {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const meta = (sel) => (document.querySelector(sel) && document.querySelector(sel).getAttribute("content")) || "";
  const visible = (el, r) => {
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05;
  };

  // ---- colors: backgrounds weighted by visible area, accents from buttons and links ----
  const areas = {};
  const accents = {};
  const bump = (bag, color, w) => {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return;
    bag[color] = (bag[color] || 0) + w;
  };
  const all = Array.from(document.querySelectorAll("body *")).slice(0, 5000);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > 2500 || !visible(el, r)) continue;
    const cs = getComputedStyle(el);
    const area = Math.min(r.width * r.height, 250000);
    bump(areas, cs.backgroundColor, area);
    if (el.matches("a, button, [role=button], [class*=btn], [class*=button], [class*=cta], input[type=submit]")) {
      bump(accents, cs.backgroundColor, area + 20000);
      if (el.matches("a")) bump(accents, cs.color, 3000);
      if (cs.borderTopWidth !== "0px") bump(accents, cs.borderTopColor, 2000);
    }
  }
  const body = getComputedStyle(document.body);
  const heading = document.querySelector("h1") || document.querySelector("h2");
  const headingStyle = heading ? getComputedStyle(heading) : body;

  // ---- logo: the best image or inline SVG near the top, inside the header or the home link ----
  const logoScore = (el, r) => {
    const cls = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    const link = el.closest("a");
    const attrs = [el.id, cls, el.getAttribute("alt"), el.getAttribute("aria-label"), el.getAttribute("src"), link && link.getAttribute("aria-label"), link && link.className]
      .join(" ")
      .toLowerCase();
    let s = 0;
    if (attrs.includes("logo")) s += 5;
    if (el.closest("header, nav, [class*=header], [class*=navbar]")) s += 3;
    if (link) {
      try {
        if (new URL(link.href, location.href).pathname === "/") s += 4;
      } catch (e) {}
    }
    if (r.top < 160) s += 2;
    if (r.left < 480) s += 1;
    if (r.width >= 60 && r.width <= 420 && r.height >= 16 && r.height <= 140) s += 2;
    if (r.width / r.height > 1.8) s += 1; // wordmarks are wide
    return s;
  };
  let best = null;
  for (const el of document.querySelectorAll("img, svg")) {
    if (el.tagName.toLowerCase() === "svg" && el.parentElement && el.parentElement.closest("svg")) continue;
    const r = el.getBoundingClientRect();
    if (r.top > 320 || r.width < 16 || !visible(el, r)) continue;
    const score = logoScore(el, r);
    if (!best || score > best.score) best = { el, r, score };
  }
  let logo = null;
  if (best && best.score >= 7) {
    const { el, r } = best;
    if (el.tagName.toLowerCase() === "img") {
      logo = { kind: "img", src: el.currentSrc || el.src, width: r.width, height: r.height, score: best.score };
    } else if (!el.querySelector("use")) {
      // bake the computed (painted) colors in, so the SVG looks the same outside the page:
      // attributes may use CSS variables or classes that only exist on the site. Gradient refs stay.
      const clone = el.cloneNode(true);
      const src = [el, ...el.querySelectorAll("*")];
      const dst = [clone, ...clone.querySelectorAll("*")];
      src.forEach((node, i) => {
        const cs = getComputedStyle(node);
        for (const prop of ["fill", "stroke", "opacity", "fill-opacity", "stroke-width"]) {
          const v = cs.getPropertyValue(prop);
          if (v && !v.startsWith("url(")) dst[i].setAttribute(prop, v);
        }
      });
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(Math.round(r.width)));
      clone.setAttribute("height", String(Math.round(r.height)));
      if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
      clone.removeAttribute("class");
      clone.removeAttribute("style");
      logo = { kind: "svg", markup: clone.outerHTML, width: r.width, height: r.height, score: best.score };
    }
  }

  // named areas of the first screen, in percent of the viewport, so a zoom can target them by name
  const vw = window.innerWidth, vh = window.innerHeight;
  const pct = (v, of) => Math.round((v / of) * 1000) / 10;
  const box = (r) => {
    const x = Math.max(0, r.left), y = Math.max(0, r.top), x2 = Math.min(vw, r.right), y2 = Math.min(vh, r.bottom);
    return { x: pct(x, vw), y: pct(y, vh), w: pct(x2 - x, vw), h: pct(y2 - y, vh) };
  };
  const shown = (sel) =>
    Array.from(document.querySelectorAll(sel))
      .map((e) => [e, e.getBoundingClientRect()])
      .filter(([e, r]) => {
        const st = getComputedStyle(e);
        return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && st.visibility !== "hidden" && Number(st.opacity) > 0.1;
      });
  const regions = {};
  const headline = shown("h1")[0] || shown("h2")[0];
  if (headline) regions.headline = box(headline[1]);
  const filled = (e) => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(e).backgroundColor);
  const cta = shown("a, button")
    .filter(([e, r]) => r.height >= 28 && r.height <= 96 && r.width <= 440 && r.top > vh * 0.12 && filled(e) && clean(e.innerText).length > 1)
    .sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height)[0];
  if (cta) regions.button = box(cta[1]);
  const nav = shown("header, nav").find(([, r]) => r.top < vh * 0.15 && r.width > vw * 0.5);
  if (nav) regions.nav = box(nav[1]);
  const media = shown("img, video, canvas, picture, svg")
    .filter(([, r]) => r.width * r.height > vw * vh * 0.06)
    .sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height)[0];
  if (media) regions.image = box(media[1]);

  return {
    regions,
    title: clean(document.title),
    siteName: meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]'),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    headings: Array.from(document.querySelectorAll("h1, h2, h3")).map((e) => clean(e.innerText)).filter(Boolean).slice(0, 30),
    text: clean(document.body.innerText).slice(0, 8000),
    colors: {
      background: body.backgroundColor,
      pageBackground: getComputedStyle(document.documentElement).backgroundColor,
      text: headingStyle.color,
      accents,
      areas,
    },
    fonts: { heading: headingStyle.fontFamily, body: body.fontFamily },
    logo,
  };
})();
