// ProffPulse — Phase 1 Interactive 3-Screen Frontend

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
      "Interosseous membrane between shafts"
    ],
    correctIndex: 0,
    concept: "Synovial joints possess a fluid-filled joint cavity, fibrous capsule lined by synovial membrane, and articular surfaces typically covered by hyaline cartilage.",
    distractors: [
      "B: Fibrocartilage uniting bones directly describes symphyses (secondary cartilaginous joints).",
      "C: Synovial joints always have a joint cavity; fibrous and cartilaginous joints lack one.",
      "D: Interosseous membranes are syndesmoses (fibrous joints), not synovial joints."
    ],
    loRef: "JSMU Foundation · Anatomy LO: List the features of synovial joint"
  },
  {
    id: "seed-2",
    module: "foundation",
    subject: "Biochemistry",
    topic: "Enzyme Kinetics",
    source: "AI Fresh BCQ",
    stem: "A drug binds exclusively to the enzyme-substrate (ES) complex and lowers both Vmax and Km by the same factor. What type of inhibition is this?",
    options: [
      "Competitive inhibition",
      "Uncompetitive inhibition",
      "Non-competitive inhibition",
      "Irreversible inhibition"
    ],
    correctIndex: 1,
    concept: "Uncompetitive inhibitors bind only to the ES complex, decreasing both Vmax and Km proportionately (parallel lines on a Lineweaver-Burk plot).",
    distractors: [
      "A: Competitive inhibition increases apparent Km while Vmax remains unchanged.",
      "C: Pure non-competitive inhibition decreases Vmax while Km remains unchanged.",
      "D: Irreversible inhibitors permanently inactivate enzyme molecules, reducing active [E] and Vmax."
    ],
    loRef: "JSMU Foundation · Biochemistry LO: Enzyme Kinetics & Inhibition"
  },
  {
    id: "seed-3",
    module: "blood",
    subject: "Physiology",
    topic: "Erythropoiesis",
    source: "Past Bank",
    stem: "A patient with chronic renal failure develops normocytic normochromic anemia. Decreased production of which hormone is primarily responsible?",
    options: [
      "Thrombopoietin",
      "Erythropoietin",
      "Hepcidin",
      "Intrinsic factor"
    ],
    correctIndex: 1,
    concept: "Peritubular interstitial cells of the kidney produce ~90% of erythropoietin (EPO) in response to hypoxia, stimulating RBC production in bone marrow.",
    distractors: [
      "A: Thrombopoietin (mainly hepatic) regulates megakaryocyte/platelet production.",
      "C: Hepcidin inhibits iron absorption/release; excess hepcidin causes anemia of chronic disease, not EPO deficiency.",
      "D: Intrinsic factor is secreted by gastric parietal cells for vitamin B12 absorption."
    ],
    loRef: "JSMU Blood · Physiology LO: Regulation of erythropoiesis"
  },
  {
    id: "seed-4",
    module: "locomotion",
    subject: "Anatomy",
    topic: "Brachial Plexus",
    source: "Past Bank",
    stem: "Following a fall onto the shoulder, a newborn presents with an adducted, medially rotated arm and pronated forearm ('waiter's tip' position). Which roots are injured?",
    options: [
      "C5 and C6",
      "C8 and T1",
      "C6 and C7",
      "C7 and C8"
    ],
    correctIndex: 0,
    concept: "Erb-Duchenne palsy results from injury to the upper trunk (C5–C6) of the brachial plexus, paralyzing abductors/lateral rotators of the shoulder and flexors/supinators of the forearm.",
    distractors: [
      "B: C8–T1 injury causes Klumpke palsy (claw hand), affecting intrinsic hand muscles.",
      "C: C6–C7 primarily contributes to radial/median nerve triceps and wrist extensors.",
      "D: C7–C8 alone does not produce the classic Erb's waiter's tip posture."
    ],
    loRef: "JSMU Locomotor · Anatomy LO: Brachial plexus lesions"
  },
  {
    id: "seed-5",
    module: "respiration",
    subject: "Physiology",
    topic: "Oxygen-Hemoglobin Dissociation Curve",
    source: "AI Fresh BCQ",
    stem: "During vigorous skeletal muscle exercise, local tissue PCO2 rises and pH falls. How does this affect the oxygen-hemoglobin dissociation curve?",
    options: [
      "Shifts to the left, increasing O2 affinity",
      "Shifts to the right, facilitating O2 unloading",
      "No shift; only P50 decreases",
      "Shifts to the left, decreasing P50"
    ],
    correctIndex: 1,
    concept: "The Bohr effect: increased CO2, decreased pH (H+), increased temperature, and increased 2,3-BPG shift the curve to the right (higher P50), promoting O2 release to metabolically active tissues.",
    distractors: [
      "A: A left shift occurs with alkalosis, hypothermia, or fetal Hb, holding O2 more tightly.",
      "C: Right shift increases P50 (more PO2 needed for 50% saturation).",
      "D: Left shift decreases P50, which impairs unloading in exercising muscle."
    ],
    loRef: "JSMU Respiratory · Physiology LO: Bohr effect & O2 transport"
  },
  {
    id: "seed-6",
    module: "cvs",
    subject: "Anatomy",
    topic: "Coronary blood vessels, blood supply of heart",
    source: "Past Bank",
    stem: "In a right-dominant heart, the posterior interventricular (posterior descending) artery most commonly arises from which vessel?",
    options: [
      "Left anterior descending artery",
      "Left circumflex artery",
      "Right coronary artery",
      "Left main coronary artery"
    ],
    correctIndex: 2,
    concept: "Coronary dominance is defined by which artery gives off the posterior interventricular artery (PDA); in ~85% of individuals it arises from the right coronary artery (right dominance).",
    distractors: [
      "A: LAD supplies the anterior two-thirds of the interventricular septum and apex.",
      "B: Left circumflex gives off the PDA only in left-dominant hearts (~10%).",
      "D: The left main coronary artery bifurcates into LAD and LCx."
    ],
    loRef: "JSMU Cardiovascular · Anatomy LO: Right and left coronary dominance"
  },
  {
    id: "seed-7",
    module: "islamiat",
    subject: "Islamiat",
    topic: "Introduction To The Holy Quran",
    source: "Past Bank",
    stem: "Under whose caliphate was the first official compilation of the Holy Quran into a single Mushaf (book form) carried out, supervised by Zaid bin Thabit (R.A.)?",
    options: [
      "Umar ibn al-Khattab (R.A.)",
      "Abu Bakr al-Siddiq (R.A.)",
      "Uthman ibn Affan (R.A.)",
      "Ali ibn Abi Talib (R.A.)"
    ],
    correctIndex: 1,
    concept: "After the Battle of Yamama, Hazrat Abu Bakr (R.A.)—on the counsel of Hazrat Umar (R.A.)—commissioned Zaid bin Thabit (R.A.) to compile the Quran into one bound volume.",
    distractors: [
      "A: Hazrat Umar (R.A.) proposed the compilation after Yamama, during Abu Bakr's caliphate.",
      "C: Hazrat Uthman (R.A.) later standardized the script/dialect (Quraish) and distributed copies.",
      "D: Hazrat Ali (R.A.) was the fourth caliph, after Uthman (R.A.)."
    ],
    loRef: "JSMU Islamic Studies · Topic 1 LO: Compilation of the Quran"
  }
];

