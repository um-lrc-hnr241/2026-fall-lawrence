const stage = document.querySelector("#book-page");
const cover = stage.firstElementChild;
const controls = document.querySelector(".book-controls");
const previous = document.querySelector("#book-previous");
const next = document.querySelector("#book-next");
const headerLinks = [...document.querySelectorAll(".book-header nav a")];
const pages = headerLinks.map((link, index) => ({
  title: index === 0 ? "Cover" : link.textContent.trim(),
  file: link.getAttribute("href"),
  slug: index === 0 ? "" : link.getAttribute("href").replace(".html", ""),
}));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const contents = new Map();
let pageIndex = 0;
let navigation = 0;
let activeTurn;

function loadPage(index) {
  if (!contents.has(index)) {
    const loading = fetch(pages[index].file).then(async (response) => {
      if (!response.ok) throw new Error("The page could not be loaded.");
      const page = new DOMParser().parseFromString(await response.text(), "text/html");
      const main = page.querySelector("main");
      if (!main) throw new Error("The page has no main content.");

      const paper = document.createElement("article");
      paper.className = "book-paper";
      paper.append(...main.childNodes);
      return paper;
    }).catch((error) => {
      contents.delete(index);
      throw error;
    });
    contents.set(index, loading);
  }
  return contents.get(index);
}

function updateControl(link, index, arrow) {
  const page = pages[index];
  link.hidden = !page;
  if (page) {
    link.href = page.file;
    link.textContent = arrow === "←" ? `← ${page.title}` : `${page.title} →`;
  }
}

async function showPage(index, { push = false, focus = true, animate = true } = {}) {
  const request = ++navigation;
  if (index === pageIndex) return;
  let paper;

  try {
    paper = index === 0 ? cover : await loadPage(index);
  } catch {
    if (request === navigation) window.location.assign(pages[index].file);
    return;
  }
  if (request !== navigation) return;
  activeTurn?.skipTransition();

  const backward = index < pageIndex;
  const render = () => {
    if (request !== navigation) return;
    pageIndex = index;
    stage.replaceChildren(paper);
    controls.hidden = index === 0;
    updateControl(previous, index - 1, "←");
    updateControl(next, index + 1, "→");

    headerLinks.forEach((link, position) => {
      if (position === index) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = index === 0 ? "Logs of Lawrence" : `${pages[index].title} | Logs of Lawrence`;

    if (push) {
      const url = new URL(window.location.href);
      url.hash = pages[index].slug;
      history.pushState(null, "", url);
    }
    if (focus) {
      const heading = paper.querySelector("h1");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  if (!animate || reducedMotion.matches) {
    render();
  } else if (document.startViewTransition) {
    document.documentElement.classList.toggle("book-backward", backward);
    activeTurn = document.startViewTransition(render);
    activeTurn.ready.catch(() => {});
  } else {
    render();
    stage.animate?.(
      [{ transform: `perspective(1450px) rotateY(${backward ? -85 : 85}deg)` },
        { transform: "perspective(1450px) rotateY(0deg)" }],
      { duration: 450, easing: "ease-out" },
    );
  }
}

function showPageFromHash(animate) {
  const slug = window.location.hash.slice(1);
  if (slug === "main") return;
  const index = pages.findIndex((page) => page.slug === slug);
  if (index >= 0) showPage(index, { focus: animate, animate });
}

for (const link of [...headerLinks, document.querySelector(".site-title a"),
  cover.querySelector(".cover-link"), previous, next]) {
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const file = link.getAttribute("href");
    const index = pages.findIndex((page) => page.file === file);
    if (index < 0) return;
    event.preventDefault();
    showPage(index, { push: true });
  });
}

window.addEventListener("hashchange", () => showPageFromHash(true));
showPageFromHash(false);

function drawTumbleweed(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.lineCap = "round";
  const colors = ["#533219", "#86512b", "#b9854b", "#e2b572"];

  // Draw tangled stems and forked tips on an irregular silhouette.
  for (let stem = 0; stem < 49; stem++) {
    const angle = random() * 2 * Math.PI;
    const reach = 33 + random() * 48;
    const bend = (random() - 0.5) * 95;
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = colors[stem % colors.length];
    ctx.lineWidth = 1.15 + random() * 1.7;
    ctx.beginPath();
    ctx.moveTo(-reach * 0.64, bend * 0.2);
    ctx.bezierCurveTo(-reach * 0.19, bend, reach * 0.68, -bend * 0.15, reach, bend * 0.18);
    ctx.moveTo(reach * 0.5, bend * 0.15);
    ctx.quadraticCurveTo(reach * 0.68, bend * 0.3, reach * 0.8, bend * 0.56);
    ctx.moveTo(reach * 0.73, bend * 0.11);
    ctx.lineTo(reach * 0.91, -bend * 0.21);
    ctx.stroke();
    ctx.restore();
  }

  return true;
}

const weedToggle = cover.querySelector(".weed-toggle");
if (drawTumbleweed(cover.querySelector("canvas"))) {
  cover.querySelector(".weed-trail").hidden = false;
  weedToggle.hidden = false;
  weedToggle.addEventListener("click", () => {
    const paused = cover.classList.toggle("weed-paused");
    weedToggle.textContent = paused ? "Play tumbleweed" : "Pause tumbleweed";
  });
}
