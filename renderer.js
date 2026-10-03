/**
 * Array of predefined QA Agents.
 * Each object defines a specific role and workflow for automated QA analysis.
 * properties:
 * - id: Unique identifier code
 * - n: Human-readable name
 * - d: Short description of the agent's function
 * - lab: Input field label presented to the user
 * - sys: System prompt instructions sent to the LLM backend
 * - ex: Example input string used for demonstration
 */
const AGENTS = [
  {
    id: "req",
    n: "Requirement Review",
    d: "Reviews user stories and flags missing acceptance criteria, edge cases and unclear requirements.",
    lab: "User story / requirement",
    sys: "You are a senior QA analyst. Review the user story. Output Markdown with sections: Missing acceptance criteria, Edge cases, Unclear or ambiguous requirements, Questions for the product owner. Be specific and concise.",
    ex: "As a user, I want to reset my password so that I can log back in.\nThe reset link is sent by email.",
  },
  {
    id: "tc",
    n: "Test Case Generation",
    d: "Creates positive, negative, boundary and integration scenarios from a story.",
    lab: "User story / feature description",
    sys: "You are a QA engineer. Generate test cases from the story as Markdown tables grouped by Positive, Negative, Boundary, Integration. Columns: ID, Title, Preconditions, Steps, Expected result, Priority.",
    ex: "Users can apply one discount code at checkout. Codes are 8 alphanumeric characters, expire after 30 days, and cannot be combined with sale items.",
  },
  {
    id: "api",
    n: "API Contract",
    d: "Reads an OpenAPI spec and suggests request validations, negative cases and schema checks.",
    lab: "OpenAPI spec (YAML or JSON)",
    sys: "You are an API testing expert. From the OpenAPI snippet, propose per endpoint: request validations, negative cases (status code expected), schema/response checks, auth checks. Output Markdown, optionally with example payloads.",
    ex: "paths:\n  /users:\n    post:\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              required: [email, age]\n              properties:\n                email: {type: string, format: email}\n                age: {type: integer, minimum: 18}\n      responses:\n        '201': {description: created}\n        '400': {description: invalid}",
  },
  {
    id: "code",
    n: "Automation Code Review",
    d: "Checks scripts for hard-coded data, weak assertions, unstable locators, fixed waits, duplication.",
    lab: "Test automation code",
    sys: "You are a test automation architect. Review the code. List findings under: Hard-coded data, Weak assertions, Unstable locators, Fixed waits, Duplication, Other. For each finding give line/snippet, why it matters, and a fix. End with a severity-ranked summary.",
    ex: "test('login', async () => {\n  await page.goto('http://staging.example.com/login');\n  await page.click('div > div:nth-child(3) > button');\n  await page.waitForTimeout(5000);\n  await page.fill('#user','admin@test.com');\n  expect(await page.title()).toBeTruthy();\n});",
  },
  {
    id: "tri",
    n: "Failure Triage",
    d: "Classifies failures as product defect, automation issue, test-data problem or environment failure.",
    lab: "Test report / logs / stack traces",
    sys: "You are a QA triage lead. For each failure, classify as Product defect, Automation issue, Test-data problem, or Environment failure. Give confidence (high/med/low), evidence from the log, and next action. Output a Markdown table then a short summary.",
    ex: "FAIL checkout.spec: expected 200 got 503 from /api/pay (upstream connect error)\nFAIL profile.spec: Element not found: #avatar-upload after 30s\nFAIL search.spec: expected 12 results, got 11\nFAIL cart.spec: user qa_user_07 already exists",
  },
  {
    id: "flk",
    n: "Flaky-Test Analysis",
    d: "Examines run history to find frequently failing tests, timing patterns and root causes.",
    lab: "Execution history (CSV / text)",
    sys: "You are a test reliability engineer. Analyse the history. Identify flaky tests (pass/fail without code change), failure rate, timing/time-of-day/order patterns, and likely root causes. Rank by impact and suggest fixes. Output Markdown.",
    ex: "test,run,result,duration_s,time\nlogin,1,pass,4,09:00\nlogin,2,fail,31,13:00\nlogin,3,pass,5,09:00\nlogin,4,fail,30,13:05\nsearch,1,pass,8,09:00\nsearch,2,pass,8,13:00\nupload,1,pass,12,09:00\nupload,2,fail,12,13:00",
  },
  {
    id: "def",
    n: "Defect Drafting",
    d: "Turns logs, screenshots notes and API responses into a structured defect report.",
    lab: "Evidence (logs, API responses, notes)",
    sys: "You are a QA engineer writing a defect. From the evidence create: Title, Severity, Priority suggestion, Environment, Preconditions, Steps to reproduce, Expected, Actual, Evidence, Suspected area. Mark anything you inferred as 'Assumption' so the human can verify.",
    ex: "POST /api/orders {qty:-3} returned 200 and created order #4411 with total -29.97. Browser: Chrome 126, env: staging, build 2.14.1.",
  },
  {
    id: "reg",
    n: "Regression Selection",
    d: "Uses code changes, impacted services and past defects to recommend regression tests.",
    lab: "Change description / diff + impacted services + past defects",
    sys: "You are a risk-based test strategist. Given the changes, recommend which regression tests to run: Must run, Should run, Can skip, each with reasoning. Add risk notes and any test gaps. Output Markdown.",
    ex: "Changed: PaymentService.applyCoupon() now rounds to 2 decimals; OrderService reads new field coupon_applied.\nImpacted: checkout, invoices, refunds.\nPast defects: rounding error on refunds (v2.9), double-discount (v2.11).",
  },
  {
    id: "rel",
    n: "Release Summary",
    d: "Combines execution results, defect status and known risks into a release-quality report.",
    lab: "Results, open defects, known risks",
    sys: "You are a QA manager. Write a concise release-quality report: Overall verdict (Go / Go with risks / No-go) with rationale, Test execution summary, Open defects by severity, Known risks and mitigations, Recommendations. Do not invent numbers not in the input.",
    ex: "Regression: 412 run, 398 pass, 9 fail, 5 blocked.\nOpen defects: 1 critical (payment timeout on retry), 3 major, 7 minor.\nRisks: new payment provider only tested in staging; mobile Safari not covered.",
  },
];
/**
 * Helper utility to fetch a DOM element by its ID.
 * @param {string} id - The HTML ID of the element.
 * @returns {HTMLElement} The corresponding DOM node.
 */
