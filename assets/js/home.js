(() => {
  const ACCENTS = { "00": "#d8a657", "01": "#5fb3a1", "02": "#7aa2f7", "03": "#c98fbf" };
  const grid = document.getElementById("chapterGrid");
  const resume = document.getElementById("resumeBtn");

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("msf:last") || "null"); } catch { return null; }
  })();

  const fmt = (n) => new Intl.NumberFormat("zh-CN").format(n);

  fetch("data/manifest.json")
    .then((r) => r.ok ? r.json() : Promise.reject(new Error("manifest")))
    .then((data) => {
      document.getElementById("heroTotal").textContent = data.total;
      document.getElementById("statPages").textContent = data.total;
      document.getElementById("footTotal").textContent = data.total;
      document.getElementById("statPdfs").textContent = data.parts || 7;

      const positions = {};
      data.chapters.forEach((c) => {
        try { positions[c.id] = JSON.parse(localStorage.getItem("msf:pos:" + c.id) || "null"); } catch {}
      });

      grid.innerHTML = data.chapters.map((c) => {
        const pos = positions[c.id];
        const status = pos ? `上次到第 ${pos} 页` : "尚未开始";
        return `
        <a class="chapter-card" href="viewer.html#/${c.id}/${pos ? Math.min(pos, c.count) : 1}" style="--accent:${ACCENTS[c.id] || "#d8a657"}">
          <div class="cover">
            <img src="${c.cover}" alt="${c.title} 课件首页" loading="lazy" width="432" height="324">
            <span class="cover-num">${c.num}</span>
            <span class="cover-count">${c.count} 页</span>
          </div>
          <div class="card-body">
            <div class="card-top">
              <span class="card-en">${c.en}</span>
              <span class="card-progress">${status}</span>
            </div>
            <h3>${c.title}</h3>
            <p>${c.desc}</p>
            <div class="card-foot">
              <span>第 ${c.num} 章 · ${c.count} 页</span>
              <span class="go">进入章节
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </div>
          </div>
        </a>`;
      }).join("");

      if (saved && saved.ch) {
        resume.href = `viewer.html#/${saved.ch}/${saved.page || 1}`;
        resume.innerHTML = `继续第 ${saved.ch} 章 · 第 ${saved.page || 1} 页
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg>`;
      }
    })
    .catch(() => {
      grid.innerHTML = `<p style="color:var(--ink-faint);font-size:13px">课件索引加载失败，请刷新重试。</p>`;
    });
})();
