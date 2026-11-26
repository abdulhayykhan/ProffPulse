// ProffPulse — Interactive 1st-Year MBBS MCQ Arena

const MODULE_META = {
  foundation: { icon: "🧬", color: "#38bdf8", sub: "Cell · Enzymes · General" },
  blood: { icon: "🩸", color: "#fb7185", sub: "Heme · RBCs · Immunity" },
  locomotion: { icon: "🦴", color: "#f59e0b", sub: "Limbs · Muscle · Bone" },
  respiration: { icon: "🫁", color: "#34d399", sub: "Thorax · ABGs · Lungs" },
  cvs: { icon: "🫀", color: "#a78bfa", sub: "Heart · ECG · Lipids" },
  islamiat: { icon: "🕌", color: "#fbbf24", sub: "Quran · Seerah · Hadith" },
};

const MISTAKES_KEY = "proffpulse-mistakes";
const STATS_KEY = "proffpulse-stats";
const HISTORY_KEY = "proffpulse-history";
const ACTIVE_SESSION_KEY = "proffpulse-active-session";
const CONFIG_KEY = "proffpulse-config";
const LO_DONE_KEY = "proffpulse-lo-done";
const THEME_KEY = "proffpulse-theme";
const SOUND_KEY = "proffpulse-sound";

const SEED_QUESTIONS = [
  {
    id: "seed-1",
    module: "foundation",
    subject: "Anatomy",
    topic: "General concept of joints",
    source: "Past Bank",
    stem: "A 22-year-old athlete sustains an injury to the knee joint. Which structural feature is characteristic of all synovial joints?",
    options: [
      "Hyaline cartilage covering the articular surfaces",
      "Fibrocartilage uniting the bones directly",
      "Absence of a joint cavity",
      "Interosseous membrane between shafts",
    ],
    correctIndex: 0,
    concept: "Synovial joints possess a fluid-filled joint cavity, fibrous capsule lined by synovial membrane, and articular surfaces typically covered by hyaline cartilage.",
    distractors: [
      "B: Fibrocartilage uniting bones directly describes symphyses (secondary cartilaginous joints).",
      "C: Synovial joints always have a joint cavity; fibrous and cartilaginous joints lack one.",
      "D: Interosseous membranes are syndesmoses (fibrous joints), not synovial joints.",
    ],
    loRef: "JSMU Foundation · Anatomy LO: List the features of synovial joint",
  },
];

const state = {
  syllabus: null,
  soundEnabled: true,
  audioCtx: null,
  config: {
    moduleId: "",
    subjectId: "all",
    topicId: "all",
    topicQuery: "",
    source: "mixed",
    mode: "practice",
    length: 10,
  },
  loExplorer: {
    moduleId: "all",
    subjectId: "all",
    status: "all",
    query: "",
  },
  session: {
    questions: [],
    currentIndex: 0,
    answers: [],
    flagged: [],
    streak: 0,
    bestStreak: 0,
    timerSeconds: 0,
    timerId: null,
    questionStartMs: 0,
    timingsMs: [],
    isRetry: false,
    retryTopics: [],
  },
};

const $ = (id) => document.getElementById(id);

// --- Initialization ---
async function init() {
  initTheme();
  initSound();
  restoreSavedConfig();
  renderMomentumStats();
  renderSessionHistory();
  refreshSavedMistakesUI();
  refreshResumeBanner();
  bindConfigEvents();
  bindArenaEvents();
  bindVerdictEvents();
  await Promise.all([loadSyllabus(), loadHealth()]);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  $("theme-icon").textContent = saved === "light" ? "🌙" : "☀️";
  $("theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    $("theme-icon").textContent = next === "light" ? "🌙" : "☀️";
  });
}

function initSound() {
  const saved = localStorage.getItem(SOUND_KEY);
  state.soundEnabled = saved === null ? true : saved === "true";
  $("sound-icon").textContent = state.soundEnabled ? "🔊" : "🔇";
  $("sound-toggle").addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem(SOUND_KEY, String(state.soundEnabled));
    $("sound-icon").textContent = state.soundEnabled ? "🔊" : "🔇";
    if (state.soundEnabled) playTone("click");
  });
}

function playTone(type) {
  if (!state.soundEnabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!state.audioCtx) state.audioCtx = new Ctx();
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.11);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === "wrong") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2600);
}

// --- Local Persistence ---
function loadSavedMistakes() {
  try {
    const raw = localStorage.getItem(MISTAKES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMistakes(list) {
  try {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // Ignore quota error
  }
  refreshSavedMistakesUI();
}

function refreshSavedMistakesUI() {
  const saved = loadSavedMistakes();
  const btn = $("saved-mistakes-btn");
  const countEl = $("saved-mistakes-count");
  if (!btn || !countEl) return;
  countEl.textContent = String(saved.length);
  btn.classList.toggle("hidden", saved.length === 0);
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      totalSolved: parsed.totalSolved || 0,
      totalCorrect: parsed.totalCorrect || 0,
      bestStreak: parsed.bestStreak || 0,
      moduleProgress: parsed.moduleProgress || {},
      questionResults: parsed.questionResults || {},
    };
  } catch {
    return { totalSolved: 0, totalCorrect: 0, bestStreak: 0, moduleProgress: {}, questionResults: {} };
  }
}

function recordSessionStats(questions, answers, sessionBestStreak) {
  const stats = loadStats();
  if (!stats.questionResults || typeof stats.questionResults !== "object") {
    stats.questionResults = {};
  }

  // Deduplicate by unique question id so retrying wrong MCQs updates outcome instead of double-counting
  questions.forEach((q, i) => {
    if (answers[i] === null || answers[i] === undefined) return;
    const modId = q.module || state.config.moduleId || "foundation";
    const qId = q.id || `${modId}-${q.topic}-${q.stem.slice(0, 32)}`;
    stats.questionResults[qId] = { m: modId, ok: answers[i] === q.correctIndex };
  });

  const entries = Object.values(stats.questionResults);
  const modMap = {};
  let totalCorrect = 0;
  entries.forEach((rec) => {
    if (!modMap[rec.m]) modMap[rec.m] = { solved: 0, correct: 0 };
    modMap[rec.m].solved++;
    if (rec.ok) {
      modMap[rec.m].correct++;
      totalCorrect++;
    }
  });

  stats.totalSolved = entries.length;
  stats.totalCorrect = totalCorrect;
  stats.moduleProgress = modMap;
  stats.bestStreak = Math.max(stats.bestStreak, sessionBestStreak);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore
  }
  renderMomentumStats();
  if (state.syllabus) renderModuleCards();
}