const $ = (id) => document.getElementById(id);

/**
 * Predefined steps of the QA agent workflow shown sequentially in the UI.
 */
const STEPS = [
  "Input",
  "AI analysis",
  "Human review",
  "Execution",
  "Feedback",
  "Improvement",
];

// --- Global Application State Variables ---
/** The currently selected agent object */
let cur = AGENTS[0],
  /** The current workflow stage index (0-5) mapping to the STEPS array */
  stage = 0,
  /** Tracks whether the AI's generated output has been explicitly approved */
  approved = false,
  /** Tracks the user's star rating (1-5) for the AI response */
  rating = 0,
  /** A unique, incremental run ID used to prevent race conditions during async LLM calls */
  runId = 0;

/**
 * LocalStorage wrapper for persistent data.
 * Safely handles missing/disabled localStorage (e.g. in incognito or highly restricted sandboxes)
 * without crashing the application.
 */
const store = {
  // Retrieve item from storage with fallback default
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  // Persist item to storage
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { }
  },
};

/**
 * The primary database state object holding statistics, logs, and learned feedback loops.
 * Fetched securely from the localStorage wrapper.
 */
let db = store.get("qa_db", { runs: 0, appr: 0, ratings: [], lessons: {} });

/**
 * Standard pre-defined time savings (in minutes) assigned to each agent's task.
 * Used to calculate the efficiency and cost-saving metrics.
 */
