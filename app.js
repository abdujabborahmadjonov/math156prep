(function () {
  "use strict";

  // ---------- storage ----------

  const KEY = "math156-prep-v1";
  const blank = () => ({ done: {}, units: {}, scores: {}, mistakes: [], seq: 1, practice: {}, run: null, unit: null });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* private mode or blocked storage: keep going in memory */ }
    return blank();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* in-memory only */ }
  }

  let state = load();

  // ---------- dates ----------

  const pad = (n) => String(n).padStart(2, "0");
  const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const diff = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
  const addDays = (s, n) => new Date(utc(s) + n * 864e5).toISOString().slice(0, 10);
  const fmt = (s, o) => new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: "UTC" }, o)).format(new Date(utc(s)));
  const longDate = (s) => fmt(s, { weekday: "long", month: "long", day: "numeric" });
  const shortDate = (s) => fmt(s, { weekday: "short", month: "short", day: "numeric" });

  function today() {
    const q = new URLSearchParams(location.search).get("date"); // ?date=2026-12-01 previews another day
    if (q && /^\d{4}-\d\d-\d\d$/.test(q)) return q;
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  const FIRST = DAYS[0].date;
  const byDate = Object.fromEntries(DAYS.map((d) => [d.date, d]));

  // ---------- helpers ----------

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
  const doneCount = () => DAYS.filter((d) => state.done[d.date]).length;

  function streak() {
    let t = today();
    if (!state.done[t]) t = addDays(t, -1);
    let n = 0;
    while (byDate[t] && state.done[t]) { n++; t = addDays(t, -1); }
    return n;
  }

  const openMistakes = () => state.mistakes.filter((m) => !m.closed);
  const dueMistakes = () => openMistakes().filter((m) => m.next <= today());

  // Text with maths between dollar signs, typeset by KaTeX when it has loaded.
  function tex(str) {
    return String(str).split(/(\$\$[^$]+\$\$|\$[^$]+\$)/).map((part) => {
      const display = part.startsWith("$$");
      if (!part.startsWith("$") || typeof katex === "undefined") return esc(part);
      try { return katex.renderToString(display ? part.slice(2, -2) : part.slice(1, -1), { displayMode: display, throwOnError: false }); }
      catch (e) { return esc(part); }
    }).join("");
  }

  const unitOfDay = (day) => { const m = /Unit (\d+)/.exec(day.focus); return m ? Number(m[1]) : null; };
  const solvedIn = (u) => QUESTIONS.filter((q) => q.unit === u && state.practice[q.id] === "ok").length;
  const totalIn = (u) => QUESTIONS.filter((q) => q.unit === u).length;
  const MOCK_SCORE = { mock1: "Mock 1", mock2: "Mock 2", mixed: "Mock 3" };

  const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- views ----------

  let selected = null; // a day picked from the squares; null means today

  function focusDate() {
    if (selected && byDate[selected]) return selected;
    const t = today();
    if (t < FIRST) return FIRST;
    if (t > EXAM_DATE) return EXAM_DATE;
    return t;
  }

  function scoreField(day) {
    if (!day.test) return "";
    const v = state.scores[day.test];
    return `<p class="score"><label for="score-${day.date}">${esc(day.test)} score</label>
      <input id="score-${day.date}" data-key="score-${day.date}" data-score="${esc(day.test)}" type="number" min="0" max="100" inputmode="numeric" value="${v == null ? "" : v}"> <span>%</span></p>`;
  }

  function calendar(sel) {
    const t = today();
    const heads = ["Tu", "We", "Th", "Fr", "Sa", "Su", "Mo"].map((d) => `<span>${d}</span>`).join("");
    const cells = DAYS.map((d) => {
      const done = !!state.done[d.date];
      const cls = ["cell"];
      if (done) cls.push("done");
      else if (d.date < t) cls.push("missed");
      if (d.date === t) cls.push("is-today");
      if (d.date === sel) cls.push("selected");
      if (d.date === EXAM_DATE) cls.push("exam");
      const status = done ? "done" : d.date < t ? "not done" : d.date === t ? "today" : "upcoming";
      return `<button type="button" class="${cls.join(" ")}" data-action="pick" data-date="${d.date}" data-key="cell-${d.date}"
        aria-label="${esc(shortDate(d.date) + ": " + d.focus + ", " + status)}">${Number(d.date.slice(8))}</button>`;
    }).join("");
    const s = streak();
    return `<aside class="calendar" aria-label="All 35 days">
      <div class="cal-head" aria-hidden="true">${heads}</div>
      <div class="cal">${cells}</div>
      <p class="cal-note"><strong>${doneCount()} of ${DAYS.length}</strong> sessions done${s >= 2 ? `, ${s} days in a row` : ""}</p>
    </aside>`;
  }

  function viewToday() {
    const t = today();
    const date = focusDate();
    const day = byDate[date];
    const isToday = date === t;
    const done = !!state.done[date];

    let when = esc(longDate(date));
    if (t < FIRST && !selected) when = "The plan starts " + when;
    if (t > EXAM_DATE && !selected) when = "The final was " + when;

    const action = done
      ? `<span class="done-mark">${CHECK} Done</span><button type="button" class="link" data-action="toggle" data-date="${date}" data-key="toggle">Undo</button>`
      : `<button type="button" class="btn" data-action="toggle" data-date="${date}" data-key="toggle">${isToday ? "Mark today done" : "Mark this day done"}</button>`;

    const nudges = [];
    const due = dueMistakes().length;
    if (due) nudges.push(`<li><a class="link" href="#mistakes">${plural(due, "mistake")} to retry today</a></li>`);
    const dayUnit = unitOfDay(day);
    if (dayUnit) nudges.push(`<li><button type="button" class="link" data-action="gounit" data-unit="${dayUnit}">Practice questions for Unit ${dayUnit}</button> <span class="quiet">${solvedIn(dayUnit)} of ${totalIn(dayUnit)} solved</span></li>`);
    if (/^Mock exam/.test(day.focus)) nudges.push(`<li><a class="link" href="#mocks">Open the mock exams</a></li>`);
    const behind = DAYS.filter((d) => d.date < t && !state.done[d.date]).length;
    if (behind) nudges.push(`<li>${plural(behind, "earlier day")} not marked done. <a class="link" href="#plan">Open the plan</a></li>`);
    if (!isToday && byDate[t]) nudges.push(`<li><button type="button" class="link" data-action="pick" data-date="${t}">Back to today</button></li>`);

    return `<div class="today">
      <section class="session" aria-live="polite">
        <p class="when">${when}<span class="phase">${esc(day.phase)}</span></p>
        <h1 class="title">${esc(day.focus)}</h1>
        <p class="lede">${esc(day.plan)}</p>
        ${day.due ? `<p class="due-line">${day.date === EXAM_DATE ? "" : "Due: "}${esc(day.due)}</p>` : ""}
        ${scoreField(day)}
        <div class="actions">${action}</div>
        ${nudges.length ? `<ul class="nudges">${nudges.join("")}</ul>` : ""}
      </section>
      ${calendar(date)}
    </div>`;
  }

  function viewPlan() {
    const t = today();
    const blocks = [];
    DAYS.forEach((d) => {
      const last = blocks[blocks.length - 1];
      if (last && last.phase === d.phase) last.days.push(d);
      else blocks.push({ phase: d.phase, days: [d] });
    });

    const html = blocks.map((b) => {
      const a = b.days[0].date, z = b.days[b.days.length - 1].date;
      const range = a === z ? fmt(a, { month: "short", day: "numeric" }) : fmt(a, { month: "short", day: "numeric" }) + " to " + fmt(z, { month: "short", day: "numeric" });
      const rows = b.days.map((d) => {
        const done = !!state.done[d.date];
        return `<li class="day${done ? " is-done" : ""}${d.date === t ? " is-today" : ""}">
          <input type="checkbox" data-action="toggle" data-date="${d.date}" data-key="chk-${d.date}" ${done ? "checked" : ""} aria-label="${esc(shortDate(d.date) + ", " + d.focus)}">
          <span class="d">${shortDate(d.date)}</span>
          <details${d.date === t ? " open" : ""}>
            <summary>${esc(d.focus)}</summary>
            <p>${esc(d.plan)}</p>
            ${d.due ? `<p class="tag">${esc(d.due)}</p>` : ""}
          </details>
        </li>`;
      }).join("");
      return `<section class="phase-block">
        <div class="phase-head"><h2>${esc(b.phase)}</h2><span class="quiet small">${range}. ${esc(PHASES[b.phase])}</span></div>
        <ul>${rows}</ul>
      </section>`;
    }).join("");

    return `<h1 class="title">The plan</h1>
      <p class="lede">35 days, one session a day. Tick a day when it is finished and open it to see what to do.</p>
      ${html}`;
  }

  function viewProgress() {
    const tests = DAYS.filter((d) => d.test);
    const filled = tests.filter((d) => state.scores[d.test] != null);
    let trend = "Record each test score here. The first one is your baseline.";
    if (filled.length === 1) trend = `Baseline: ${filled[0].test}, ${state.scores[filled[0].test]}%.`;
    if (filled.length >= 2) {
      const a = state.scores[filled[0].test], z = state.scores[filled[filled.length - 1].test];
      const d = z - a, first = `your first score (${filled[0].test}, ${a}%)`;
      trend = d > 0 ? `Up ${plural(d, "point")} on ${first}.`
        : d < 0 ? `Down ${plural(-d, "point")} on ${first}. Look at which unit lost them.`
        : `Level with ${first}.`;
    }

    const scoreRows = tests.map((d) => {
      const v = state.scores[d.test];
      return `<li>
        <strong>${esc(d.test)}</strong>
        <span class="date quiet small">${fmt(d.date, { month: "short", day: "numeric" })}</span>
        <span class="score"><input data-key="score-${d.date}" data-score="${esc(d.test)}" type="number" min="0" max="100" inputmode="numeric" value="${v == null ? "" : v}" aria-label="${esc(d.test)} score in percent"> <span>%</span></span>
        <span class="bar" aria-hidden="true"><i style="width:${v == null ? 0 : Math.max(0, Math.min(100, v))}%"></i></span>
      </li>`;
    }).join("");

    const counts = { Red: 0, Yellow: 0, Green: 0 };
    UNITS.forEach((u) => { if (counts[state.units[u.id]] != null) counts[state.units[u.id]]++; });
    const unrated = UNITS.length - counts.Red - counts.Yellow - counts.Green;
    const tally = unrated === UNITS.length ? "Rate each unit after you practise it."
      : `${counts.Green} green, ${counts.Yellow} yellow, ${counts.Red} red${unrated ? `, ${unrated} not rated` : ""}`;

    const unitRows = UNITS.map((u) => {
      const r = state.units[u.id] || "";
      const open = openMistakes().filter((m) => m.unit === u.id).length;
      const dots = ["Red", "Yellow", "Green"].map((c) =>
        `<button type="button" class="dot ${c.toLowerCase()}" data-action="rate" data-unit="${u.id}" data-rating="${c}" data-key="rate-${u.id}-${c}" aria-pressed="${r === c}" aria-label="Unit ${u.id}: ${c}" title="${c}"></button>`).join("");
      return `<li class="unit">
        <span class="n">${u.id}</span>
        <div>
          <h3>${esc(u.name)}</h3>
          <p>${esc(u.topics)}. ${esc(u.ref)}. ${solvedIn(u.id)} of ${totalIn(u.id)} practice questions solved${open ? `, ${plural(open, "open mistake")}` : ""}</p>
        </div>
        <div class="rate"><span class="now">${r || "Not rated"}</span>${dots}</div>
      </li>`;
    }).join("");

    return `<h1 class="title">Progress</h1>
      <p class="lede">${doneCount()} of ${DAYS.length} sessions done. ${esc(trend)}</p>
      <h2 class="section">Test scores</h2>
      <ul class="scores">${scoreRows}</ul>
      <h2 class="section">Units <span class="quiet">${tally}</span></h2>
      <ul>${unitRows}</ul>`;
  }

  function mistakeItem(m, mode) {
    const unit = UNITS.find((u) => u.id === m.unit);
    const meta = [`Unit ${m.unit}: ${unit ? unit.name : ""}`, m.type, m.source, "logged " + fmt(m.added, { month: "short", day: "numeric" })].filter(Boolean).join(", ");
    let row = "";
    if (mode === "due") {
      row = `<button type="button" class="btn tight" data-action="clean" data-id="${m.id}">Solved it cleanly</button>
        <button type="button" class="btn plain tight" data-action="again" data-id="${m.id}">Missed it again</button>
        <span class="quiet small">${m.clean ? "One clean retry so far" : "Needs two clean retries"}</span>`;
    } else if (mode === "waiting") {
      row = `<span class="quiet small">Comes back ${shortDate(m.next)}${m.clean ? ", one clean retry so far" : ""}</span>`;
    } else {
      row = `<span class="quiet small">Closed after two clean retries</span>`;
    }
    return `<li class="mistake">
      <p class="meta">${esc(meta)}</p>
      <p class="what">${esc(m.what)}</p>
      ${m.fix ? `<p class="fix"><b>Fix:</b> ${esc(m.fix)}</p>` : ""}
      <div class="row">${row}<button type="button" class="link small" data-action="remove" data-id="${m.id}">Remove</button></div>
    </li>`;
  }

  function viewMistakes() {
    const t = today();
    const open = openMistakes();
    const due = open.filter((m) => m.next <= t).sort((a, b) => a.next.localeCompare(b.next));
    const waiting = open.filter((m) => m.next > t).sort((a, b) => a.next.localeCompare(b.next));
    const closed = state.mistakes.filter((m) => m.closed);

    let lede = "Log every problem you get wrong. Each one comes back 3 days later and stays until you solve it cleanly twice in a row.";
    let split = "";
    if (state.mistakes.length >= 3) {
      const tally = Object.keys(MISTAKE_TYPES).map((k) => [k, state.mistakes.filter((m) => m.type === k).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
      const advice = {
        Concept: "Go back to the notes for those units before doing more problems.",
        Method: "Write every step out in full until the method is automatic.",
        Careless: "Slow down on the last two lines and check each answer by substituting it back.",
        Time: "Do your next sets against a clock.",
      };
      lede = `${tally[0][1]} of your ${state.mistakes.length} logged mistakes are ${tally[0][0].toLowerCase()} mistakes. ${advice[tally[0][0]]}`;
      split = `<div class="split" role="img" aria-label="${esc(tally.map((x) => x[0] + " " + x[1]).join(", "))}">${tally.map((x) => `<i style="flex:${x[1]}"></i>`).join("")}</div>
        <p class="quiet small" style="margin-top:8px">${esc(tally.map((x) => x[0] + " " + x[1]).join(", "))}</p>`;
    }

    const d = draft || {};
    const unitOptions = UNITS.map((u) => `<option value="${u.id}"${d.unit === u.id ? " selected" : ""}>${u.id}. ${esc(u.name)}</option>`).join("");
    const typeOptions = Object.keys(MISTAKE_TYPES).map((k) => `<option value="${k}">${k}: ${esc(MISTAKE_TYPES[k])}</option>`).join("");

    return `<h1 class="title">Mistakes</h1>
      <p class="lede">${esc(lede)}</p>
      ${split}

      <h2 class="section">Retry today <span class="quiet">${due.length}</span></h2>
      ${due.length ? `<ul>${due.map((m) => mistakeItem(m, "due")).join("")}</ul>` : `<p class="empty">${open.length ? "Nothing to retry today." : "No mistakes logged yet. After each session, add every problem you got wrong."}</p>`}

      <h2 class="section">Log a mistake</h2>
      <form class="log" id="log" autocomplete="off">
        <label class="field"><span>Unit</span><select name="unit" required>${unitOptions}</select></label>
        <label class="field"><span>Type</span><select name="type" required>${typeOptions}</select></label>
        <label class="field wide"><span>Where it came from</span><input name="source" maxlength="80" placeholder="Midterm Q4, Quiz 3, A6 #2" value="${esc(d.source || "")}"></label>
        <label class="field wide"><span>What went wrong</span><textarea name="what" required maxlength="600" data-key="what"></textarea></label>
        <label class="field wide"><span>The fix, in one sentence</span><input name="fix" maxlength="240"></label>
        <button class="btn wide" type="submit">Log mistake</button>
      </form>

      ${waiting.length ? `<h2 class="section">Coming back later <span class="quiet">${waiting.length}</span></h2><ul>${waiting.map((m) => mistakeItem(m, "waiting")).join("")}</ul>` : ""}
      ${closed.length ? `<details class="closed"><summary>Closed (${closed.length})</summary><ul>${closed.map((m) => mistakeItem(m, "closed")).join("")}</ul></details>` : ""}`;
  }

  // ---------- practice, mock exams, formulas ----------

  let draft = null;            // unit and source carried into the mistake form
  const shown = new Set();     // practice answers opened in this visit

  const subnav = (name) => `<nav class="sub" aria-label="Practice sections">
      ${[["practice", "Questions"], ["mocks", "Mock exams"], ["formulas", "Formulas"]].map((x) =>
        `<a href="#${x[0]}"${x[0] === name ? ' aria-current="page"' : ""}>${x[1]}</a>`).join("")}
    </nav>`;

  function solution(q) {
    return `<div class="solution">
        <p class="answer"><b>Answer:</b> ${tex(q.a)}</p>
        <ol class="steps">${q.s.map((x) => `<li>${tex(x)}</li>`).join("")}</ol>
      </div>`;
  }

  function currentUnit() {
    if (state.unit) return state.unit;
    const day = byDate[today()];
    return (day && unitOfDay(day)) || 1;
  }

  function viewPractice() {
    const u = currentUnit();
    const unit = UNITS.find((x) => x.id === u);
    const options = UNITS.map((x) => `<option value="${x.id}"${x.id === u ? " selected" : ""}>${x.id}. ${esc(x.name)} (${solvedIn(x.id)} of ${totalIn(x.id)})</option>`).join("");
    const items = QUESTIONS.filter((q) => q.unit === u).map((q, i) => {
      const st = state.practice[q.id];
      const open = shown.has(q.id);
      const src = "Practice " + u + "." + (i + 1);
      let foot;
      if (!open) {
        foot = `<button type="button" class="btn plain tight" data-action="reveal" data-id="${q.id}" data-key="rev-${q.id}">Show the answer</button>
          ${st ? `<span class="quiet small">${st === "ok" ? "Solved" : "Missed last time"}</span>` : ""}`;
      } else {
        foot = `<button type="button" class="btn tight${st === "ok" ? "" : " plain"}" data-action="mark" data-id="${q.id}" data-result="ok" data-key="ok-${q.id}" aria-pressed="${st === "ok"}">I got it</button>
          <button type="button" class="btn tight${st === "miss" ? "" : " plain"}" data-action="mark" data-id="${q.id}" data-result="miss" data-key="miss-${q.id}" aria-pressed="${st === "miss"}">I missed it</button>
          ${st === "miss" ? `<button type="button" class="link small" data-action="logfrom" data-unit="${u}" data-source="${esc(src)}">Log this mistake</button>` : ""}`;
      }
      return `<li class="question${st === "ok" ? " is-ok" : ""}">
        <p class="qhead"><span class="qn">${u}.${i + 1}</span><span class="quiet small">${plural(q.marks, "mark")}</span></p>
        <div class="qtext">${tex(q.q)}</div>
        ${open ? solution(q) : ""}
        <div class="row">${foot}</div>
      </li>`;
    }).join("");

    const more = CLP[u] ? `<p class="more small">More problems with full solutions, from the free CLP-3 textbook (UBC):
        ${CLP[u].map((x) => `<a class="link" href="${CLP_BASE + x[1]}" target="_blank" rel="noopener">${esc(x[0])}</a>`).join(", ")},
        or the <a class="link" href="${CLP_PROBLEMS}" target="_blank" rel="noopener">CLP-3 problem book</a>.</p>` : "";

    return `${subnav("practice")}
      <h1 class="title">Practice questions</h1>
      <p class="lede">Work each question on paper before you open the answer, then mark yourself honestly.</p>
      <label class="field pick"><span>Unit</span><select data-pick="unit" data-key="pick">${options}</select></label>
      <p class="quiet small unit-topics">${esc(unit.topics)}. ${esc(unit.ref)}</p>
      <ol class="questions">${items}</ol>
      ${more}
      <p class="quiet small note">These questions were written for this plan to match your course topics. They are not from your instructor, so check notation against your notes.</p>`;
  }

  function mockQuestions(run) {
    if (run.id === "mixed") return run.items.map((id) => QUESTIONS.find((q) => q.id === id)).filter(Boolean);
    return MOCKS.find((m) => m.id === run.id).questions;
  }
  const mockName = (id) => (id === "mixed" ? "Mixed set" : MOCKS.find((m) => m.id === id).name);

  function pickMixed() {
    // One question per unit: missed ones first, then unseen, then solved.
    return UNITS.map((u) => {
      const qs = QUESTIONS.filter((q) => q.unit === u.id);
      const rank = (q) => (state.practice[q.id] === "miss" ? 0 : state.practice[q.id] ? 2 : 1);
      const best = Math.min.apply(null, qs.map(rank));
      const pool = qs.filter((q) => rank(q) === best);
      return pool[Math.floor(Math.random() * pool.length)].id;
    });
  }

  function clock(run) {
    const left = Math.round((run.start + run.minutes * 60000 - Date.now()) / 1000);
    if (left <= 0) return "Time is up";
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    return (h ? h + ":" + pad(m) : m) + ":" + pad(s) + " left";
  }

  function viewMocks() {
    const run = state.run;
    if (!run) {
      const rows = MOCKS.map((m) => ({ id: m.id, name: m.name, n: m.questions.length, marks: m.questions.reduce((a, q) => a + q.marks, 0), note: "New questions you have not seen in practice" }))
        .concat([{ id: "mixed", name: "Mixed set", n: UNITS.length, marks: null, note: "One practice question per unit, choosing the ones you missed first" }])
        .map((m) => {
          const sc = state.scores[MOCK_SCORE[m.id]];
          return `<li class="mock">
            <div><h3>${m.name}</h3>
              <p class="quiet small">${m.n} questions${m.marks ? ", " + m.marks + " marks" : ""}, 2 hours. ${m.note}.${sc != null ? ` Last score: ${sc}%.` : ""}</p></div>
            <button type="button" class="btn tight${sc != null ? " plain" : ""}" data-action="startmock" data-id="${m.id}">${sc != null ? "Sit it again" : "Start " + m.name}</button>
          </li>`;
        }).join("");
      return `${subnav("mocks")}
        <h1 class="title">Mock exams</h1>
        <p class="lede">Paper, pen, no notes, phone in another room. The clock starts when you press start, and your score is saved under Progress when you finish marking.</p>
        <ul class="mocks">${rows}</ul>
        <p class="quiet small note">A past final from your instructor is always the better mock. Use these when you have none left.</p>`;
    }

    const qs = mockQuestions(run);
    const total = qs.reduce((a, q) => a + q.marks, 0);
    const name = mockName(run.id);

    if (run.phase === "run") {
      return `${subnav("mocks")}
        <div class="exam-bar"><strong>${name}</strong><span id="timer" role="timer">${clock(run)}</span></div>
        <p class="quiet small">${qs.length} questions, ${total} marks. Answer on paper. Show all of your work.</p>
        <ol class="questions exam">${qs.map((q, i) => `<li class="question">
          <p class="qhead"><span class="qn">${i + 1}</span><span class="quiet small">${plural(q.marks, "mark")}</span></p>
          <div class="qtext">${tex(q.q)}</div></li>`).join("")}</ol>
        <div class="row end">
          <button type="button" class="btn" data-action="finish">Finish and mark</button>
          <button type="button" class="link" data-action="abandon">Stop without marking</button>
        </div>`;
    }

    const got = qs.reduce((a, q, i) => a + (Number(run.marks[i]) || 0), 0);
    const pct = Math.round((100 * got) / total);

    if (run.phase === "mark") {
      return `${subnav("mocks")}
        <h1 class="title">Mark ${name}</h1>
        <p class="lede">Compare your paper with each solution and give yourself marks for the steps you got right. Be strict: an unsupported answer earns nothing on the real exam.</p>
        <ol class="questions exam">${qs.map((q, i) => `<li class="question">
          <p class="qhead"><span class="qn">${i + 1}</span><span class="quiet small">Unit ${q.unit}</span></p>
          <div class="qtext">${tex(q.q)}</div>
          ${solution(q)}
          <p class="score"><label for="mk-${i}">Your marks</label>
            <input id="mk-${i}" data-key="mk-${i}" data-mark="${i}" type="number" min="0" max="${q.marks}" step="0.5" inputmode="decimal" value="${run.marks[i] == null ? "" : run.marks[i]}"> <span>of ${q.marks}</span></p>
        </li>`).join("")}</ol>
        <div class="row end">
          <span class="tally"><strong>${got} of ${total}</strong> so far</span>
          <button type="button" class="btn" data-action="savescore">Save my score</button>
        </div>`;
    }

    const lost = qs.map((q, i) => ({ q, i, got: Number(run.marks[i]) || 0 })).filter((x) => x.got < x.q.marks);
    return `${subnav("mocks")}
      <h1 class="title">${name}: ${pct}%</h1>
      <p class="lede">${got} of ${total} marks. Saved under Progress as ${MOCK_SCORE[run.id]}.${lost.length ? " Log each question below where you lost marks, so it comes back until it is fixed." : " Full marks. Nothing to log."}</p>
      ${lost.length ? `<ul class="lost">${lost.map((x) => `<li>
          <span>Question ${x.i + 1}, Unit ${x.q.unit}: ${x.got} of ${x.q.marks}</span>
          <button type="button" class="link" data-action="logfrom" data-unit="${x.q.unit}" data-source="${esc(name + " Q" + (x.i + 1))}">Log this mistake</button>
        </li>`).join("")}</ul>` : ""}
      <div class="row end"><button type="button" class="btn plain" data-action="closemock">Back to mock exams</button></div>`;
  }

  function viewFormulas() {
    const blocks = UNITS.map((u) => `<section class="fgroup">
        <h2 class="section">${u.id}. ${esc(u.name)}</h2>
        ${FORMULAS[u.id].map((f) => `<details class="formula"><summary>${tex(f[0])}</summary><div>${tex(f[1])}</div></details>`).join("")}
      </section>`).join("");
    return `${subnav("formulas")}
      <h1 class="title">Formulas</h1>
      <p class="lede">Say or write each one from memory, then open it to check.</p>
      <p class="row"><button type="button" class="btn plain tight" data-action="openall">Open all</button>
        <button type="button" class="btn plain tight" data-action="closeall">Close all</button></p>
      ${blocks}`;
  }

  // ---------- render ----------

  const VIEWS = { today: viewToday, plan: viewPlan, practice: viewPractice, mocks: viewMocks, formulas: viewFormulas, progress: viewProgress, mistakes: viewMistakes };
  const TAB = { mocks: "practice", formulas: "practice" };
  const view = document.getElementById("view");
  const current = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "today"; };

  function render(keepKey) {
    const name = current();
    view.innerHTML = VIEWS[name]();
    document.querySelectorAll(".top nav a").forEach((a) => {
      if (a.dataset.view === (TAB[name] || name)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const left = diff(EXAM_DATE, today());
    document.getElementById("countdown").textContent = left > 0 ? plural(left, "day") + " left" : left === 0 ? "is today" : "";
    const due = dueMistakes().length;
    document.getElementById("due-badge").textContent = due ? due : "";
    if (name === "mistakes" && draft) { draft = null; keepKey = "what"; }
    if (keepKey) { const el = view.querySelector(`[data-key="${keepKey}"]`); if (el) el.focus(); }
  }

  // ---------- actions ----------

  view.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT") return;
    const a = el.dataset.action, t = today();
    if (a === "openall" || a === "closeall") { view.querySelectorAll("details.formula").forEach((d) => { d.open = a === "openall"; }); return; }
    if (a === "logfrom") { draft = { unit: Number(el.dataset.unit), source: el.dataset.source }; location.hash = "#mistakes"; return; }
    if (a === "gounit") { state.unit = Number(el.dataset.unit); save(); location.hash = "#practice"; return; }
    if (a === "reveal") shown.add(el.dataset.id);
    if (a === "mark") { const id = el.dataset.id; if (state.practice[id] === el.dataset.result) delete state.practice[id]; else state.practice[id] = el.dataset.result; }
    if (a === "startmock") {
      const id = el.dataset.id;
      state.run = { id, start: Date.now(), minutes: 120, phase: "run", marks: {}, items: id === "mixed" ? pickMixed() : null };
      save(); render(); window.scrollTo(0, 0); return;
    }
    if (a === "finish") { state.run.phase = "mark"; save(); render(); window.scrollTo(0, 0); return; }
    if (a === "abandon") { if (!confirm("Stop this mock exam? Nothing will be saved.")) return; state.run = null; save(); render(); window.scrollTo(0, 0); return; }
    if (a === "savescore") {
      const qs = mockQuestions(state.run);
      const blankOnes = qs.filter((q, i) => state.run.marks[i] == null).length;
      if (blankOnes && !confirm(plural(blankOnes, "question") + " without marks will count as zero. Save anyway?")) return;
      const total = qs.reduce((x, q) => x + q.marks, 0), got = qs.reduce((x, q, i) => x + (Number(state.run.marks[i]) || 0), 0);
      state.scores[MOCK_SCORE[state.run.id]] = Math.round((100 * got) / total);
      state.run.phase = "done"; save(); render(); window.scrollTo(0, 0); return;
    }
    if (a === "closemock") { state.run = null; save(); render(); window.scrollTo(0, 0); return; }
    if (a === "pick") selected = el.dataset.date === t ? null : el.dataset.date;
    if (a === "toggle") { const d = el.dataset.date; if (state.done[d]) delete state.done[d]; else state.done[d] = true; }
    if (a === "rate") { const u = el.dataset.unit, r = el.dataset.rating; if (state.units[u] === r) delete state.units[u]; else state.units[u] = r; }
    const m = el.dataset.id ? state.mistakes.find((x) => String(x.id) === el.dataset.id) : null;
    if (a === "clean" && m) { m.clean = (m.clean || 0) + 1; if (m.clean >= 2) m.closed = true; else m.next = addDays(t, 4); }
    if (a === "again" && m) { m.clean = 0; m.next = addDays(t, 3); }
    if (a === "remove" && m) { if (!confirm("Remove this mistake from the log?")) return; state.mistakes = state.mistakes.filter((x) => x !== m); }
    save();
    render(el.dataset.key);
  });

  view.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.action === "toggle") {
      if (el.checked) state.done[el.dataset.date] = true; else delete state.done[el.dataset.date];
      save(); render(el.dataset.key);
    }
    if (el.dataset.pick === "unit") { state.unit = Number(el.value); save(); render(el.dataset.key); }
    if (el.dataset.mark != null && state.run) {
      const i = Number(el.dataset.mark), max = Number(el.max);
      if (el.value === "") delete state.run.marks[i];
      else { state.run.marks[i] = Math.max(0, Math.min(max, Math.round(Number(el.value) * 2) / 2)); el.value = state.run.marks[i]; }
      save();
      // Update the running total in place so tabbing through the marks is not interrupted.
      const qs = mockQuestions(state.run), tally = view.querySelector(".tally strong");
      if (tally) tally.textContent = qs.reduce((x, q, k) => x + (Number(state.run.marks[k]) || 0), 0) + " of " + qs.reduce((x, q) => x + q.marks, 0);
    }
    if (el.dataset.score) {
      const n = el.value === "" ? null : Math.max(0, Math.min(100, Math.round(Number(el.value))));
      if (n == null || isNaN(n)) delete state.scores[el.dataset.score]; else state.scores[el.dataset.score] = n;
      save(); render(el.dataset.key);
    }
  });

  view.addEventListener("submit", (e) => {
    if (e.target.id !== "log") return;
    e.preventDefault();
    const f = new FormData(e.target), t = today();
    const what = String(f.get("what") || "").trim();
    if (!what) return;
    state.mistakes.push({
      id: state.seq++, unit: Number(f.get("unit")), type: String(f.get("type")),
      source: String(f.get("source") || "").trim(), what, fix: String(f.get("fix") || "").trim(),
      added: t, next: addDays(t, 3), clean: 0, closed: false,
    });
    save(); render();
  });

  // ---------- backup ----------

  document.getElementById("export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "math156-prep-" + today() + ".json" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const fileInput = document.getElementById("import-file");
  document.getElementById("import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    file.text().then((txt) => {
      let data;
      try { data = JSON.parse(txt); } catch (e) { data = null; }
      if (!data || typeof data.done !== "object" || !Array.isArray(data.mistakes)) { alert("That file is not a backup from this site."); return; }
      if (!confirm("Restore this backup? It replaces the progress saved in this browser.")) return;
      state = Object.assign(blank(), data); save(); render();
    }).finally(() => { fileInput.value = ""; });
  });

  // ---------- start ----------

  document.getElementById("rules").innerHTML = RULES.map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("");
  setInterval(() => {
    const t = document.getElementById("timer");
    if (t && state.run && state.run.phase === "run") t.textContent = clock(state.run);
  }, 1000);
  window.addEventListener("hashchange", () => { selected = null; render(); window.scrollTo(0, 0); });
  render();
})();
