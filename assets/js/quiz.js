(() => {
  "use strict";

  const SET = new URLSearchParams(location.search).get("set") === "2" ? "2" : "1";
  const DATA_URL = SET === "2" ? "data/quiz2.json" : "data/quiz.json";
  const KEY = SET === "2" ? "msf:quiz:v2" : "msf:quiz:v1";
  const LETTERS = ["A", "B", "C", "D"];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    list: $("#quizList"),
    reportWrap: $("#reportWrap"),
    report: $("#quizReport"),
    answered: $("#answeredCount"),
    answeredTotal: $("#answeredTotal"),
    timer: $("#timer"),
    fill: $("#progressFill"),
    bar: $("#progressBar"),
    sheet: $("#answerSheet"),
    sheetCount: $("#sheetCount"),
    sheetScore: $("#sheetScore"),
    lgResult: $("#lgResult"),
    submit: $("#submitBtn"),
    submitBottom: $("#submitBtnBottom"),
    retryBottom: $("#retryBtnBottom"),
    filterGroup: $("#filterGroup"),
    heroKicker: $("#heroKicker"),
    heroTitle: $("#heroTitle"),
    heroCount: $("#heroCount"),
    heroLede: $("#heroLede"),
    factTotal: $("#factTotal"),
    factConcept: $("#factConcept"),
    factCalc: $("#factCalc"),
    factScore: $("#factScore"),
    quizSets: $("#quizSets"),
    footerCount: $("#footerCount"),
    dialog: $("#quizDialog"),
    dialogKicker: $("#dialogKicker"),
    dialogTitle: $("#dialogTitle"),
    dialogText: $("#dialogText"),
    dialogCancel: $("#dialogCancel"),
    dialogConfirm: $("#dialogConfirm"),
  };

  let meta = null;
  let questions = [];
  let byId = new Map();
  let answers = {};
  let submitted = false;
  let startAt = 0;
  let elapsedMs = 0;
  let filter = "all";
  let timerId = null;
  let dialogAction = null;

  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function typeset() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise([document.body]).catch(() => {});
      return;
    }
    typeset.tries = (typeset.tries || 0) + 1;
    if (typeset.tries < 24) setTimeout(typeset, 250);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ answers, submitted, startAt, elapsedMs }));
    } catch (_) { /* storage may be unavailable */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return;
      if (s.answers && typeof s.answers === "object") {
        Object.entries(s.answers).forEach(([k, v]) => {
          const id = Number(k);
          const val = Number(v);
          if (byId.has(id) && Number.isInteger(val) && val >= 0 && val < 4) answers[id] = val;
        });
      }
      submitted = !!s.submitted;
      startAt = Number(s.startAt) || 0;
      elapsedMs = Number(s.elapsedMs) || 0;
    } catch (_) { /* ignore corrupt state */ }
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(() => {
      if (!startAt || submitted) return;
      el.timer.textContent = formatTime(Date.now() - startAt);
    }, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function cardHtml(q) {
    const opts = q.options.map((text, i) => `
      <label class="q-opt" data-opt="${i}">
        <input type="radio" name="q${q.id}" value="${i}">
        <span class="opt-key">${LETTERS[i]}</span>
        <span class="opt-text">${esc(text)}</span>
        <span class="opt-mark" aria-hidden="true"></span>
      </label>`).join("");
    return `
      <article class="q-card" id="q-${q.id}" data-id="${q.id}">
        <header class="q-head">
          <span class="q-num">${pad(q.id)}</span>
          <span class="q-type">${q.type === "calc" ? "计算" : "概念"}</span>
          <span class="q-topic">${esc(q.topic)}</span>
          <a class="q-src" href="viewer.html#/${q.ch}/${q.page}" target="_blank" rel="noopener" title="在课件中查看第 ${q.ch} 章第 ${q.page} 页">课件 P${q.page}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a>
        </header>
        <h3 class="q-stem">${esc(q.stem)}</h3>
        <fieldset class="q-options"><legend class="sr-only">第 ${q.id} 题选项</legend>${opts}</fieldset>
        <div class="q-feedback" hidden>
          <div class="q-verdict"><span class="qv-tag"></span><span class="qv-answer"></span></div>
          <div class="q-explain"><b>解析</b><div>${esc(q.explain)}</div></div>
        </div>
      </article>`;
  }

  function render() {
    el.list.innerHTML = meta.chapters.map(ch => {
      const qs = questions.filter(q => q.ch === ch.id);
      if (!qs.length) return "";
      return `
        <section class="quiz-chapter" data-chapter="${ch.id}" style="--accent:${ch.accent}">
          <header class="qc-head">
            <span class="qc-num">${ch.id}</span>
            <div><h2>${ch.title}</h2><p>${ch.en}</p></div>
            <span class="qc-line"></span>
            <span class="qc-count">${qs.length} 题</span>
          </header>
          ${qs.map(cardHtml).join("")}
        </section>`;
    }).join("");
  }

  function paintCard(card) {
    const id = Number(card.dataset.id);
    const chosen = answers[id];
    card.classList.toggle("answered", chosen !== undefined);
    $$(".q-opt", card).forEach((opt, i) => {
      opt.classList.toggle("selected", chosen === i);
    });
  }

  function updateProgress() {
    const done = questions.reduce((n, q) => n + (answers[q.id] !== undefined ? 1 : 0), 0);
    el.answered.textContent = String(done);
    el.fill.style.width = `${(done / questions.length) * 100}%`;
    el.bar.setAttribute("aria-valuenow", String(done));
    el.sheetCount.textContent = `${done}/${questions.length}`;
  }

  function renderSheet() {
    const correct = questions.reduce((n, q) => n + (answers[q.id] === q.answer ? 1 : 0), 0);
    el.sheet.innerHTML = questions.map(q => {
      const chosen = answers[q.id];
      let cls = "sheet-dot";
      if (chosen !== undefined) cls += " done";
      if (submitted) {
        if (chosen === undefined) cls += " no blank";
        else if (chosen === q.answer) cls += " ok";
        else cls += " no";
      }
      const status = chosen === undefined ? "未作答" : "已作答";
      return `<button type="button" class="${cls}" data-jump="${q.id}" aria-label="第 ${q.id} 题，${status}">${q.id}</button>`;
    }).join("");

    el.sheetScore.hidden = !submitted;
    if (submitted) {
      el.sheetScore.innerHTML = `<b>${correct * meta.perQuestion}</b><span>分 · 答对 ${correct}/${questions.length}</span>`;
    }
  }

  function lockInputs() {
    $$(".q-opt input", el.list).forEach(input => { input.disabled = true; });
    el.list.classList.add("submitted");
  }

  function unlockInputs() {
    $$(".q-opt input", el.list).forEach(input => { input.disabled = false; });
    el.list.classList.remove("submitted");
  }

  function applyGrading() {
    questions.forEach(q => {
      const card = document.getElementById(`q-${q.id}`);
      if (!card) return;
      const chosen = answers[q.id];
      card.classList.remove("is-right", "is-wrong", "is-blank");
      if (chosen === undefined) card.classList.add("is-blank");
      else if (chosen === q.answer) card.classList.add("is-right");
      else card.classList.add("is-wrong");

      $$(".q-opt", card).forEach((opt, i) => {
        opt.classList.remove("is-correct", "is-wrong", "is-chosen");
        if (i === q.answer) opt.classList.add("is-correct");
        if (chosen === i && chosen !== q.answer) opt.classList.add("is-wrong");
        if (chosen === i) opt.classList.add("is-chosen");
        const mark = $(".opt-mark", opt);
        if (mark) {
          if (i === q.answer) mark.textContent = "✓";
          else if (chosen === i) mark.textContent = "✕";
          else mark.textContent = "";
        }
      });

      const feedback = $(".q-feedback", card);
      if (feedback) feedback.hidden = false;
      const tag = $(".qv-tag", card);
      if (tag) tag.textContent = chosen === undefined ? "未作答" : chosen === q.answer ? "回答正确" : "回答错误";
      const ans = $(".qv-answer", card);
      if (ans) {
        const mine = chosen === undefined ? "未作答" : LETTERS[chosen];
        ans.textContent = `你的答案：${mine}　正确答案：${LETTERS[q.answer]}`;
      }
    });
  }

  function commentFor(score) {
    if (score === 100) return "全对。概念辨析和计算都过关，可以直接进入下一章。";
    if (score >= 90) return "很稳。错题多半是细节概念，看一下解析即可。";
    if (score >= 80) return "基础不错。重点复习错题里的易混概念和计算。";
    if (score >= 60) return "及格线以上。建议按章节把错题对应的课件页再过一遍。";
    return "先别急着刷第二遍，回到课件把错题所在页看懂，再重做一次。";
  }

  function showReport(scroll) {
    const total = questions.length;
    const correct = questions.reduce((n, q) => n + (answers[q.id] === q.answer ? 1 : 0), 0);
    const wrong = total - correct;
    const score = correct * meta.perQuestion;
    const accuracy = Math.round((correct / total) * 100);
    const time = formatTime(elapsedMs || (startAt ? Date.now() - startAt : 0));

    const chapterStats = meta.chapters.map(ch => {
      const qs = questions.filter(q => q.ch === ch.id);
      const c = qs.reduce((n, q) => n + (answers[q.id] === q.answer ? 1 : 0), 0);
      return {
        id: ch.id,
        title: ch.title,
        accent: ch.accent,
        total: qs.length,
        correct: c,
        pct: qs.length ? Math.round((c / qs.length) * 100) : 0,
      };
    }).filter(c => c.total > 0);

    const weakest = chapterStats.filter(c => c.pct < 100).sort((a, b) => a.pct - b.pct)[0];
    const advice = weakest
      ? `失分最多的是「${weakest.title}」，建议回看第 ${weakest.id} 章。`
      : "每个章节都全对。";

    const rows = chapterStats.map(c => `
      <div class="rc-row" style="--accent:${c.accent}">
        <span class="rc-name"><i></i>${c.title}</span>
        <span class="rc-num">${c.correct}/${c.total}</span>
        <span class="rc-bar"><i style="width:${c.pct}%"></i></span>
        <span class="rc-pct">${c.pct}%</span>
      </div>`).join("");

    el.report.innerHTML = `
      <article class="report-card">
        <div class="report-top">
          <div class="score-ring" style="--p:${score}" role="img" aria-label="得分 ${score} 分">
            <div class="score-inner"><b>${score}</b><span>分</span></div>
          </div>
          <div class="report-copy">
            <p class="kicker">Grading Report</p>
            <h2>批改报告</h2>
            <p class="report-comment">${commentFor(score)}${advice}</p>
            <div class="report-stats">
              <div><b>${correct}</b><span>答对</span></div>
              <div><b>${wrong}</b><span>答错</span></div>
              <div><b>${accuracy}%</b><span>正确率</span></div>
              <div><b>${time}</b><span>用时</span></div>
            </div>
          </div>
        </div>
        <div class="report-chapters">${rows}</div>
        <div class="report-actions">
          ${wrong ? `<button type="button" class="btn" data-action="wrong">查看错题</button>` : ""}
          <button type="button" class="btn" data-action="retry">重做本套</button>
          <a class="btn" href="viewer.html#/00/1">返回课件</a>
        </div>
      </article>`;
    el.reportWrap.hidden = false;
    el.lgResult.hidden = false;
    if (scroll) {
      setTimeout(() => el.reportWrap.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    }
    typeset();
  }

  function setFilter(next) {
    filter = next;
    el.list.classList.toggle("filter-wrong", filter === "wrong");
    $$(".qt-filter button").forEach(b => b.classList.toggle("on", b.dataset.filter === filter));
    $$(".quiz-chapter", el.list).forEach(sec => {
      if (filter === "wrong") {
        const hasWrong = $$(".q-card", sec).some(c => c.classList.contains("is-wrong") || c.classList.contains("is-blank"));
        sec.hidden = !hasWrong;
      } else {
        sec.hidden = false;
      }
    });
  }

  function jumpTo(id) {
    const card = document.getElementById(`q-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1100);
  }

  function jumpFirstWrong() {
    const q = questions.find(item => answers[item.id] !== item.answer);
    if (!q) return;
    jumpTo(q.id);
  }

  function openDialog({ kicker, title, text, confirm, cancel, onConfirm }) {
    el.dialogKicker.textContent = kicker || "Confirm";
    el.dialogTitle.textContent = title;
    el.dialogText.textContent = text;
    el.dialogConfirm.textContent = confirm || "确定";
    el.dialogCancel.textContent = cancel || "取消";
    dialogAction = onConfirm || null;
    if (typeof el.dialog.showModal === "function") {
      el.dialog.showModal();
    } else if (window.confirm(`${title}\n\n${text}`)) {
      const fn = dialogAction;
      dialogAction = null;
      if (fn) fn();
    }
  }

  function doSubmit() {
    if (submitted) return;
    submitted = true;
    elapsedMs = startAt ? Date.now() - startAt : 0;
    stopTimer();
    el.timer.textContent = formatTime(elapsedMs);
    save();
    lockInputs();
    applyGrading();
    updateProgress();
    renderSheet();
    showReport(true);
    setFilter("all");
    el.filterGroup.hidden = false;
    el.retryBottom.hidden = false;
    el.submit.textContent = "已提交";
    el.submit.disabled = true;
    el.submitBottom.textContent = "已提交";
    el.submitBottom.disabled = true;
    typeset();
  }

  function requestSubmit() {
    if (submitted) return;
    const unanswered = questions.filter(q => answers[q.id] === undefined).length;
    if (!unanswered) {
      doSubmit();
      return;
    }
    openDialog({
      kicker: "Unanswered",
      title: `还有 ${unanswered} 题未作答`,
      text: "未作答的题会按错误计分。可以先回去补完，也可以直接交卷。",
      confirm: "仍然提交",
      cancel: "继续作答",
      onConfirm: doSubmit,
    });
  }

  function doReset() {
    answers = {};
    submitted = false;
    startAt = 0;
    elapsedMs = 0;
    filter = "all";
    stopTimer();
    try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }

    el.timer.textContent = "00:00";
    el.reportWrap.hidden = true;
    el.report.innerHTML = "";
    el.filterGroup.hidden = true;
    el.retryBottom.hidden = true;
    el.lgResult.hidden = true;
    el.sheetScore.hidden = true;
    el.sheetScore.innerHTML = "";
    el.submit.textContent = "提交答案";
    el.submit.disabled = false;
    el.submitBottom.textContent = "提交答案";
    el.submitBottom.disabled = false;

    questions.forEach(q => {
      const card = document.getElementById(`q-${q.id}`);
      if (!card) return;
      card.classList.remove("is-right", "is-wrong", "is-blank", "answered", "flash");
      $$(".q-opt", card).forEach(opt => {
        opt.classList.remove("is-correct", "is-wrong", "is-chosen", "selected");
        const input = $("input", opt);
        if (input) input.checked = false;
        const mark = $(".opt-mark", opt);
        if (mark) mark.textContent = "";
      });
      const feedback = $(".q-feedback", card);
      if (feedback) feedback.hidden = true;
      const tag = $(".qv-tag", card);
      if (tag) tag.textContent = "";
      const ans = $(".qv-answer", card);
      if (ans) ans.textContent = "";
    });

    unlockInputs();
    setFilter("all");
    updateProgress();
    renderSheet();
    window.scrollTo({ top: Math.max(0, $("#quizSection").offsetTop - 90), behavior: "smooth" });
  }

  function requestReset() {
    openDialog({
      kicker: "Reset",
      title: "重做本套题？",
      text: "当前作答、分数和用时会被清空，题目顺序不变。",
      confirm: "清空重做",
      cancel: "取消",
      onConfirm: doReset,
    });
  }

  function bind() {
    $$("#submitBtn, #submitBtnBottom").forEach(btn => btn.addEventListener("click", requestSubmit));
    $$("#retryBtnBottom").forEach(btn => btn.addEventListener("click", requestReset));

    el.list.addEventListener("change", e => {
      const input = e.target.closest('input[type="radio"]');
      if (!input || submitted) return;
      const card = input.closest(".q-card");
      const id = Number(card.dataset.id);
      answers[id] = Number(input.value);
      if (!startAt) {
        startAt = Date.now();
        startTimer();
      }
      paintCard(card);
      save();
      updateProgress();
      renderSheet();
    });

    el.sheet.addEventListener("click", e => {
      const btn = e.target.closest("[data-jump]");
      if (!btn) return;
      if (filter === "wrong") setFilter("all");
      jumpTo(Number(btn.dataset.jump));
    });

    el.filterGroup.addEventListener("click", e => {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      setFilter(btn.dataset.filter);
    });

    el.report.addEventListener("click", e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "wrong") {
        setFilter("wrong");
        jumpFirstWrong();
      }
      if (btn.dataset.action === "retry") requestReset();
    });

    el.dialogConfirm.addEventListener("click", () => {
      const fn = dialogAction;
      dialogAction = null;
      el.dialog.close();
      if (fn) fn();
    });
    el.dialogCancel.addEventListener("click", () => {
      dialogAction = null;
      el.dialog.close();
    });
    el.dialog.addEventListener("cancel", () => { dialogAction = null; });

    window.addEventListener("pagehide", () => {
      if (!submitted && startAt) elapsedMs = Date.now() - startAt;
      save();
    });
  }

  function applyRestoredState() {
    questions.forEach(q => {
      const card = document.getElementById(`q-${q.id}`);
      if (card) paintCard(card);
    });
    updateProgress();
    renderSheet();

    if (submitted) {
      lockInputs();
      applyGrading();
      el.filterGroup.hidden = false;
      el.retryBottom.hidden = false;
      el.submit.textContent = "已提交";
      el.submit.disabled = true;
      el.submitBottom.textContent = "已提交";
      el.submitBottom.disabled = true;
      el.lgResult.hidden = false;
      el.timer.textContent = formatTime(elapsedMs);
      showReport(false);
      setFilter("all");
    } else if (startAt) {
      startTimer();
      el.timer.textContent = formatTime(Date.now() - startAt);
    }
  }

  function applyMetaChrome() {
    const total = questions.length;
    const concept = questions.filter(q => q.type === "concept").length;
    const calc = total - concept;
    const setLabel = meta.setLabel || "章节自测";

    document.title = `${meta.heroTitle || "章节自测"} · 材料科学基础`;
    el.heroKicker.textContent = meta.kicker || "Self-test · Chapters 00–03";
    el.heroTitle.textContent = meta.heroTitle || "章节自测";
    el.heroCount.textContent = `${total} 题`;
    if (meta.lede) el.heroLede.textContent = meta.lede;
    el.factTotal.textContent = String(total);
    el.factConcept.textContent = String(concept);
    el.factCalc.textContent = String(calc);
    el.factScore.textContent = String(total * meta.perQuestion);
    el.answeredTotal.textContent = String(total);
    el.bar.setAttribute("aria-valuemax", String(total));
    el.footerCount.textContent = `材料科学基础（上）· 2026 秋 · ${setLabel} ${total} 题`;

    $$("a[data-set]", el.quizSets).forEach(a => {
      const on = a.dataset.set === SET;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      meta = data.meta;
      questions = Array.isArray(data.questions) ? data.questions : [];
      if (!meta || !questions.length) throw new Error("empty quiz");
      byId = new Map(questions.map(q => [q.id, q]));
      applyMetaChrome();
      restore();
      render();
      bind();
      applyRestoredState();
      typeset();
    } catch (err) {
      el.list.innerHTML = `<div class="quiz-error"><b>题库没有载入成功</b><p>请确认 <code>${DATA_URL}</code> 存在，并通过 HTTP 服务打开本页。</p></div>`;
      console.error(err);
    }
  }

  init();
})();