const MINS = {
  req: 20,
  tc: 30,
  api: 25,
  code: 20,
  tri: 25,
  flk: 30,
  def: 15,
  reg: 20,
  rel: 25,
};
// Initialize specific log tracking properties if they don't exist in the loaded DB object
db.log = db.log || [];
db.cfg = db.cfg || { rate: 40, cur: "$" };
// Merge any user-adjusted minutes tracking over the default MINS schema
db.cfg.mins = { ...MINS, ...(db.cfg.mins || {}) };

/**
 * Tracks the pending AI draft currently under human review.
 */
let pend = null;

/**
 * Calculates the net time saved by an approved AI run.
 * It takes the manual time required for the task (from config) and subtracts the actual human review time (with a 2 min floor).
 * @param {Object} x - The log entry object containing decision and review time properties.
 * @returns {number} Net saved time in minutes.
 */
const sv = (x) =>
  x.decision === "approved"
    ? Math.max(0, db.cfg.mins[x.agent] - Math.max(x.reviewSec / 60, 2))
    : 0;

/**
 * Persists the current 'db' state back to localStorage.
 */
const save = () => store.set("qa_db", db);

/**
 * Recalculates and renders the top-level aggregate statistics:
 * Total Runs, Approval Rate percentage, Average Rating, and Net Hours Saved.
 */
function stats() {
  const L = db.log,
    A = L.filter((x) => x.decision === "approved"),
    D = L.length;
  // Update UI Elements with freshly calculated data
  $("sRuns").textContent = db.runs;
  $("sApp").textContent = D ? Math.round((100 * A.length) / D) + "%" : "–";
  const r = db.ratings;
  $("sRate").textContent = r.length
    ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) + "★"
    : "–";
  $("sMin").textContent = (A.reduce((s, x) => s + sv(x), 0) / 60).toFixed(1);
}
/**
 * Renders the top workflow step indicator (1-6) based on the current 'stage' state.
 */
function drawSteps() {
  $("steps").innerHTML = STEPS.map(
    (s, i) =>
      `<div class="step ${i < stage ? "done" : ""} ${i == stage ? "on" : ""}">${i + 1}. ${s}</div>`,
  ).join("");
}

/**
 * Renders any previously saved lessons/feedback for the currently selected agent.
 * Toggles the visibility of the lessons box.
 */
function drawLessons() {
  const l = db.lessons[cur.id] || [];
  // Hide the entire box if there are no lessons learned yet
  $("lessonsBox").classList.toggle("hide", !l.length);
  $("lessons").innerHTML = "";
  // Create a visually distinct block for each string lesson
  l.forEach((t) => {
    const d = document.createElement("div");
    d.className = "lesson";
    d.textContent = t;
    $("lessons").appendChild(d);
  });
}

/**
 * Handles the selection of a specific QA agent from the UI.
 * Resets the application state to prepare for a new run.
 * @param {Object} a - The newly selected agent object.
 */
function pick(a) {
  // Reset active run state
  pend = null;
  cur = a;
  stage = 0;
  approved = false;
  rating = 0;
  runId++; // Invalidates any pending LLM network calls
  
  // Highlight the selected chip in the top navigation
  document
    .querySelectorAll(".chip")
    .forEach((c) => c.classList.toggle("on", c.dataset.id == a.id));
    
  // Update UI descriptions and input labels
  $("desc").textContent = a.d;
  $("inLbl").textContent = "1 · Input — " + a.lab;
  
  // Clear out text areas and status texts
  $("inp").value = "";
  $("out").value = "";
  $("status").textContent = "";
  
  // Hide subsequent workflow steps (review, execute, feedback)
  ["rev", "exe", "fb"].forEach((x) => $(x).classList.add("hide"));
  
  // Re-enable the run button and reset the feedback note field
  $("run").disabled = false;
  $("note").value = "";
  $("fbMsg").textContent = "";
  $("exMsg").textContent = "";
  
  // Redraw state-dependent UI components
  drawSteps();
  drawLessons();
  drawStars();
}