const state = {
  syllabus: null,
  config: {
    moduleId: "",
    subjectId: "all",
    topicId: "all",
    source: "mixed",
    mode: "practice",
    length: 10
  },
  session: {
    questions: [],
    currentIndex: 0,
    answers: [],
    streak: 0,
    bestStreak: 0,
    timerSeconds: 0,
    timerId: null,
    questionStartMs: 0,
    timingsMs: []
  }
};

const $ = (id) => document.getElementById(id);

// --- Initialization ---
async function init() {
  initTheme();
  bindConfigEvents();
  bindArenaEvents();
  bindVerdictEvents();
  await loadSyllabus();
}

function initTheme() {
  const saved = localStorage.getItem("proffpulse-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  $("theme-icon").textContent = saved === "light" ? "🌙" : "☀️";
  $("theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("proffpulse-theme", next);
    $("theme-icon").textContent = next === "light" ? "🌙" : "☀️";
  });
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
      // Try next path
    }
  }
  if (!state.syllabus) {
    $("lo-summary-text").textContent = "Could not load syllabus data";
    return;
  }
  populateModules();
}

// --- Screen 1: Cascading Filters ---
function populateModules() {
  const sel = $("select-module");
  sel.innerHTML = "";
  state.syllabus.modules.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.order}. ${m.name}`;
    sel.appendChild(opt);
  });
  state.config.moduleId = state.syllabus.modules[0]?.id || "";
  sel.value = state.config.moduleId;
  populateSubjects();
}

function populateSubjects() {
  const mod = state.syllabus.modules.find((m) => m.id === state.config.moduleId);
  const sel = $("select-subject");
  sel.innerHTML = `<option value="all">All Subjects</option>`;
  if (mod) {
    mod.subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.topics.length} topics)`;
      sel.appendChild(opt);
    });
  }
  state.config.subjectId = "all";
  sel.value = "all";
  populateTopics();
}

