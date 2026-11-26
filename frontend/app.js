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
  },
};

const $ = (id) => document.getElementById(id);

// --- Initialization ---
async function init() {
  initTheme();
  initSound();
  renderMomentumStats();
  refreshSavedMistakesUI();
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
    return raw ? JSON.parse(raw) : { totalSolved: 0, bestStreak: 0 };
  } catch {
    return { totalSolved: 0, bestStreak: 0 };
  }
}

function recordSessionStats(solvedCount, sessionBestStreak) {
  const stats = loadStats();
  stats.totalSolved += solvedCount;
  stats.bestStreak = Math.max(stats.bestStreak, sessionBestStreak);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore
  }
  renderMomentumStats();
}

function renderMomentumStats() {
  const stats = loadStats();
  $("total-solved-badge").textContent = `✓ ${stats.totalSolved} solved`;
  $("best-streak-badge").textContent = `🔥 ${stats.bestStreak} best`;
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

  modules.forEach((m) => {
    const meta = MODULE_META[m.id] || { icon: "📘", color: "#38bdf8", sub: "JSMU Module" };
    const topicCount = m.subjects.reduce((acc, s) => acc + s.topics.length, 0);
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
      </div>
    `;
    btn.addEventListener("click", () => {
      state.config.moduleId = m.id;
      state.config.topicQuery = "";
      $("topic-search").value = "";
      grid.querySelectorAll(".mod-card").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
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
  $("lo-summary-text").textContent = `JSMU Learning Objectives (${los.length})`;
  const list = $("lo-list");
  list.innerHTML = "";
  los.slice(0, 40).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.topic}: ${item.lo}`;
    list.appendChild(li);
  });
  if (los.length > 40) {
    const li = document.createElement("li");
    li.textContent = `…and ${los.length - 40} more Learning Objectives in this selection.`;
    list.appendChild(li);
  }
}

function bindConfigEvents() {
  $("brand-home").addEventListener("click", () => {
    stopTimer();
    showScreen("screen-config");
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
    playTone("click");
  });

  bindGroup("mode-group", ".mode-card", (val) => {
    state.config.mode = val;
    playTone("click");
  });

  bindGroup("length-group", ".pill", (val) => {
    state.config.length = Number(val);
    playTone("click");
  });

  $("saved-mistakes-btn").addEventListener("click", () => {
    const saved = loadSavedMistakes();
    if (saved.length > 0) {
      startSession(saved.slice(0, state.config.length), "practice");
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

// --- Screen 2: Interactive Quiz Arena ---
function startSession(questions, mode) {
  stopTimer();
  state.config.mode = mode;
  state.session = {
    questions,
    currentIndex: 0,
    answers: new Array(questions.length).fill(null),
    flagged: new Array(questions.length).fill(false),
    streak: 0,
    bestStreak: 0,
    timerSeconds: mode === "exam" ? questions.length * 60 : 0,
    timerId: null,
    questionStartMs: Date.now(),
    timingsMs: [],
  };

  showScreen("screen-arena");
  renderQuestionDots();
  renderQuestion();
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
}

function advanceQuestion() {
  const { currentIndex, questions, answers } = state.session;
  if (state.config.mode === "practice" && answers[currentIndex] === null) return;
  if (currentIndex < questions.length - 1) {
    state.session.currentIndex++;
    renderQuestion();
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
  recordSessionStats(questions.length, maxStreak);

  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const validTimings = timingsMs.filter((t) => typeof t === "number");
  const avgSec = validTimings.length
    ? Math.round(validTimings.reduce((a, b) => a + b, 0) / validTimings.length / 1000)
    : 0;

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
    if (wrongQuestions.length) startSession(wrongQuestions, "practice");
  };

  $("practice-weak-btn").disabled = weakEntries.length === 0;
  $("practice-weak-btn").onclick = async () => {
    const weakTopics = weakEntries.map(([t]) => t);
    try {
      const res = await fetch("/api/sessions/weak-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: state.config.moduleId, weak_topics: weakTopics, limit: 10 }),
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
    }
    const targeted = buildSessionQuestions({ ...state.config, length: 10 }, weakTopics);
    startSession(targeted, "practice");
  };

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