/**
 * Renders the interactive 5-star rating component for providing feedback.
 */
function drawStars() {
  $("stars").innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.className = "b g";
    // Render a filled star if the index is less than or equal to the current rating
    b.textContent = i <= rating ? "★" : "☆";
    b.onclick = () => {
      rating = i;
      drawStars(); // Re-render when clicked
    };
    $("stars").appendChild(b);
  }
}

// Dynamically create the agent selection 'chips' at the top of the UI
AGENTS.forEach((a) => {
  const c = document.createElement("button");
  c.className = "chip";
  c.dataset.id = a.id;
  c.textContent = a.n;
  c.onclick = () => pick(a);
  $("chips").appendChild(c);
});

/**
 * Button click handler: 'Load example'
 * Injects the agent's pre-defined example text into the input field.
 */
$("demo").onclick = () => {
  $("inp").value = cur.ex;
};

/**
 * Button click handler: 'Run agent'
 * Triggers the main LLM call to process the input through the selected agent.
 */
$("run").onclick = async () => {
  const text = $("inp").value.trim();
  if (!text) {
    $("status").textContent = "Add some input first.";
    return;
  }
  
  // Lock this execution to a specific run ID to handle async race conditions
  const my = ++runId;
  $("run").disabled = true; // Prevent double clicks
  stage = 1; // Transition to 'AI analysis' stage
  drawSteps();
  
  // Display dynamic loading status with the provider's name
  $("status").textContent = "Analysing with " + cfg.provider + "…";
  
  // Hide downstream UI panels
  ["exe", "fb"].forEach((x) => $(x).classList.add("hide"));
  approved = false;
  
  try {
    // Append learned lessons into the system prompt dynamically
    const les = db.lessons[cur.id] || [];
    const sys =
      cur.sys +
      (les.length
        ? "\n\nLessons from past human reviews — follow them:\n- " +
        les.join("\n- ")
        : "");
        
    // Execute the IPC call to the main process
    const res = await window.api.complete({
      system: sys,
      user: "--- INPUT ---\n" + text,
    });
    
    // Abort if the user changed agents or started a new run while waiting
    if (my !== runId) return;
    
    // Inject the generated AI text into the output textarea
    $("out").value = res.text;
    
    // Track this pending review
    pend = { agent: cur.id, orig: res.text, t: Date.now() };
    db.runs++; // Increment global runs counter
    
    // Persist and re-render stats
    save();
    stats();
    
    // Advance workflow state to 'Human review'
    stage = 2;
    drawSteps();
    $("rev").classList.remove("hide");
    $("status").textContent = "Draft ready — review it below.";
  } catch (e) {
    // Display any IPC or network errors securely cleanly
    $("status").textContent =
      "Error: " +
      ((e && e.message) || "failed").replace(
        /^Error invoking remote method '[^']+': (Error: )?/,
        "",
      );
    // Revert state on failure
    stage = 0;
    drawSteps();
  }
  $("run").disabled = false;
};
/**
 * Completes the human review step by either approving or rejecting the AI draft.
 * Calculates edit distances and saves performance telemetry to the log.
 * @param {string} d - The decision taken, either "approved" or "rejected"
 * @returns {boolean} True if the decision was successfully processed, false if no pending review.
 */
function decide(d) {
  if (!pend) return false;
  const o = pend.orig,
    n = $("out").value;
    
  // --- Simple Edit Distance Calculation ---
  // Calculates the length of identical prefix and suffix to approximate how much text the user manually changed
  let i = 0;
  while (i < o.length && i < n.length && o[i] === n[i]) i++;
  let j = 0;
  while (
    j < o.length - i &&
    j < n.length - i &&
    o[o.length - 1 - j] === n[n.length - 1 - j]
  )
    j++;
    
  // The 'changed' character count is the remaining middle block
  const ch = Math.max(o.length - i - j, n.length - i - j),
    // Percentage changed relative to the original length
    pc = o.length ? Math.min(100, Math.round((100 * ch) / o.length)) : 0;
    
  // Push an immutable log record
  db.log.push({
    ts: new Date().toISOString(),
    agent: pend.agent,
    decision: d,
    edited: pc > 0,
    editPct: pc,
    // Calculate seconds elapsed since the draft was delivered
    reviewSec: Math.round((Date.now() - pend.t) / 1000),
  });
  
  if (d === "approved") db.appr++;
  pend = null; // Clear pending state
  
  save();
  stats();
  renderImpact();
  return true;
}