function renderMomentumStats() {
  const stats = loadStats();
  const acc = stats.totalSolved ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;
  $("total-solved-badge").textContent = `✓ ${stats.totalSolved} solved`;
  $("overall-acc-badge").textContent = `🎯 ${acc}%`;
  $("best-streak-badge").textContent = `🔥 ${stats.bestStreak} best`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSessionHistory(entry) {
  const list = [entry, ...loadHistory()].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
  renderSessionHistory();
}

function renderSessionHistory() {
  const list = loadHistory();
  $("history-count-badge").textContent = `${list.length} session${list.length === 1 ? "" : "s"}`;
  const container = $("session-history-list");
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<div class="history-row"><span>No completed sessions yet — solve a quiz and your progress saves here automatically.</span></div>`;
    return;
  }
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const dateStr = new Date(item.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    row.innerHTML = `
      <div>
        <div><strong>${escapeHtml(item.moduleName)}</strong> · ${item.mode === "exam" ? "Exam" : "Practice"}</div>
        <div class="history-meta">${dateStr} · ${item.avgSec}s / Q</div>
      </div>
      <div class="history-score">${item.correct}/${item.total} (${item.accuracy}%)</div>
    `;
    container.appendChild(row);
  });
}

function saveConfigPrefs() {
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        moduleId: state.config.moduleId,
        source: state.config.source,
        mode: state.config.mode,
        length: state.config.length,
      })
    );
  } catch {
    // Ignore
  }
}

function restoreSavedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.moduleId) state.config.moduleId = saved.moduleId;
    if (saved.source) {
      state.config.source = saved.source;
      $("source-group").querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.value === saved.source);
      });
    }
    if (saved.mode) {
      state.config.mode = saved.mode;
      $("mode-group").querySelectorAll(".mode-card").forEach((b) => {
        b.classList.toggle("active", b.dataset.value === saved.mode);
      });
    }
    if (saved.length) {
      state.config.length = Number(saved.length);
      $("length-group").querySelectorAll(".pill").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.value) === state.config.length);
      });
    }
  } catch {
    // Ignore
  }
}

function saveActiveSession() {
  if (!state.session.questions.length) return;
  try {
    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({
        mode: state.config.mode,
        moduleId: state.config.moduleId,
        questions: state.session.questions,
        currentIndex: state.session.currentIndex,
        answers: state.session.answers,
        flagged: state.session.flagged,
        streak: state.session.streak,
        bestStreak: state.session.bestStreak,
        timerSeconds: state.session.timerSeconds,
        timingsMs: state.session.timingsMs,
        isRetry: state.session.isRetry,
        retryTopics: state.session.retryTopics,
      })
    );
  } catch {
    // Ignore
  }
}

function clearActiveSession() {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Ignore
  }
  refreshResumeBanner();
}

function refreshResumeBanner() {
  const banner = $("resume-banner");
  if (!banner) return;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) {
      banner.classList.add("hidden");
      return;
    }
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.questions) || !saved.questions.length) {
      banner.classList.add("hidden");
      return;
    }
    const answered = (saved.answers || []).filter((a) => a !== null).length;
    const modLabel = saved.moduleId ? saved.moduleId.toUpperCase() : "QUIZ";
    $("resume-title").textContent = `Resume ${modLabel} (${saved.mode === "exam" ? "Exam Mode" : "Practice Mode"})`;
    $("resume-meta").textContent = `Question ${saved.currentIndex + 1} of ${saved.questions.length} · ${answered} answered`;
    banner.classList.remove("hidden");
  } catch {
    banner.classList.add("hidden");
  }
}

// --- Data Loading ---
async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return;
    const h = await res.json();
    const aiLabel = h.ai_configured ? "AI BCQs Ready" : "Past Bank Mode";
    $("hero-status-text").textContent = `${h.past_bank_count} Verified Past MCQs · ${h.lecture_index_count} UMDC Lecture Sources · ${aiLabel}`;
    $("ai-status-dot").style.background = h.ai_configured ? "var(--success)" : "var(--warning)";
  } catch {
    // Keep default label
  }
}

async function loadSyllabus() {
  const candidates = ["/api/syllabus", "../data/syllabus.json", "./data/syllabus.json"];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        state.syllabus = await res.json();
        break;
      }
    } catch {
      // Next fallback
    }
  }
  if (!state.syllabus) {
    $("lo-summary-text").textContent = "Could not load syllabus data";
    return;
  }
  renderModuleCards();
}

// --- Screen 1: Visual Configurator ---
function renderModuleCards() {
  const grid = $("module-grid");
  grid.innerHTML = "";
  const modules = state.syllabus.modules;
  if (!state.config.moduleId && modules.length) {
    state.config.moduleId = modules[0].id;
  }

  const stats = loadStats();
  modules.forEach((m) => {
    const meta = MODULE_META[m.id] || { icon: "📘", color: "#38bdf8", sub: "JSMU Module" };
    const topicCount = m.subjects.reduce((acc, s) => acc + s.topics.length, 0);
    const mp = stats.moduleProgress?.[m.id];
    const modAcc = mp && mp.solved ? Math.round((mp.correct / mp.solved) * 100) : 0;
    const progressHtml =
      mp && mp.solved
        ? `<div class="mod-progress-row">
             <div class="mod-progress-track"><div class="mod-progress-fill" style="width:${modAcc}%"></div></div>
             <span class="mod-progress-text">${mp.solved} Q · ${modAcc}%</span>
           </div>`
        : "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mod-card${m.id === state.config.moduleId ? " active" : ""}`;
    btn.style.setProperty("--mod-accent", meta.color);
    btn.dataset.moduleId = m.id;
    btn.innerHTML = `
      <span class="mod-icon">${meta.icon}</span>
      <div class="mod-info">
        <div class="mod-title">${m.order}. ${escapeHtml(m.name)}</div>
        <div class="mod-meta">${topicCount} topics · ${meta.sub}</div>
        ${progressHtml}
      </div>
    `;
    btn.addEventListener("click", () => {
      state.config.moduleId = m.id;
      state.config.topicQuery = "";
      $("topic-search").value = "";
      grid.querySelectorAll(".mod-card").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      saveConfigPrefs();
      playTone("click");
      renderSubjectChips();
    });
    grid.appendChild(btn);
  });

  renderSubjectChips();
}