function populateTopics() {
  const mod = state.syllabus.modules.find((m) => m.id === state.config.moduleId);
  const sel = $("select-topic");
  sel.innerHTML = `<option value="all">All Topics</option>`;

  if (mod) {
    const subjects =
      state.config.subjectId === "all"
        ? mod.subjects
        : mod.subjects.filter((s) => s.id === state.config.subjectId);

    subjects.forEach((s) => {
      s.topics.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = state.config.subjectId === "all" ? `[${s.name}] ${t.title}` : t.title;
        sel.appendChild(opt);
      });
    });
  }
  state.config.topicId = "all";
  sel.value = "all";
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
  const previewSlice = los.slice(0, 40);
  previewSlice.forEach((item) => {
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

  $("select-module").addEventListener("change", (e) => {
    state.config.moduleId = e.target.value;
    populateSubjects();
  });

  $("select-subject").addEventListener("change", (e) => {
    state.config.subjectId = e.target.value;
    populateTopics();
  });

  $("select-topic").addEventListener("change", (e) => {
    state.config.topicId = e.target.value;
    updateLOPreview();
  });

  bindGroup("source-group", ".seg-btn", (val) => {
    state.config.source = val;
  });

  bindGroup("mode-group", ".seg-btn", (val) => {
    state.config.mode = val;
    $("mode-hint").textContent =
      val === "practice"
        ? "Practice Mode: Instant reveal + distractor breakdown after every question."
        : "Exam Mode: 1 minute per MCQ countdown. Results & review shown at the end.";
  });

  bindGroup("length-group", ".pill", (val) => {
    state.config.length = Number(val);
  });

  $("config-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("start-btn");
    btn.disabled = true;
    btn.textContent = "Loading MCQs…";
    try {
      const questions = await fetchSessionQuestions(state.config);
      startSession(questions, state.config.mode);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Start Quiz <span aria-hidden="true">→</span>';
    }
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
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch {
    // Fallback to local seed/LO questions if backend unavailable
  }
  return buildSessionQuestions(cfg);
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

// --- Phase 1 Question Assembly (Seed + LO-locked placeholder until Phase 2 API) ---
function buildSessionQuestions(cfg, overrideTopics = null) {
  const mod = state.syllabus.modules.find((m) => m.id === cfg.moduleId);
  const matchingSeeds = SEED_QUESTIONS.filter((q) => {
    if (q.module !== cfg.moduleId) return false;
    if (cfg.subjectId !== "all" && q.subject.toLowerCase() !== cfg.subjectId) return false;
    if (cfg.source === "past" && q.source !== "Past Bank") return false;
    if (cfg.source === "ai" && q.source !== "AI Fresh BCQ") return false;
    return true;
  });

  const los = getSelectedLOs();
  const filteredLOs = overrideTopics
    ? los.filter((item) => overrideTopics.includes(item.topic))
    : los;
  const poolLOs = filteredLOs.length ? filteredLOs : los;

  const questions = [...matchingSeeds];
  let idx = 0;
  while (questions.length < cfg.length && poolLOs.length > 0) {
    const item = poolLOs[idx % poolLOs.length];
    const sourceLabel =
      cfg.source === "ai"
        ? "AI Fresh BCQ"
        : cfg.source === "past"
        ? "Past Bank"
        : idx % 2 === 0
        ? "Past Bank"
        : "AI Fresh BCQ";

    questions.push({
      id: `lo-preview-${idx + 1}`,
      module: cfg.moduleId,
      subject: item.subject,
      topic: item.topic,
      source: `${sourceLabel} (Phase 1 Preview)`,
      stem: `[${mod?.name || cfg.moduleId} · ${item.subject}] Syllabus-locked check for "${item.topic}": Which statement best aligns with the JSMU Learning Objective "${item.lo}"?`,
      options: [
        `Primary mechanism & clinical correlation of ${item.lo}`,
        `Unrelated histological artifact outside ${item.topic}`,
        `Contradictory physiological response not seen in ${item.subject}`,
        `Out-of-syllabus pathology from later clinical years`
      ],
      correctIndex: 0,
      concept: `Phase 1 syllabus-locked placeholder mapped directly to JSMU LO: "${item.lo}". Full Past Bank & AI BCQs connect in Phase 2–3.`,
      distractors: [
        `B: Excluded because it lies outside ${item.topic}.`,
        `C: Contradicts normal ${item.subject} principles.`,
        `D: Out of 1st-year MBBS scope.`
      ],
      loRef: `JSMU ${mod?.name || ""} · ${item.subject} · ${item.topic}`
    });
    idx++;
  }

  return questions.slice(0, cfg.length);
}

// --- Screen 2: Quiz Arena ---
function startSession(questions, mode) {
  stopTimer();
  state.config.mode = mode;
  state.session = {
    questions,
    currentIndex: 0,
    answers: new Array(questions.length).fill(null),
    streak: 0,
    bestStreak: 0,
    timerSeconds: mode === "exam" ? questions.length * 60 : 0,
    timerId: null,
    questionStartMs: Date.now(),
    timingsMs: []
  };

  showScreen("screen-arena");
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

function renderQuestion() {
  const { questions, currentIndex, streak } = state.session;
  const q = questions[currentIndex];
  const total = questions.length;

  $("hud-counter").textContent = `${currentIndex + 1} / ${total}`;
  $("hud-streak").textContent = `🔥 ${streak}`;
  const pct = Math.round(((currentIndex) / total) * 100);
  $("progress-fill").style.width = `${pct}%`;
  $("progress-track").setAttribute("aria-valuenow", String(pct));

  $("q-subject-badge").textContent = q.subject;
  $("q-source-badge").textContent = q.source;
  $("q-topic-label").textContent = q.topic;
  $("q-stem").textContent = q.stem;

  const list = $("options-list");
  list.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  q.options.forEach((optText, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.dataset.index = String(i);
    btn.innerHTML = `<span class="option-key">${letters[i]}</span><span>${escapeHtml(optText)}</span>`;
    btn.addEventListener("click", () => selectOption(i));
    list.appendChild(btn);
  });

  $("why-card").classList.add("hidden");
  $("next-btn").disabled = true;
  $("next-btn").textContent = currentIndex === total - 1 ? "Finish Session →" : "Next Question →";
  state.session.questionStartMs = Date.now();
}

function selectOption(chosenIdx) {
  const { questions, currentIndex, answers } = state.session;
  const q = questions[currentIndex];

  // In Practice Mode, lock answer after first pick
  if (state.config.mode === "practice" && answers[currentIndex] !== null) {
    return;
  }

  const elapsed = Date.now() - state.session.questionStartMs;
  state.session.timingsMs[currentIndex] = elapsed;
  answers[currentIndex] = chosenIdx;

  const buttons = $("options-list").querySelectorAll(".option-btn");

  if (state.config.mode === "practice") {
    const isCorrect = chosenIdx === q.correctIndex;
    if (isCorrect) {
      state.session.streak++;
      state.session.bestStreak = Math.max(state.session.bestStreak, state.session.streak);
    } else {
      state.session.streak = 0;
    }
    $("hud-streak").textContent = `🔥 ${state.session.streak}`;

    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correctIndex) b.classList.add("correct");
      else if (i === chosenIdx) b.classList.add("wrong");
    });

    showWhyCard(q);
  } else {
    buttons.forEach((b, i) => {
      b.classList.toggle("selected", i === chosenIdx);
    });
  }

  $("next-btn").disabled = false;
}

function showWhyCard(q) {
  $("why-ref").textContent = q.loRef || "";
  $("why-concept").textContent = q.concept || "";
  const list = $("why-distractors");
  list.innerHTML = "";
  (q.distractors || []).forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    list.appendChild(li);
  });
  $("why-card").classList.remove("hidden");
}