/**
 * Button click handler: '✓ Approve'
 * Moves to Execution and Feedback stages upon user approval.
 */
$("appr").onclick = () => {
  if (!decide("approved")) return;
  stage = 3;
  drawSteps();
  $("exe").classList.remove("hide");
  $("fb").classList.remove("hide");
  // Smoothly scroll the user down to the next actions
  $("exe").scrollIntoView({ behavior: "smooth" });
};

/**
 * Button click handler: '✕ Reject'
 * Skips execution and forces the user straight to feedback to train the agent.
 */
$("rej").onclick = () => {
  if (!decide("rejected")) return;
  stage = 4;
  drawSteps();
  $("exe").classList.add("hide"); // Cannot execute a rejected draft
  $("fb").classList.remove("hide");
  $("note").placeholder = "Why was it rejected? This teaches the agent.";
  $("fb").scrollIntoView({ behavior: "smooth" });
};

/**
 * Button click handler: 'Copy'
 * Attempts to copy the approved markdown result to the OS clipboard natively.
 */
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("out").value);
    $("exMsg").textContent = "Copied ✓";
  } catch (e) {
    // Fallback if clipboard API is blocked (e.g. non-HTTPS environments without appropriate flags)
    $("out").select();
    $("exMsg").textContent = "Select-all done — copy manually.";
  }
};

/**
 * Button click handler: 'Download .md'
 * Triggers the main process to open a save dialog and write to a physical markdown file.
 */
$("dl").onclick = async () => {
  const ok = await window.api.saveFile(
    cur.id + "-agent-output.md",
    $("out").value,
  );
  $("exMsg").textContent = ok ? "Saved ✓" : "Not saved.";
};

/**
 * Button click handler: 'Save feedback'
 * Commits the user's rating and textual lesson to local storage for future reference.
 */
$("sendFb").onclick = () => {
  // Save star rating
  if (rating) db.ratings.push(rating);
  
  // Save text note to the lessons queue
  const n = $("note").value.trim();
  if (n) {
    (db.lessons[cur.id] = db.lessons[cur.id] || []).push(n);
    // Keep only the 5 most recent lessons per agent to avoid context window flooding
    db.lessons[cur.id] = db.lessons[cur.id].slice(-5);
  }
  save();
  stats();
  drawLessons();
  stage = 5; // Improvement stage
  drawSteps();
  $("fbMsg").textContent = n
    ? "Saved — next run will apply this lesson."
    : "Saved ✓";
};

/**
 * Renders the detailed 'Impact & savings' dashboard component.
 * Computes complex ROI metrics like Cost Saved and detailed averages.
 */