function renderSubjectChips() {
  const mod = state.syllabus.modules.find((m) => m.id === state.config.moduleId);
  const row = $("subject-chips");
  row.innerHTML = "";

  const makeChip = (id, label, active) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${active ? " active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.config.subjectId = id;
      row.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      playTone("click");
      populateTopics();
    });
    row.appendChild(btn);
  };

  state.config.subjectId = "all";
  makeChip("all", "All Subjects", true);

  if (mod) {
    mod.subjects.forEach((s) => {
      makeChip(s.id, `${s.name} (${s.topics.length})`, false);
    });
  }
  populateTopics();
}

function populateTopics() {
  const mod = state.syllabus.modules.find((m) => m.id === state.config.moduleId);
  const sel = $("select-topic");
  const query = state.config.topicQuery.trim().toLowerCase();
  sel.innerHTML = `<option value="all">All Topics (High-Yield Mix)</option>`;

  let matchCount = 0;
  if (mod) {
    const subjects =
      state.config.subjectId === "all"
        ? mod.subjects
        : mod.subjects.filter((s) => s.id === state.config.subjectId);

    subjects.forEach((s) => {
      s.topics.forEach((t) => {
        if (query && !t.title.toLowerCase().includes(query) && !s.name.toLowerCase().includes(query)) {
          return;
        }
        matchCount++;
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = state.config.subjectId === "all" ? `[${s.name}] ${t.title}` : t.title;
        sel.appendChild(opt);
      });
    });
  }

  // If user searched and found topics, pre-select "all" or keep matching
  state.config.topicId = "all";
  sel.value = "all";
  $("topic-count-hint").textContent = query ? `${matchCount} matching topics` : `${matchCount} topics available`;
  updateLOPreview();
}

function getSelectedLOs() {
  const mod = state.syllabus?.modules.find((m) => m.id === state.config.moduleId);
  if (!mod) return [];
  const subjects =
    state.config.subjectId === "all"
      ? mod.subjects
      : mod.subjects.filter((s) => s.id === state.config.subjectId);

  const items = [];
  subjects.forEach((s) => {
    const topics =
      state.config.topicId === "all"
        ? s.topics
        : s.topics.filter((t) => t.id === state.config.topicId);
    topics.forEach((t) => {
      t.los.forEach((lo) => {
        items.push({ subject: s.name, topic: t.title, lo });
      });
    });
  });
  return items;
}

function updateLOPreview() {
  const los = getSelectedLOs();
  $("lo-summary-text").textContent = `${los.length} JSMU Learning Objectives in selection`;
}