function advanceQuestion() {
  const { currentIndex, questions } = state.session;
  if (state.session.answers[currentIndex] === null) return;
  if (currentIndex < questions.length - 1) {
    state.session.currentIndex++;
    renderQuestion();
  } else {
    finishSession();
  }
}

function bindArenaEvents() {
  $("next-btn").addEventListener("click", advanceQuestion);
  $("quit-btn").addEventListener("click", () => {
    stopTimer();
    showScreen("screen-config");
  });

  // Keyboard hotkeys (1-4, A-D, Enter)
  document.addEventListener("keydown", (e) => {
    if (!$("screen-arena").classList.contains("active")) return;
    const key = e.key.toLowerCase();
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
    if (key in map) {
      e.preventDefault();
      selectOption(map[key]);
    } else if (e.key === "Enter" && !$("next-btn").disabled) {
      e.preventDefault();
      advanceQuestion();
    }
  });

  // Mobile swipe left for next
  let touchStartX = 0;
  $("question-card").addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  $("question-card").addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (dx < -60 && !$("next-btn").disabled) {
      advanceQuestion();
    }
  }, { passive: true });
}

// --- Screen 3: Verdict & Mistake Loop ---
function finishSession() {
  stopTimer();
  const { questions, answers, timingsMs, bestStreak } = state.session;

  let correct = 0;
  let computedStreak = 0;
  let maxStreak = bestStreak;
  const wrongQuestions = [];
  const weakTopicCounts = {};

  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) {
      correct++;
      computedStreak++;
      maxStreak = Math.max(maxStreak, computedStreak);
    } else {
      computedStreak = 0;
      wrongQuestions.push(q);
      weakTopicCounts[q.topic] = (weakTopicCounts[q.topic] || 0) + 1;
    }
  });

  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const validTimings = timingsMs.filter((t) => typeof t === "number");
  const avgSec = validTimings.length
    ? Math.round(validTimings.reduce((a, b) => a + b, 0) / validTimings.length / 1000)
    : 0;

  $("verdict-accuracy").textContent = `${accuracy}%`;
  $("verdict-score").textContent = `${correct} / ${total}`;
  $("verdict-avg-time").textContent = `${avgSec}s`;
  $("verdict-streak").textContent = `🔥 ${maxStreak}`;
  $("verdict-wrong-count").textContent = String(wrongQuestions.length);

  const weakList = $("weak-topics-list");
  weakList.innerHTML = "";
  const weakEntries = Object.entries(weakTopicCounts).sort((a, b) => b[1] - a[1]);
  if (weakEntries.length === 0) {
    weakList.innerHTML = "<li>Zero mistakes — clean sweep!</li>";
  } else {
    weakEntries.forEach(([topic, count]) => {
      const li = document.createElement("li");
      li.textContent = `${topic} — ${count} missed`;
      weakList.appendChild(li);
    });
  }

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
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