function renderImpact() {
  const L = db.log,
    A = L.filter((x) => x.decision === "approved"),
    R = L.filter((x) => x.decision === "rejected"),
    D = L.length;
    
  // 'As is' implies zero edits made by the user
  const asis = A.filter((x) => !x.edited).length,
    hrs = A.reduce((s, x) => s + sv(x), 0) / 60;
    
  // Safely average a dataset
  const avg = (arr, f) =>
    arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0,
    pct = (n, d) => (d ? Math.round((100 * n) / d) + "%" : "–");
    
  // Array of tuple data for the dashboard tiles
  const T = [
    ["Net time saved", hrs.toFixed(1) + " h"],
    ["Cost saved", db.cfg.cur + Math.round(hrs * db.cfg.rate).toLocaleString()],
    ["Approval rate", pct(A.length, D)],
    ["Approved as-is", pct(asis, D)],
    ["Approved with edits", A.length - asis],
    ["Rejected", R.length],
    [
      "Avg review time",
      D ? Math.round(avg(L, (x) => x.reviewSec)) + " s" : "–",
    ],
    [
      "Avg edit size",
      A.length ? Math.round(avg(A, (x) => x.editPct)) + "%" : "–",
    ],
  ];
  
  // Render impact tiles
  $("tiles").innerHTML = T.map(
    (t) => `<div class="stat"><b>${t[1]}</b><span>${t[0]}</span></div>`,
  ).join("");
  
  // Populate cost inputs
  $("rate").value = db.cfg.rate;
  $("cur").value = db.cfg.cur;
  
  // Construct the 'Per Agent' breakdown table dynamically
  let h =
    "<tr><th>Agent</th><th>Appr.</th><th>Rej.</th><th>Manual min</th><th>Saved h</th></tr>";
  AGENTS.forEach((a) => {
    const ar = A.filter((x) => x.agent === a.id),
      rr = R.filter((x) => x.agent === a.id);
    // Include interactive inputs directly inside table cells for quick adjustments
    h += `<tr><td>${a.n}</td><td>${ar.length}</td><td>${rr.length}</td><td><input type="number" min="1" data-m="${a.id}" value="${db.cfg.mins[a.id]}"></td><td>${(ar.reduce((s, x) => s + sv(x), 0) / 60).toFixed(1)}</td></tr>`;
  });
  $("perAgent").innerHTML = h;
  
  // Attach change listeners to dynamically created table inputs
  document.querySelectorAll("[data-m]").forEach(
    (i) =>
    (i.onchange = () => {
      // Minimum saving allowed is 1 minute
      db.cfg.mins[i.dataset.m] = Math.max(1, +i.value || 1);
      save();
      stats();
      renderImpact();
    }),
  );
}

// Handlers for 'Hourly cost' fields
$("rate").onchange = () => {
  db.cfg.rate = Math.max(0, +$("rate").value || 0);
  save();
  renderImpact();
};
$("cur").onchange = () => {
  db.cfg.cur = $("cur").value.slice(0, 3);
  save();
  renderImpact();
};

/**
 * Button click handler: 'Export run log (CSV)'
 * Flattens the structured db.log array into CSV format and prompts file download.
 */
$("expCsv").onclick = async () => {
  const rows = [
    "timestamp,agent,decision,edited,edit_pct,review_sec,saved_min",
  ].concat(
    db.log.map((x) =>
      [
        x.ts,
        x.agent,
        x.decision,
        x.edited,
        x.editPct,
        x.reviewSec,
        sv(x).toFixed(1), // Calculate true saved time at export
      ].join(","),
    ),
  );
  await api.saveFile("qa-agent-run-log.csv", rows.join("\n"));
};

/**
 * Button click handler: 'Reset metrics'
 * Wipes tracking metrics but intentionally preserves trained lessons/prompts.
 */
$("resetM").onclick = () => {
  if (confirm("Clear all metrics and the run log? Lessons are kept.")) {
    db.runs = 0;
    db.appr = 0;
    db.ratings = [];
    db.log = [];
    save();
    stats();
    renderImpact();
  }
};
/**
 * Dictionary mapping API provider keys to their respective helper subtexts in the UI.
 */
const HELP = {
  claude:
    "Get a key at console.anthropic.com. Calls go straight from this app to api.anthropic.com.",
  copilot:
    "Uses GitHub Models: create a GitHub personal access token with the models permission. Model IDs look like openai/gpt-4.1. For Microsoft 365 Copilot or Azure OpenAI, use Custom with your Azure endpoint.",
  custom:
    "Any OpenAI-compatible server: Ollama (http://localhost:11434/v1), LM Studio (http://localhost:1234/v1), vLLM, Azure OpenAI, etc. Key is optional for local servers.",
  openrouter:
    "Get an API key at openrouter.ai. Allows access to multiple models.",
  gemini:
    "Get a free API key at Google AI Studio (aistudio.google.com). Free tier allows accessing gemini-3.8-flash.",
};

