(() => {
  "use strict";

  const ACCENTS = { "00": "#d8a657", "01": "#5fb3a1", "02": "#7aa2f7", "03": "#c98fbf" };

  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const wrap = $("slideWrap");
  const img = $("slideImg");
  const pills = $("chapterPills");
  const panel = $("gridPanel");
  const panelGrid = $("panelGrid");
  const backdrop = $("panelBackdrop");
  const searchLayer = $("searchLayer");
  const searchInput = $("searchInput");
  const searchResults = $("searchResults");
  const searchCount = $("searchCount");
  const scrollEl = $("scrollMode");
  const progress = $("progress");
  const progressFill = $("progressFill");

  let chapters = [];
  let allSlides = [];
  let state = { chId: "00", page: 1, mode: "deck" };
  let loadToken = 0;
  let searchIndex = -1;
  let searchTimer = 0;
  let scrollTick = false;

  const cur = () => chapters.find((c) => c.id === state.chId) || chapters[0];
  const chIndex = () => chapters.findIndex((c) => c.id === state.chId);
  const accent = () => ACCENTS[state.chId] || "#d8a657";
  const esc = (s) => s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function hashToState() {
    const m = location.hash.match(/^#\/(\d{2})(?:\/(\d{1,3}))?/);
    if (!m) return null;
    const c = chapters.find((x) => x.id === m[1]);
    if (!c) return null;
    const p = Math.min(Math.max(parseInt(m[2] || "1", 10) || 1, 1), c.count);
    return { chId: c.id, page: p };
  }

  function savedState() {
    try {
      const s = JSON.parse(localStorage.getItem("msf:last") || "null");
      if (s && chapters.some((c) => c.id === s.ch)) {
        const c = chapters.find((x) => x.id === s.ch);
        return { chId: c.id, page: Math.min(Math.max(s.page || 1, 1), c.count) };
      }
    } catch {}
    return null;
  }

  function persist() {
    try {
      localStorage.setItem("msf:last", JSON.stringify({ ch: state.chId, page: state.page }));
      localStorage.setItem("msf:pos:" + state.chId, String(state.page));
    } catch {}
  }

  function setHash(replace = true) {
    const h = `#/${state.chId}/${state.page}`;
    if (location.hash === h) return;
    if (replace) history.replaceState(null, "", h);
    else location.hash = h;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------- navigation ---------- */

  function go(chId, page, opts = {}) {
    const c = chapters.find((x) => x.id === chId);
    if (!c) return;
    const p = Math.min(Math.max(page, 1), c.count);
    const switched = chId !== state.chId;
    state.chId = chId;
    state.page = p;

    if (switched) {
      document.body.style.setProperty("--accent", accent());
      renderPills();
      updatePdf();
      if (panel.classList.contains("open")) buildPanel();
      if (state.mode === "scroll") buildScroll(false);
    }

    if (state.mode === "scroll") {
      scrollToSlide(p, opts.smooth);
      if (switched) requestAnimationFrame(() => scrollToSlide(p, false));
    } else {
      showSlide();
    }

    updateMeta();
    setHash(opts.replace !== false);
    persist();
  }

  function step(delta) {
    const ci = chIndex();
    const target = state.page + delta;
    if (target < 1) {
      if (ci > 0) go(chapters[ci - 1].id, chapters[ci - 1].count);
      return;
    }
    if (target > cur().count) {
      if (ci < chapters.length - 1) go(chapters[ci + 1].id, 1);
      return;
    }
    go(state.chId, target);
  }

  function showSlide() {
    const s = cur().slides[state.page - 1];
    if (!s) return;
    const token = ++loadToken;
    wrap.classList.add("loading");
    img.classList.remove("ready");
    const next = new Image();
    next.onload = () => {
      if (token !== loadToken) return;
      img.src = s.img;
      img.alt = `${cur().title} 第 ${s.n} 页${s.title ? "：" + s.title : ""}`;
      wrap.classList.remove("loading");
      requestAnimationFrame(() => img.classList.add("ready"));
      preload(state.page + 1);
      preload(state.page - 1);
    };
    next.onerror = () => {
      if (token !== loadToken) return;
      wrap.classList.remove("loading");
      toast("这一页图片加载失败，请刷新重试");
    };
    next.src = s.img;
  }

  function preload(page) {
    if (page < 1 || page > cur().count) return;
    const s = cur().slides[page - 1];
    if (s) new Image().src = s.img;
  }

  function updateMeta() {
    const c = cur();
    const s = c.slides[state.page - 1];
    $("chapterLabel").textContent = `第 ${c.num} 章 · ${c.title}`;
    $("slideTitle").textContent = s && s.title ? s.title : "";
    $("counter").innerHTML = `${state.page} <em>/ ${c.count}</em>`;
    progressFill.style.width = `${(state.page / c.count) * 100}%`;
    document.title = `${c.num} ${c.title} · ${state.page}/${c.count} · 材料科学基础`;
    const first = chIndex() === 0 && state.page === 1;
    const last = chIndex() === chapters.length - 1 && state.page === c.count;
    $("prevBtn").disabled = first;
    $("prevBtn2").disabled = first;
    $("nextBtn").disabled = last;
    $("nextBtn2").disabled = last;
    if (panel.classList.contains("open")) highlightThumb();
  }

  /* ---------- chrome ---------- */

  function renderPills() {
    pills.innerHTML = chapters.map((c) => `
      <button class="chip ${c.id === state.chId ? "on" : ""}" data-ch="${c.id}" style="--accent:${ACCENTS[c.id] || "#d8a657"}">
        <i>${c.num}</i>${c.title}
      </button>`).join("");
    const on = pills.querySelector(".chip.on");
    if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function updatePdf() {
    $("pdfLink").href = cur().pdf || "#";
  }

  function buildPanel() {
    const c = cur();
    $("panelTitle").textContent = `${c.num} ${c.title}`;
    $("panelCount").textContent = `${c.count} 页`;
    panelGrid.innerHTML = c.slides.map((s) => `
      <button class="thumb-btn ${s.n === state.page ? "on" : ""}" data-page="${s.n}" title="${esc(s.title || "第 " + s.n + " 页")}">
        <img src="${s.thumb}" alt="" loading="lazy"><b>${s.n}</b>
      </button>`).join("");
  }

  function highlightThumb() {
    const old = panelGrid.querySelector(".thumb-btn.on");
    if (old) old.classList.remove("on");
    const el = panelGrid.querySelector(`.thumb-btn[data-page="${state.page}"]`);
    if (el) {
      el.classList.add("on");
      el.scrollIntoView({ block: "nearest" });
    }
  }

  function openPanel() {
    buildPanel();
    panel.classList.add("open");
    backdrop.classList.add("show");
    highlightThumb();
  }

  function closePanel() {
    panel.classList.remove("open");
    backdrop.classList.remove("show");
  }

  /* ---------- continuous scroll ---------- */

  function buildScroll(keep) {
    const c = cur();
    scrollEl.innerHTML = c.slides.map((s) => `
      <div class="scroll-item ${s.n === state.page ? "current" : ""}" data-n="${s.n}">
        <span class="si-num">${s.n}</span>
        <img src="${s.img}" alt="${esc(c.title)} 第 ${s.n} 页" loading="lazy" decoding="async">
      </div>`).join("");
  }

  function scrollToSlide(n, smooth) {
    const el = scrollEl.querySelector(`.scroll-item[data-n="${n}"]`);
    if (!el) return;
    scrollEl.scrollTo({ top: el.offsetTop - 10, behavior: smooth ? "smooth" : "auto" });
    markScrollCurrent(n);
  }

  function markScrollCurrent(n) {
    const old = scrollEl.querySelector(".scroll-item.current");
    if (old) old.classList.remove("current");
    const el = scrollEl.querySelector(`.scroll-item[data-n="${n}"]`);
    if (el) el.classList.add("current");
  }

  function setMode(mode) {
    state.mode = mode;
    document.body.classList.toggle("mode-scroll", mode === "scroll");
    $("modeBtn").classList.toggle("on", mode === "scroll");
    $("modeLabel").textContent = mode === "scroll" ? "单页" : "连续";
    if (mode === "scroll") {
      buildScroll(false);
      requestAnimationFrame(() => scrollToSlide(state.page, false));
    } else {
      showSlide();
    }
    toast(mode === "scroll" ? "连续滚动" : "单页放映");
  }

  scrollEl.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      if (state.mode !== "scroll") return;
      const base = scrollEl.getBoundingClientRect().top + 100;
      let best = null;
      for (const el of scrollEl.children) {
        if (el.getBoundingClientRect().top <= base) best = el;
        else break;
      }
      if (!best) best = scrollEl.firstElementChild;
      if (!best) return;
      const n = Number(best.dataset.n);
      if (n && n !== state.page) {
        state.page = n;
        markScrollCurrent(n);
        updateMeta();
        setHash();
        persist();
      }
    });
  });

  /* ---------- search ---------- */

  function openSearch() {
    searchLayer.classList.add("open");
    searchInput.value = "";
    searchIndex = -1;
    renderSearch("");
    requestAnimationFrame(() => searchInput.focus());
  }

  function closeSearch() {
    searchLayer.classList.remove("open");
    searchInput.blur();
  }

  function renderSearch(q) {
    const query = q.trim();
    if (!query) {
      searchResults.innerHTML = `<p class="search-empty">输入关键词，检索全部 ${allSlides.length} 页课件的文字。</p>`;
      searchCount.textContent = "";
      return;
    }
    const lower = query.toLowerCase();
    const hits = [];
    for (const item of allSlides) {
      const text = item.s.text;
      const at = text.toLowerCase().indexOf(lower);
      if (at < 0) continue;
      hits.push({ item, text, at });
      if (hits.length >= 120) break;
    }
    if (!hits.length) {
      searchResults.innerHTML = `<p class="search-empty">没有找到「${esc(query)}」相关的课件。</p>`;
      searchCount.textContent = "0 条";
      return;
    }
    searchCount.textContent = `${hits.length}${hits.length >= 120 ? "+" : ""} 条结果`;
    searchResults.innerHTML = hits.map((h, i) => {
      const start = Math.max(0, h.at - 34);
      const raw = (start > 0 ? "…" : "") + h.text.slice(start, start + 110) + (start + 110 < h.text.length ? "…" : "");
      const marked = esc(raw).replace(new RegExp(esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
      return `<button class="sr-item ${i === searchIndex ? "sel" : ""}" data-ch="${h.item.c.id}" data-page="${h.item.s.n}">
        <span class="sr-meta"><i>${h.item.c.num} ${h.item.c.title}</i><span>第 ${h.item.s.n} 页</span></span>
        <span class="sr-text">${marked}</span>
      </button>`;
    }).join("");
    if (searchIndex >= 0) {
      const sel = searchResults.querySelector(".sr-item.sel");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    }
  }

  function activateSearchItem(el) {
    if (!el) return;
    closeSearch();
    go(el.dataset.ch, Number(el.dataset.page));
  }

  /* ---------- events ---------- */

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => toast("当前浏览器不支持全屏"));
    } else {
      document.exitFullscreen?.();
    }
  }

  function bind() {
    pills.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      let page = 1;
      try { page = Number(localStorage.getItem("msf:pos:" + b.dataset.ch)) || 1; } catch {}
      go(b.dataset.ch, page);
    });
    panelGrid.addEventListener("click", (e) => {
      const b = e.target.closest(".thumb-btn");
      if (!b) return;
      go(state.chId, Number(b.dataset.page));
      closePanel();
    });
    $("gridBtn").addEventListener("click", openPanel);
    $("panelClose").addEventListener("click", closePanel);
    backdrop.addEventListener("click", closePanel);

    $("prevBtn").addEventListener("click", () => step(-1));
    $("nextBtn").addEventListener("click", () => step(1));
    $("prevBtn2").addEventListener("click", () => step(-1));
    $("nextBtn2").addEventListener("click", () => step(1));

    $("searchBtn").addEventListener("click", openSearch);
    searchLayer.addEventListener("click", (e) => {
      if (e.target === searchLayer) closeSearch();
    });
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchIndex = -1;
        renderSearch(searchInput.value);
      }, 90);
    });
    searchInput.addEventListener("keydown", (e) => {
      const items = [...searchResults.querySelectorAll(".sr-item")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        searchIndex = e.key === "ArrowDown"
          ? Math.min(searchIndex + 1, items.length - 1)
          : Math.max(searchIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle("sel", i === searchIndex));
        items[searchIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        activateSearchItem(items[Math.max(searchIndex, 0)]);
      }
    });
    searchResults.addEventListener("click", (e) => {
      const b = e.target.closest(".sr-item");
      if (b) activateSearchItem(b);
    });

    $("fsBtn").addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      $("fsBtn").classList.toggle("on", !!document.fullscreenElement);
    });

    $("modeBtn").addEventListener("click", () => setMode(state.mode === "scroll" ? "deck" : "scroll"));

    progress.addEventListener("click", (e) => {
      const r = progress.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.999);
      go(state.chId, Math.max(1, Math.ceil(ratio * cur().count)));
    });

    document.addEventListener("keydown", (e) => {
      if (searchLayer.classList.contains("open")) {
        if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
        return;
      }
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault(); step(1); break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault(); step(-1); break;
        case " ":
          e.preventDefault(); step(1); break;
        case "Home":
          e.preventDefault(); go(state.chId, 1); break;
        case "End":
          e.preventDefault(); go(state.chId, cur().count); break;
        case "f":
        case "F":
          e.preventDefault(); toggleFullscreen(); break;
        case "o":
        case "O":
          e.preventDefault();
          panel.classList.contains("open") ? closePanel() : openPanel();
          break;
        case "c":
        case "C":
          e.preventDefault();
          setMode(state.mode === "scroll" ? "deck" : "scroll");
          break;
        case "/":
          e.preventDefault(); openSearch(); break;
        case "k":
        case "K":
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); openSearch(); }
          break;
        case "Escape":
          closePanel();
          break;
      }
    });

    window.addEventListener("hashchange", () => {
      const h = hashToState();
      if (h && (h.chId !== state.chId || h.page !== state.page)) go(h.chId, h.page, { replace: true });
    });

    let touch = null;
    stage.addEventListener("touchstart", (e) => {
      if (state.mode === "scroll" || e.touches.length !== 1) return;
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (!touch || state.mode === "scroll") return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ---------- boot ---------- */

  function fail(msg) {
    stage.innerHTML = `<div style="text-align:center;color:#9ba5ae;font-size:14px;line-height:2">
      <p>${msg}</p>
      <p><a href="./" style="color:#d8a657">返回章节目录</a></p>
    </div>`;
  }

  fetch("data/slides.json")
    .then((r) => r.ok ? r.json() : Promise.reject(new Error("slides")))
    .then((data) => {
      chapters = data.chapters;
      allSlides = [];
      chapters.forEach((c) => c.slides.forEach((s) => allSlides.push({ c, s })));

      const initial = hashToState() || savedState() || { chId: chapters[0].id, page: 1 };
      state.chId = initial.chId;
      state.page = initial.page;
      document.body.style.setProperty("--accent", accent());

      renderPills();
      updatePdf();
      updateMeta();
      showSlide();
      setHash(true);
      bind();
    })
    .catch(() => fail("课件索引加载失败，请确认通过网站地址访问并刷新重试。"));
})();