// --- JSMU Syllabus & LO Explorer ---
function loadDoneLOs() {
  try {
    const raw = localStorage.getItem(LO_DONE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDoneLOs(set) {
  try {
    localStorage.setItem(LO_DONE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore
  }
}

function openSyllabusExplorer(preselectFromConfig = false) {
  if (!state.syllabus) return;
  if (preselectFromConfig) {
    state.loExplorer.moduleId = state.config.moduleId || "all";
    state.loExplorer.subjectId = state.config.subjectId || "all";
  } else {
    state.loExplorer.moduleId = "all";
    state.loExplorer.subjectId = "all";
  }
  state.loExplorer.query = "";
  $("lo-search-input").value = "";
  renderLOExplorerFilters();
  renderLOExplorerList();
  $("syllabus-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeSyllabusExplorer() {
  $("syllabus-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

function renderLOExplorerFilters() {
  const modRow = $("lo-mod-chips");
  modRow.innerHTML = "";

  const addModChip = (id, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `chip${state.loExplorer.moduleId === id ? " active" : ""}`;
    b.textContent = label;
    b.addEventListener("click", () => {
      state.loExplorer.moduleId = id;
      state.loExplorer.subjectId = "all";
      renderLOExplorerFilters();
      renderLOExplorerList();
    });
    modRow.appendChild(b);
  };

  addModChip("all", "All Modules");
  state.syllabus.modules.forEach((m) => addModChip(m.id, `${m.order}. ${m.name}`));

  // Subject chips available for chosen module(s)
  const subjRow = $("lo-subj-chips");
  subjRow.innerHTML = "";
  const subjSet = new Set();
  state.syllabus.modules
    .filter((m) => state.loExplorer.moduleId === "all" || m.id === state.loExplorer.moduleId)
    .forEach((m) => m.subjects.forEach((s) => subjSet.add(s.name)));

  const addSubjChip = (id, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `chip${state.loExplorer.subjectId === id ? " active" : ""}`;
    b.textContent = label;
    b.addEventListener("click", () => {
      state.loExplorer.subjectId = id;
      renderLOExplorerFilters();
      renderLOExplorerList();
    });
    subjRow.appendChild(b);
  };

  addSubjChip("all", "All Subjects");
  ["Anatomy", "Histology", "Embryology", "Physiology", "Biochemistry", "Islamiat"].forEach((sName) => {
    if (subjSet.has(sName)) addSubjChip(sName.toLowerCase(), sName);
  });
}

function highlightQuery(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${esc})`, "gi"), '<mark class="lo-mark">$1</mark>');
}

function renderLOExplorerList() {
  const body = $("lo-explorer-body");
  body.innerHTML = "";
  const doneSet = loadDoneLOs();
  const q = state.loExplorer.query.trim().toLowerCase();

  let totalAll = 0;
  let masteredAll = 0;
  let visibleTopics = 0;
  let visibleLOs = 0;

  state.syllabus.modules.forEach((m) => {
    m.subjects.forEach((s) => {
      s.topics.forEach((t) => {
        t.los.forEach((_, idx) => {
          totalAll++;
          if (doneSet.has(`${t.id}::${idx}`)) masteredAll++;
        });
      });
    });
  });

  const modules = state.syllabus.modules.filter(
    (m) => state.loExplorer.moduleId === "all" || m.id === state.loExplorer.moduleId
  );

  modules.forEach((m) => {
    m.subjects
      .filter((s) => state.loExplorer.subjectId === "all" || s.id === state.loExplorer.subjectId)
      .forEach((s) => {
        s.topics.forEach((t) => {
          const titleMatches = q && (t.title.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
          const matchingLOs = t.los
            .map((lo, idx) => ({ lo, idx, key: `${t.id}::${idx}`, isDone: doneSet.has(`${t.id}::${idx}`) }))
            .filter((item) => {
              if (state.loExplorer.status === "done" && !item.isDone) return false;
              if (state.loExplorer.status === "pending" && item.isDone) return false;
              if (q && !titleMatches && !item.lo.toLowerCase().includes(q)) return false;
              return true;
            });

          if (!matchingLOs.length) return;
          visibleTopics++;
          visibleLOs += matchingLOs.length;

          const card = document.createElement("div");
          card.className = "lo-topic-card";

          const head = document.createElement("div");
          head.className = "lo-topic-head";
          head.innerHTML = `
            <div class="lo-topic-title-wrap">
              <span class="badge">${escapeHtml(m.name)} · ${escapeHtml(s.name)}</span>
              <span class="lo-topic-title">${highlightQuery(t.title, q)}</span>
              <span class="lo-topic-count">${matchingLOs.length} LOs</span>
            </div>
          `;

          const practiceBtn = document.createElement("button");
          practiceBtn.type = "button";
          practiceBtn.className = "btn btn-secondary btn-sm";
          practiceBtn.textContent = "Practice Topic →";
          practiceBtn.addEventListener("click", async () => {
            closeSyllabusExplorer();
            state.config.moduleId = m.id;
            renderModuleCards();
            state.config.subjectId = s.id;
            $("subject-chips").querySelectorAll(".chip").forEach((c) => {
              c.classList.toggle("active", c.textContent.toLowerCase().startsWith(s.name.toLowerCase()));
            });
            populateTopics();
            state.config.topicId = t.id;
            $("select-topic").value = t.id;
            updateLOPreview();
            await launchConfiguredQuiz();
          });
          head.appendChild(practiceBtn);
          card.appendChild(head);

          const itemsDiv = document.createElement("div");
          itemsDiv.className = "lo-items";
          matchingLOs.forEach((item) => {
            const label = document.createElement("label");
            label.className = `lo-check-row${item.isDone ? " is-done" : ""}`;
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = item.isDone;
            cb.addEventListener("change", () => {
              const latest = loadDoneLOs();
              if (cb.checked) latest.add(item.key);
              else latest.delete(item.key);
              saveDoneLOs(latest);
              label.classList.toggle("is-done", cb.checked);
              updateLOExplorerHeaderStats();
            });
            const span = document.createElement("span");
            span.innerHTML = highlightQuery(item.lo, q);
            label.appendChild(cb);
            label.appendChild(span);
            itemsDiv.appendChild(label);
          });

          card.appendChild(itemsDiv);
          body.appendChild(card);
        });
      });
  });

  if (visibleTopics === 0) {
    body.innerHTML = `<div class="lo-topic-card"><p class="subtitle">No Learning Objectives match your current filter. Try clearing the search or switching status.</p></div>`;
  }

  $("lo-explorer-stats").textContent = `${masteredAll} / ${totalAll} objectives mastered · Showing ${visibleLOs} LOs across ${visibleTopics} topics`;
}

function updateLOExplorerHeaderStats() {
  const doneSet = loadDoneLOs();
  let totalAll = 0;
  let masteredAll = 0;
  state.syllabus.modules.forEach((m) =>
    m.subjects.forEach((s) =>
      s.topics.forEach((t) =>
        t.los.forEach((_, idx) => {
          totalAll++;
          if (doneSet.has(`${t.id}::${idx}`)) masteredAll++;
        })
      )
    )
  );
  const current = $("lo-explorer-stats").textContent.split("·")[1] || "";
  $("lo-explorer-stats").textContent = `${masteredAll} / ${totalAll} objectives mastered ·${current}`;
}

function bindConfigEvents() {
  $("brand-home").addEventListener("click", () => {
    stopTimer();
    saveActiveSession();
    refreshResumeBanner();
    showScreen("screen-config");
  });

  $("momentum-pill").addEventListener("click", () => {
    showScreen("screen-config");
    const drawer = $("progress-drawer");
    drawer.open = true;
    drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("resume-btn").addEventListener("click", () => {
    try {
      const saved = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || "null");
      if (!saved || !Array.isArray(saved.questions) || !saved.questions.length) return;
      stopTimer();
      state.config.mode = saved.mode || "practice";
      if (saved.moduleId) state.config.moduleId = saved.moduleId;
      state.session = {
        questions: saved.questions,
        currentIndex: saved.currentIndex || 0,
        answers: saved.answers || new Array(saved.questions.length).fill(null),
        flagged: saved.flagged || new Array(saved.questions.length).fill(false),
        streak: saved.streak || 0,
        bestStreak: saved.bestStreak || 0,
        timerSeconds: saved.timerSeconds || 0,
        timerId: null,
        questionStartMs: Date.now(),
        timingsMs: saved.timingsMs || [],
        isRetry: Boolean(saved.isRetry),
        retryTopics: saved.retryTopics || [],
      };
      showScreen("screen-arena");
      renderQuestionDots();
      renderQuestion();
      startTimer();
    } catch {
      clearActiveSession();
    }
  });

  $("discard-resume-btn").addEventListener("click", () => {
    clearActiveSession();
    showToast("Saved quiz discarded");
  });

  $("open-syllabus-btn").addEventListener("click", () => openSyllabusExplorer(false));
  $("open-syllabus-from-config").addEventListener("click", () => openSyllabusExplorer(true));
  $("close-syllabus-btn").addEventListener("click", closeSyllabusExplorer);
  $("syllabus-modal").addEventListener("click", (e) => {
    if (e.target === $("syllabus-modal")) closeSyllabusExplorer();
  });
  $("lo-search-input").addEventListener("input", (e) => {
    state.loExplorer.query = e.target.value;
    renderLOExplorerList();
  });
  bindGroup("lo-status-group", ".seg-btn", (val) => {
    state.loExplorer.status = val;
    renderLOExplorerList();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("syllabus-modal").classList.contains("hidden")) {
      closeSyllabusExplorer();
    }
  });

  $("export-progress-btn").addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      stats: loadStats(),
      history: loadHistory(),
      mistakes: loadSavedMistakes(),
      loDone: [...loadDoneLOs()],
      config: state.config,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proffpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Progress backup downloaded");
  });

  $("import-progress-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.stats) localStorage.setItem(STATS_KEY, JSON.stringify(data.stats));
      if (data.history) localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
      if (data.mistakes) localStorage.setItem(MISTAKES_KEY, JSON.stringify(data.mistakes));
      if (Array.isArray(data.loDone)) localStorage.setItem(LO_DONE_KEY, JSON.stringify(data.loDone));
      renderMomentumStats();
      renderSessionHistory();
      refreshSavedMistakesUI();
      if (state.syllabus) renderModuleCards();
      showToast("Progress restored successfully!");
    } catch {
      showToast("Invalid backup JSON file");
    }
    e.target.value = "";
  });

  $("reset-progress-btn").addEventListener("click", () => {
    if (!confirm("Reset all saved stats, mistakes, and session history in this browser?")) return;
    [MISTAKES_KEY, STATS_KEY, HISTORY_KEY, ACTIVE_SESSION_KEY, LO_DONE_KEY].forEach((k) => localStorage.removeItem(k));
    renderMomentumStats();
    renderSessionHistory();
    refreshSavedMistakesUI();
    refreshResumeBanner();
    if (state.syllabus) renderModuleCards();
    showToast("Browser progress cleared");
  });

  $("topic-search").addEventListener("input", (e) => {
    state.config.topicQuery = e.target.value;
    populateTopics();
  });

  $("select-topic").addEventListener("change", (e) => {
    state.config.topicId = e.target.value;
    updateLOPreview();
  });

  bindGroup("source-group", ".seg-btn", (val) => {
    state.config.source = val;
    saveConfigPrefs();
    playTone("click");
  });

  bindGroup("mode-group", ".mode-card", (val) => {
    state.config.mode = val;
    saveConfigPrefs();
    playTone("click");
  });

  bindGroup("length-group", ".pill", (val) => {
    state.config.length = Number(val);
    saveConfigPrefs();
    playTone("click");
  });

  $("saved-mistakes-btn").addEventListener("click", () => {
    const saved = loadSavedMistakes();
    if (saved.length > 0) {
      const slice = saved.slice(0, state.config.length);
      const topics = [...new Set(slice.map((q) => q.topic).filter(Boolean))];
      startSession(slice, "practice", { isRetry: true, retryTopics: topics });
    }
  });

  $("config-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await launchConfiguredQuiz();
  });

  document.addEventListener("keydown", (e) => {
    if ($("screen-config").classList.contains("active") && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      launchConfiguredQuiz();
    }
  });
}

async function launchConfiguredQuiz() {
  const btn = $("start-btn");
  btn.disabled = true;
  btn.innerHTML =
    state.config.source === "ai" || state.config.source === "mixed"
      ? "Generating &amp; Loading…"
      : "Loading MCQs…";
  try {
    const questions = await fetchSessionQuestions(state.config);
    startSession(questions, state.config.mode);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Start Quiz <span class="arrow" aria-hidden="true">→</span>';
  }
}

function bindGroup(containerId, selector, onSelect) {
  const container = $(containerId);
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(selector);
    if (!btn) return;
    container.querySelectorAll(selector).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    onSelect(btn.dataset.value);
  });
}

async function fetchSessionQuestions(cfg) {
  const params = new URLSearchParams({
    module: cfg.moduleId,
    subject: cfg.subjectId,
    topic: cfg.topicId,
    source: cfg.source,
    limit: String(cfg.length),
  });
  try {
    const res = await fetch(`/api/questions?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (cfg.source === "ai" && data.ai_used > 0) {
        showToast(`✨ Generated ${data.ai_used} fresh UMDC-grounded BCQs`);
      } else if (cfg.source === "ai" && !data.ai_configured) {
        showToast("AI keys not configured — loaded Past Bank instead");
      }
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch {
    // Fallback below
  }
  return buildSessionQuestions(cfg);
}

function buildSessionQuestions(cfg, overrideTopics = null) {
  const mod = state.syllabus?.modules.find((m) => m.id === cfg.moduleId);
  const los = getSelectedLOs();
  const filteredLOs = overrideTopics ? los.filter((i) => overrideTopics.includes(i.topic)) : los;
  const poolLOs = filteredLOs.length ? filteredLOs : los;

  const questions = SEED_QUESTIONS.filter((q) => q.module === cfg.moduleId);
  let idx = 0;
  while (questions.length < cfg.length && poolLOs.length > 0) {
    const item = poolLOs[idx % poolLOs.length];
    questions.push({
      id: `lo-preview-${idx + 1}`,
      module: cfg.moduleId,
      subject: item.subject,
      topic: item.topic,
      source: "Past Bank",
      stem: `[${mod?.name || cfg.moduleId} · ${item.subject}] Syllabus-locked check for "${item.topic}": Which statement best aligns with "${item.lo}"?`,
      options: [
        `Primary mechanism & clinical correlation of ${item.lo}`,
        `Unrelated artifact outside ${item.topic}`,
        `Contradictory finding not seen in ${item.subject}`,
        `Out-of-syllabus pathology from later clinical years`,
      ],
      correctIndex: 0,
      concept: `Mapped directly to JSMU LO: "${item.lo}".`,
      distractors: [],
      loRef: `JSMU ${mod?.name || ""} · ${item.subject}`,
    });
    idx++;
  }
  return questions.slice(0, cfg.length);
}

function shuffleQuestionOptions(q) {
  if (!Array.isArray(q.options) || q.options.length !== 4) return q;
  const perm = [0, 1, 2, 3];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const letters = ["A", "B", "C", "D"];
  const oldToNew = {};
  perm.forEach((oldIdx, newIdx) => {
    oldToNew[letters[oldIdx]] = letters[newIdx];
  });
  const distractors = (q.distractors || []).map((d) => {
    const m = String(d).trim().match(/^([A-D])\s*[:.)\-]\s*(.+)$/i);
    if (!m) return d;
    const newL = oldToNew[m[1].toUpperCase()] || m[1].toUpperCase();
    return `${newL}: ${m[2].trim()}`;
  });
  distractors.sort((a, b) => (a[0] || "Z").localeCompare(b[0] || "Z"));
  return {
    ...q,
    options: perm.map((i) => q.options[i]),
    correctIndex: perm.indexOf(q.correctIndex),
    distractors,
  };
}

// --- Screen 2: Interactive Quiz Arena ---
function startSession(questions, mode, opts = {}) {
  stopTimer();
  const shuffled = questions.map(shuffleQuestionOptions);
  state.config.mode = mode;
  state.session = {
    questions: shuffled,
    currentIndex: 0,
    answers: new Array(shuffled.length).fill(null),
    flagged: new Array(shuffled.length).fill(false),
    streak: 0,
    bestStreak: 0,
    timerSeconds: mode === "exam" ? shuffled.length * 60 : 0,
    timerId: null,
    questionStartMs: Date.now(),
    timingsMs: [],
    isRetry: Boolean(opts.isRetry),
    retryTopics: opts.retryTopics || [],
  };

  showScreen("screen-arena");
  renderQuestionDots();
  renderQuestion();
  saveActiveSession();
  startTimer();
}

function startTimer() {
  updateTimerDisplay();
  state.session.timerId = setInterval(() => {
    if (state.config.mode === "exam") {
      state.session.timerSeconds--;
      if (state.session.timerSeconds <= 0) {
        state.session.timerSeconds = 0;
        updateTimerDisplay();
        finishSession();
        return;
      }
    } else {
      state.session.timerSeconds++;
    }
    if (state.session.timerSeconds % 5 === 0) {
      saveActiveSession();
    }
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.session.timerId) {
    clearInterval(state.session.timerId);
    state.session.timerId = null;
  }
}

function updateTimerDisplay() {
  const s = state.session.timerSeconds;
  const mins = String(Math.floor(s / 60)).padStart(2, "0");
  const secs = String(s % 60).padStart(2, "0");
  const el = $("hud-timer");
  el.textContent = `${mins}:${secs}`;
  el.classList.toggle("urgent", state.config.mode === "exam" && s <= 60);
}

function renderQuestionDots() {
  const container = $("q-dots");
  container.innerHTML = "";
  const { questions, currentIndex, answers, flagged } = state.session;
  questions.forEach((q, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "q-dot";
    dot.title = `Question ${i + 1}`;
    if (i === currentIndex) dot.classList.add("current");
    else if (answers[i] !== null) {
      if (state.config.mode === "practice") {
        dot.classList.add(answers[i] === q.correctIndex ? "correct" : "wrong");
      } else {
        dot.classList.add("answered");
      }
    }
    if (flagged[i]) dot.classList.add("flagged");

    dot.addEventListener("click", () => {
      if (state.config.mode === "exam" || answers[i] !== null || i === currentIndex) {
        state.session.currentIndex = i;
        renderQuestion();
      }
    });
    container.appendChild(dot);
  });
}

function renderQuestion() {
  const { questions, currentIndex, answers, flagged, streak } = state.session;
  const q = questions[currentIndex];
  const total = questions.length;
  const answeredCount = answers.filter((a) => a !== null).length;

  $("hud-counter").textContent = `${currentIndex + 1} / ${total}`;
  $("hud-streak").textContent = `🔥 ${streak}`;
  const pct = Math.round((answeredCount / total) * 100);
  $("progress-fill").style.width = `${pct}%`;
  $("progress-track").setAttribute("aria-valuenow", String(pct));

  $("q-subject-badge").textContent = q.subject;
  const srcBadge = $("q-source-badge");
  srcBadge.textContent = q.source;
  srcBadge.classList.toggle("ai", String(q.source).includes("AI"));
  $("q-topic-label").textContent = q.topic;
  $("q-stem").textContent = q.stem;

  const isFlagged = Boolean(flagged[currentIndex]);
  $("flag-btn").classList.toggle("flagged", isFlagged);
  $("flag-label").textContent = isFlagged ? "Flagged" : "Flag";

  const list = $("options-list");
  list.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  const picked = answers[currentIndex];

  q.options.forEach((optText, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.dataset.index = String(i);
    let badgeChar = letters[i];

    if (picked !== null) {
      if (state.config.mode === "practice") {
        btn.disabled = true;
        if (i === q.correctIndex) {
          btn.classList.add("correct");
          badgeChar = "✓";
        } else if (i === picked) {
          btn.classList.add("wrong");
          badgeChar = "✕";
        }
      } else if (i === picked) {
        btn.classList.add("selected");
      }
    }

    btn.innerHTML = `<span class="option-key">${badgeChar}</span><span>${escapeHtml(optText)}</span>`;
    btn.addEventListener("click", () => selectOption(i));
    list.appendChild(btn);
  });

  if (state.config.mode === "practice" && picked !== null) {
    showWhyCard(q, picked === q.correctIndex);
  } else {
    $("why-card").classList.add("hidden");
  }

  const prevBtn = $("prev-btn");
  prevBtn.classList.toggle("hidden", state.config.mode !== "exam");
  prevBtn.disabled = currentIndex === 0;

  $("next-btn").disabled = picked === null && state.config.mode === "practice";
  $("next-btn").textContent = currentIndex === total - 1 ? "Finish Session →" : "Next Question →";

  renderQuestionDots();
  state.session.questionStartMs = Date.now();
}

function selectOption(chosenIdx) {
  const { questions, currentIndex, answers } = state.session;
  const q = questions[currentIndex];

  if (state.config.mode === "practice" && answers[currentIndex] !== null) {
    return;
  }

  state.session.timingsMs[currentIndex] = Date.now() - state.session.questionStartMs;
  answers[currentIndex] = chosenIdx;

  const buttons = $("options-list").querySelectorAll(".option-btn");

  if (state.config.mode === "practice") {
    const isCorrect = chosenIdx === q.correctIndex;
    if (isCorrect) {
      state.session.streak++;
      state.session.bestStreak = Math.max(state.session.bestStreak, state.session.streak);
      playTone("correct");
      const streakEl = $("hud-streak");
      streakEl.classList.remove("pop");
      void streakEl.offsetWidth;
      streakEl.classList.add("pop");
    } else {
      state.session.streak = 0;
      playTone("wrong");
    }
    $("hud-streak").textContent = `🔥 ${state.session.streak}`;

    buttons.forEach((b, i) => {
      b.disabled = true;
      const keyEl = b.querySelector(".option-key");
      if (i === q.correctIndex) {
        b.classList.add("correct");
        keyEl.textContent = "✓";
      } else if (i === chosenIdx) {
        b.classList.add("wrong");
        keyEl.textContent = "✕";
      }
    });

    showWhyCard(q, isCorrect);
  } else {
    playTone("click");
    buttons.forEach((b, i) => b.classList.toggle("selected", i === chosenIdx));
  }

  const answeredCount = answers.filter((a) => a !== null).length;
  const pct = Math.round((answeredCount / questions.length) * 100);
  $("progress-fill").style.width = `${pct}%`;

  $("next-btn").disabled = false;
  renderQuestionDots();
  saveActiveSession();
}

function showWhyCard(q, isCorrect) {
  const card = $("why-card");
  card.classList.remove("correct-state", "wrong-state");
  card.classList.add(isCorrect ? "correct-state" : "wrong-state");

  $("why-verdict").textContent = isCorrect ? "✓ Spot On · Core Concept" : "✕ Missed · Lock This Concept";
  $("why-ref").textContent = q.loRef || "";

  const fullConcept = q.concept || "";
  const trickMarker = "— Memory trick:";
  const trickEl = $("why-trick");
  if (fullConcept.includes(trickMarker)) {
    const [mainPart, trickPart] = fullConcept.split(trickMarker);
    $("why-concept").textContent = mainPart.trim();
    trickEl.textContent = `💡 Memory Trick: ${trickPart.trim()}`;
    trickEl.classList.remove("hidden");
  } else {
    $("why-concept").textContent = fullConcept;
    trickEl.classList.add("hidden");
  }

  const list = $("why-distractors");
  list.innerHTML = "";
  const distractors = q.distractors || [];
  list.classList.toggle("hidden", distractors.length === 0);
  distractors.forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    list.appendChild(li);
  });

  card.classList.remove("hidden");
}

function toggleFlag() {
  const i = state.session.currentIndex;
  state.session.flagged[i] = !state.session.flagged[i];
  const isFlagged = state.session.flagged[i];
  $("flag-btn").classList.toggle("flagged", isFlagged);
  $("flag-label").textContent = isFlagged ? "Flagged" : "Flag";
  playTone("click");
  renderQuestionDots();
  saveActiveSession();
}

function advanceQuestion() {
  const { currentIndex, questions, answers } = state.session;
  if (state.config.mode === "practice" && answers[currentIndex] === null) return;
  if (currentIndex < questions.length - 1) {
    state.session.currentIndex++;
    renderQuestion();
    saveActiveSession();
  } else {
    finishSession();
  }
}

function bindArenaEvents() {
  $("next-btn").addEventListener("click", advanceQuestion);
  $("prev-btn").addEventListener("click", () => {
    if (state.session.currentIndex > 0) {
      state.session.currentIndex--;
      renderQuestion();
    }
  });
  $("flag-btn").addEventListener("click", toggleFlag);
  $("quit-btn").addEventListener("click", () => {
    stopTimer();
    saveActiveSession();
    refreshResumeBanner();
    showScreen("screen-config");
  });

  document.addEventListener("keydown", (e) => {
    if (!$("screen-arena").classList.contains("active")) return;
    const key = e.key.toLowerCase();
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
    if (key in map) {
      e.preventDefault();
      selectOption(map[key]);
    } else if (key === "f") {
      e.preventDefault();
      toggleFlag();
    } else if (e.key === "Enter" && !$("next-btn").disabled) {
      e.preventDefault();
      advanceQuestion();
    }
  });

  let touchStartX = 0;
  $("question-card").addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  $("question-card").addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (dx < -60 && !$("next-btn").disabled) {
      advanceQuestion();
    } else if (dx > 60 && state.config.mode === "exam" && state.session.currentIndex > 0) {
      state.session.currentIndex--;
      renderQuestion();
    }
  }, { passive: true });
}

// --- Screen 3: Session Verdict & Mistake Loop ---
function finishSession() {
  stopTimer();
  const { questions, answers, flagged, timingsMs, bestStreak } = state.session;

  let correct = 0;
  let computedStreak = 0;
  let maxStreak = bestStreak;
  const wrongQuestions = [];
  const topicStats = {};

  questions.forEach((q, i) => {
    const t = q.topic || "General";
    if (!topicStats[t]) topicStats[t] = { total: 0, missed: 0 };
    topicStats[t].total++;

    if (answers[i] === q.correctIndex) {
      correct++;
      computedStreak++;
      maxStreak = Math.max(maxStreak, computedStreak);
    } else {
      computedStreak = 0;
      wrongQuestions.push(q);
      topicStats[t].missed++;
    }
  });

  // Persist mistakes & cumulative stats
  const wrongIds = new Set(wrongQuestions.map((q) => q.id));
  const correctIds = new Set(
    questions.filter((_, i) => answers[i] === questions[i].correctIndex).map((q) => q.id)
  );
  const existing = loadSavedMistakes().filter((q) => !correctIds.has(q.id) && !wrongIds.has(q.id));
  saveMistakes([...wrongQuestions, ...existing]);
  recordSessionStats(questions, answers, maxStreak);
  clearActiveSession();

  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const validTimings = timingsMs.filter((t) => typeof t === "number");
  const avgSec = validTimings.length
    ? Math.round(validTimings.reduce((a, b) => a + b, 0) / validTimings.length / 1000)
    : 0;

  const modObj = state.syllabus?.modules.find((m) => m.id === state.config.moduleId);
  addSessionHistory({
    ts: Date.now(),
    moduleId: state.config.moduleId,
    moduleName: modObj ? modObj.name : "Quiz",
    mode: state.config.mode,
    correct,
    total,
    accuracy,
    avgSec,
  });

  $("verdict-accuracy").textContent = `${accuracy}%`;
  $("verdict-score").textContent = `${correct} / ${total}`;
  $("verdict-avg-time").textContent = `${avgSec}s / Q`;
  $("verdict-streak").textContent = `🔥 ${maxStreak}`;
  $("verdict-wrong-count").textContent = String(wrongQuestions.length);

  // Animate SVG progress ring (circumference = 2 * pi * 52 = 326.7)
  const ring = $("ring-fg");
  const color = accuracy >= 75 ? "var(--success)" : accuracy >= 50 ? "var(--warning)" : "var(--danger)";
  ring.style.stroke = color;
  ring.style.strokeDashoffset = "326.7";
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = String(326.7 * (1 - accuracy / 100));
  });

  if (accuracy >= 80) {
    $("verdict-tier").textContent = "Proff-Ready Distinction";
    $("verdict-heading").textContent = "Outstanding Precision!";
    $("verdict-subtitle").textContent = "You locked down the core JSMU concepts in this drill.";
  } else if (accuracy >= 55) {
    $("verdict-tier").textContent = "Solid Momentum";
    $("verdict-heading").textContent = "Good Run — Tighten Weak Spots";
    $("verdict-subtitle").textContent = "Use Retry Wrong MCQs below to turn missed concepts into easy marks.";
  } else {
    $("verdict-tier").textContent = "Warm-Up Drill";
    $("verdict-heading").textContent = "Review & Lock the Missed LOs";
    $("verdict-subtitle").textContent = "Every miss is saved in your Mistake Bank until you nail it.";
  }

  // Weak topic progress bars
  const weakList = $("weak-topics-list");
  weakList.innerHTML = "";
  const weakEntries = Object.entries(topicStats)
    .filter(([, s]) => s.missed > 0)
    .sort((a, b) => b[1].missed - a[1].missed);

  if (weakEntries.length === 0) {
    weakList.innerHTML = `<div class="weak-bar-row"><div class="weak-bar-head"><span>All topics mastered</span><span>100%</span></div><div class="weak-bar-track"><div class="weak-bar-fill" style="width:100%;background:var(--success)"></div></div></div>`;
  } else {
    weakEntries.forEach(([topic, st]) => {
      const pctMissed = Math.round((st.missed / st.total) * 100);
      const row = document.createElement("div");
      row.className = "weak-bar-row";
      row.innerHTML = `
        <div class="weak-bar-head">
          <span>${escapeHtml(topic)}</span>
          <span>${st.missed} / ${st.total} missed</span>
        </div>
        <div class="weak-bar-track">
          <div class="weak-bar-fill" style="width:${pctMissed}%"></div>
        </div>
      `;
      weakList.appendChild(row);
    });
  }

  // Full Answer Review Accordion
  $("review-count-badge").textContent = `${total} Qs`;
  const reviewList = $("review-list");
  reviewList.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  questions.forEach((q, i) => {
    const picked = answers[i];
    const isOk = picked === q.correctIndex;
    const item = document.createElement("div");
    item.className = `review-item ${isOk ? "is-correct" : "is-wrong"}`;
    const pickedText = picked !== null ? `${letters[picked]}. ${q.options[picked]}` : "Not answered";
    const rightText = `${letters[q.correctIndex]}. ${q.options[q.correctIndex]}`;
    item.innerHTML = `
      <div class="review-item-head">
        <span>Q${i + 1}. ${isOk ? "✓ Correct" : "✕ Missed"} ${flagged[i] ? "🚩" : ""}</span>
        <span>${escapeHtml(q.topic)}</span>
      </div>
      <div>${escapeHtml(q.stem)}</div>
      <div class="review-item-ans">
        Your pick: <strong>${escapeHtml(pickedText)}</strong> · Correct: <strong>${escapeHtml(rightText)}</strong>
      </div>
      <p class="review-item-concept">${escapeHtml(q.concept || "")}</p>
    `;
    reviewList.appendChild(item);
  });

  $("retry-wrong-btn").disabled = wrongQuestions.length === 0;
  $("retry-wrong-btn").onclick = () => {
    if (wrongQuestions.length) {
      const retryTopics = [...new Set(wrongQuestions.map((q) => q.topic).filter(Boolean))];
      startSession(wrongQuestions, "practice", { isRetry: true, retryTopics });
    }
  };

  const targetTopics = weakEntries.length
    ? weakEntries.map(([t]) => t)
    : state.session.retryTopics || [];
  const sessionQIds = questions.map((q) => q.id).filter(Boolean);

  const launchTargetedDrill = async (topics, btnEl) => {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Loading 10 MCQs…";
    }
    try {
      const modId = questions[0]?.module || state.config.moduleId;
      const res = await fetch("/api/sessions/weak-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: modId,
          weak_topics: topics,
          limit: 10,
          exclude_ids: sessionQIds,
          source: "mixed",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          startSession(data.questions, "practice");
          return;
        }
      }
    } catch {
      // Fallback below
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
    const targeted = buildSessionQuestions({ ...state.config, length: 10 }, topics);
    startSession(targeted, "practice");
  };

  $("practice-weak-btn").disabled = targetTopics.length === 0;
  $("practice-weak-btn").onclick = () => launchTargetedDrill(targetTopics, $("practice-weak-btn"));

  // Mastery prompt after conquering retried mistakes
  const masteryBanner = $("mastery-prompt-banner");
  const conqueredRetry = state.session.isRetry && correct > 0 && targetTopics.length > 0;
  if (conqueredRetry) {
    const topicLabel = targetTopics.slice(0, 3).join(", ");
    $("mastery-prompt-title").textContent =
      wrongQuestions.length === 0
        ? "🎯 All Missed MCQs Conquered!"
        : `🎯 ${correct} of ${total} Mistakes Fixed!`;
    $("mastery-prompt-desc").textContent = `Ready to master "${topicLabel}"? Practice 10 fresh MCQs on these exact topics.`;
    $("mastery-more-btn").onclick = () => launchTargetedDrill(targetTopics, $("mastery-more-btn"));
    $("mastery-dismiss-btn").onclick = () => masteryBanner.classList.add("hidden");
    masteryBanner.classList.remove("hidden");
  } else {
    masteryBanner.classList.add("hidden");
  }

  showScreen("screen-verdict");
}

function bindVerdictEvents() {
  $("new-session-btn").addEventListener("click", () => showScreen("screen-config"));
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