/**
 * Dictionary mapping API provider keys to human-readable names.
 */
const NAMES = {
  claude: "Claude",
  copilot: "GitHub Copilot",
  custom: "Custom LLM",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
};

// --- Settings and Configuration Scope ---
/** In-memory representation of the loaded configuration */
let cfg,
  /** Tracks the previously selected provider before switching drop-downs */
  prevProv;

/**
 * Refreshes the API configuration UI based on the currently selected provider dropdown.
 * Pre-fills URL, Model, and Key fields if they exist in the config.
 */
function showProv() {
  const p = cfg.provider;
  prevProv = p;
  $("prov").value = p;
  
  const c = cfg[p];
  // Load specific provider details
  $("url").value = c.baseUrl || "";
  $("model").value = c.model || "";
  $("key").value = "";
  
  // Inform the user securely if an encrypted key is stored locally
  $("key").placeholder = c.hasKey
    ? "•••• saved (leave blank to keep)"
    : "not set";
    
  // BaseUrl doesn't make sense for Claude since it's hardcoded to their endpoint natively
  $("fUrl").style.display = p === "claude" ? "none" : "";
  
  $("provHelp").textContent = HELP[p];
  $("provLbl").textContent = NAMES[p] + " · " + c.model;
}

/**
 * Temporarily saves typed, unsaved inputs into the in-memory object before the user switches providers in the dropdown.
 */
function stash() {
  const p = prevProv;
  cfg[p].model = $("model").value.trim();
  if (p !== "claude") cfg[p].baseUrl = $("url").value.trim();
}

/**
 * Select input handler: '⚙ AI provider'
 * Captures form state, switches the view, and rerenders the form.
 */
$("prov").onchange = () => {
  stash();
  cfg.provider = $("prov").value;
  showProv();
};

/**
 * Asynchronously commits the in-memory configuration settings back to the main process for storage.
 */
async function saveCfg() {
  stash();
  const p = cfg.provider,
    patch = { provider: p };
    
  patch[p] = { model: cfg[p].model };
  if (p !== "claude") patch[p].baseUrl = cfg[p].baseUrl;
  
  // Only transmit a key if the user explicitly typed one in
  if ($("key").value) {
    patch.key = $("key").value;
    patch.keyFor = p;
  }
  
  // Invoke IPC to securely store the config
  await api.saveConfig(patch);
  
  // Refresh local state to grab updated 'hasKey' properties
  cfg = await api.getConfig();
  showProv();
  $("cfgMsg").textContent = "Saved ✓";
}

// Button click handlers for configuration section
$("saveCfg").onclick = saveCfg;

/**
 * Button click handler: 'Save & test'
 * Validates the connection by sending a short ping prompt to the LLM backend.
 */
$("testCfg").onclick = async () => {
  await saveCfg();
  $("cfgMsg").textContent = "Testing…";
  try {
    // Send lightweight system check
    const r = await api.complete({
      system: "Reply with the single word OK.",
      user: "ping",
    });
    // Truncate response to display visually
    $("cfgMsg").textContent =
      "Connected ✓ (" + r.text.slice(0, 20).trim() + ")";
  } catch (e) {
    // Capture underlying network or authentication failures securely
    $("cfgMsg").textContent =
      "Failed: " +
      e.message.replace(
        /^Error invoking remote method '[^']+': (Error: )?/,
        "",
      );
  }
};

// --- Initialization Sequence ---
// Populate the dashboard stats initially
stats();
renderImpact();

// Default to the very first agent
pick(AGENTS[0]);

// Load user configurations and initialize the provider settings view
api.getConfig().then((c) => {
  cfg = c;
  showProv();
  
  // Pop open the configuration menu automatically if the provider has no key and is not a local custom server
  if (!c[c.provider].hasKey && c.provider !== "custom") $("cfg").open = true;
});
