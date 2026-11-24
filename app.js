const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "aide-intelligence-v03";
let conversations = readHistory();
let activeId = conversations[0]?.id || null;
let isBusy = false;
let aiEnabled = false;

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
  } catch {
    toast("브라우저 저장 공간이 부족합니다.");
  }
}

function currentConversation() {
  return conversations.find((item) => item.id === activeId);
}

function ensureConversation() {
  if (currentConversation()) return;
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: "새 대화",
    messages: [],
    updated: Date.now()
  };
  conversations.unshift(item);
  activeId = item.id;
  persist();
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.style.display = "block";
  window.setTimeout(() => {
    element.style.display = "none";
  }, 2300);
}

function setMode(enabled) {
  aiEnabled = Boolean(enabled);
  $("modeDot").classList.toggle("live", aiEnabled);
  $("modeLabel").textContent = aiEnabled ? "AI 연결됨" : "데모 모드";
}

async function checkHealth() {
  try {
    const response = await fetch("/healthz", { cache: "no-store" });
    const result = await response.json();
    setMode(result.aiEnabled === true);
  } catch {
    setMode(false);
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function renderHistory() {
  const root = $("history");
  root.replaceChildren();
  [...conversations]
    .sort((a, b) => b.updated - a.updated)
    .forEach((conversation) => {
      const button = element("button", conversation.id === activeId ? "active" : "", conversation.title || "새 대화");
      button.addEventListener("click", () => {
        activeId = conversation.id;
        renderAll();
        $("sidebar").classList.remove("open");
      });
      root.append(button);
    });
}

function appendMessage(role, content) {
  const conversation = currentConversation();
  conversation.messages.push({ role, content });
  conversation.updated = Date.now();
  if (role === "user" && conversation.title === "새 대화") {
    conversation.title = content.slice(0, 24) + (content.length > 24 ? "…" : "");
  }
  persist();
  renderAll();
}

function addMessageNode(role, content) {
  const row = element("div", "message " + role);
  row.append(element("div", "avatar", role === "user" ? "나" : "A"));
  const bubble = element("div", "bubble");
  if (role === "user") {
    bubble.textContent = content;
  } else {
    renderAssistantContent(bubble, content);
  }
  row.append(bubble);
  $("messages").append(row);
}

function renderAll() {
  renderHistory();
  renderMessages();
}

function renderMessages() {
  const conversation = currentConversation();
  $("messages").replaceChildren();
  $("welcome").style.display = conversation && conversation.messages.length ? "none" : "block";
  if (!conversation) return;
  conversation.messages.forEach((message) => addMessageNode(message.role, message.content));
  if (isBusy) {
    const row = element("div", "message");
    row.append(element("div", "avatar", "A"));
    const dots = element("div", "typing");
    dots.append(element("i"), element("i"), element("i"));
    row.append(dots);
    $("messages").append(row);
  }
}

function bounded(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function formatScore(value) {
  return Number(value).toFixed(4);
}

function calculate(options, alphaValue, betaValue) {
  const alpha = bounded(alphaValue, 0.5, 2, 1);
  const beta = bounded(betaValue, 0.5, 2, 1);
  const ranked = options.slice(0, 5).map((option) => {
    let total = 0;
    const factors = (Array.isArray(option.factors) ? option.factors : []).slice(0, 8).map((factor) => {
      const a = bounded(factor.a, 0, 100, 0);
      const w = bounded(factor.w, -0.5, 1, 0);
      const b = bounded(factor.b, 0.1, 100, 0.1);
      const risk = bounded(factor.R, 0, 100, 0);
      const uniqueness = bounded(factor.S, 0.1, 1, 0.5);
      const advantage = bounded(factor.A, 0.1, 2, 1);
      const gain = alpha * Math.log(1 + Math.max(0, a) * (1 + w));
      const cost = beta * Math.log(1 + Math.max(0, b) * (1 + risk / 100)) + 0.00001;
      const contribution = round4((gain / cost) * uniqueness * advantage);
      total += contribution;
      return { ...factor, contribution };
    });
    return { ...option, factors, score: round4(total) };
  });
  ranked.sort((left, right) => right.score - left.score);
  return { alpha, beta, ranked };
}

function addCell(row, value, header = false) {
  const cell = element(header ? "th" : "td", "", value);
  row.append(cell);
  return cell;
}

function renderAssistantContent(container, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    container.textContent = raw;
    return;
  }

  if (data.clarification_required || !Array.isArray(data.options) || data.options.length < 2) {
    const question = data.clarifying_question || data.message || "정확한 비교를 위해 한 가지 정보가 더 필요합니다.";
    container.textContent = question;
    return;
  }

  const report = calculate(data.options, data.alpha, data.beta);
  const best = report.ranked[0];
  container.append(element("p", "", data.summary || "입력한 정보를 바탕으로 대안을 비교했습니다."));

  const card = element("section", "analysis-card");
  const head = element("div", "analysis-head");
  head.append(element("div", "tag", "AIDE OPTIMAL DECISION"));
  head.append(element("h3", "", "🎯 최적 결단 · " + (best.name || "1순위 선택지")));
  head.append(element("div", "subtle", "종합 효용 지수 " + formatScore(best.score)));
  card.append(head);

  const body = element("div", "analysis-body");
  const metrics = element("div", "metric-row");
  [[ "성장 민감도", report.alpha.toFixed(2) ], [ "위험 회피도", report.beta.toFixed(2) ], [ "비교 대안", report.ranked.length + "개" ]].forEach(([label, value]) => {
    const metric = element("div", "metric");
    metric.append(element("small", "", label), element("b", "", value));
    metrics.append(metric);
  });
  body.append(metrics);

  body.append(element("b", "", "📊 대안별 효용 비교"));
  const table = element("table", "rank-table");
  const header = element("tr");
  ["순위", "선택지", "효용 지수", "핵심 기대 이득"].forEach((text) => addCell(header, text, true));
  table.append(header);
  report.ranked.forEach((option, index) => {
    const row = element("tr");
    addCell(row, index + 1);
    addCell(row, option.name || "대안 " + (index + 1));
    addCell(row, formatScore(option.score));
    addCell(row, option.summary || "—");
    table.append(row);
  });
  body.append(table);

  body.append(element("b", "", "🔍 데이터 기반 근거"));
  body.append(element("p", "", data.rationale || "각 평가요인의 기대 이득, 비용, 리스크, 대체 불가도와 상대적 우위도를 반영했습니다."));

  body.append(element("b", "", "✅ 즉시 실행 액션 플랜"));
  const plan = element("ol", "plan");
  const actions = Array.isArray(data.action_plan) ? data.action_plan.slice(0, 3) : [];
  actions.forEach((action) => plan.append(element("li", "", action)));
  body.append(plan);

  body.append(element("b", "", "평가요인별 계산 상세"));
  report.ranked.forEach((option) => {
    const details = element("details");
    details.style.margin = "9px 0";
    details.append(element("summary", "", option.name + " · " + formatScore(option.score)));
    const factorTable = element("table", "rank-table");
    const factorHeader = element("tr");
    ["평가 요인", "기여 점수", "이득·리스크 설명"].forEach((text) => addCell(factorHeader, text, true));
    factorTable.append(factorHeader);
    option.factors.forEach((factor) => {
      const row = element("tr");
      addCell(row, factor.name || "평가 요인");
      addCell(row, formatScore(factor.contribution));
      addCell(row, factor.benefit || factor.risk_note || "추정 평가");
      factorTable.append(row);
    });
    details.append(factorTable);
    body.append(details);
  });

  const notes = Array.isArray(data.caveats) ? data.caveats.join(" / ") : "";
  const dataNote = data.data_status === "verified"
    ? "제공된 근거 자료를 반영했습니다. 검증 범위를 확인하세요."
    : "AI가 입력 정보를 바탕으로 추정한 수치이며, 검증된 빅데이터 결과가 아닙니다.";
  body.append(element("div", "disclaimer", dataNote + (notes ? " 유의사항: " + notes : "")));
  card.append(body);
  container.append(card);
}

function demoReply(text) {
  const business = /사업|창업|자본|투자|매출/.test(text);
  const options = business ? [
    {
      name: "소규모 시장 검증",
      summary: "초기 비용을 줄이고 실제 고객 반응 확인",
      factors: [
        { name: "시장 검증", benefit: "고객 반응을 빠르게 확인", a: 76, w: 0.5, b: 22, R: 25, S: 0.8, A: 1.3 },
        { name: "초기 비용", benefit: "작은 범위로 운영비 관리", a: 58, w: 0.4, b: 18, R: 15, S: 0.6, A: 1.3 },
        { name: "확장 가능성", benefit: "검증 후 규모 확대 가능", a: 63, w: 0.2, b: 30, R: 30, S: 0.6, A: 1.1 }
      ]
    },
    {
      name: "처음부터 정식 출시",
      summary: "성장 기회가 크지만 초기 손실 위험도 큼",
      factors: [
        { name: "성장 기회", a: 90, w: 0.7, b: 70, R: 62, S: 0.6, A: 1 },
        { name: "시장 검증", a: 35, w: 0.2, b: 45, R: 55, S: 0.5, A: 0.9 },
        { name: "운영 효율", a: 60, w: 0.1, b: 58, R: 38, S: 0.5, A: 1 }
      ]
    },
    {
      name: "파트너와 공동 추진",
      summary: "자원과 위험을 분담하고 실행 역량 보완",
      factors: [
        { name: "역량 보완", a: 72, w: 0.3, b: 28, R: 28, S: 0.8, A: 1.2 },
        { name: "비용 부담", a: 67, w: 0.2, b: 24, R: 24, S: 0.6, A: 1.1 },
        { name: "통제력", a: 40, w: -0.1, b: 22, R: 35, S: 0.5, A: 0.8 }
      ]
    }
  ] : [
    {
      name: "현재 상태 유지",
      summary: "안정성을 확보하고 선택권 보존",
      factors: [
        { name: "안정성", a: 78, w: 0.2, b: 15, R: 10, S: 0.7, A: 1.1 },
        { name: "성장 기회", a: 35, w: -0.1, b: 18, R: 15, S: 0.5, A: 0.8 },
        { name: "전환 비용", a: 70, w: 0.1, b: 12, R: 10, S: 0.5, A: 1.1 }
      ]
    },
    {
      name: "즉시 전환·실행",
      summary: "성장 기회는 크지만 불확실성과 전환비용 동반",
      factors: [
        { name: "성장 기회", a: 82, w: 0.5, b: 45, R: 55, S: 0.6, A: 1.1 },
        { name: "기회 포착", a: 75, w: 0.6, b: 35, R: 48, S: 0.7, A: 1.1 },
        { name: "전환 부담", a: 32, w: 0.1, b: 40, R: 45, S: 0.5, A: 0.9 }
      ]
    },
    {
      name: "단계적 검증 후 전환",
      summary: "작은 시험 후 데이터로 전환 여부 결정",
      factors: [
        { name: "선택권 보존", a: 72, w: 0.3, b: 22, R: 18, S: 0.8, A: 1.3 },
        { name: "성장 기회", a: 68, w: 0.3, b: 28, R: 25, S: 0.7, A: 1.1 },
        { name: "검증 비용", a: 62, w: 0.2, b: 18, R: 15, S: 0.6, A: 1.2 }
      ]
    }
  ];
  return JSON.stringify({
    alpha: 1.15,
    beta: 1.2,
    summary: "데모 모드의 예시 평가값입니다. 실제 시장·직무 데이터로 검증한 결과가 아니므로, 사용자의 구체적인 조건을 입력해 조정해야 합니다.",
    options,
    rationale: "초기 단계에서는 되돌릴 수 있는 작은 실험으로 불확실성을 줄이고 큰 비용 투입 전에 실제 반응을 확인하는 접근이 유리할 수 있습니다. 이는 예시 데이터에 기반한 시연 결과입니다.",
    action_plan: [
      "목표와 반드시 지켜야 할 제약조건을 세 가지 이내로 정리합니다.",
      "가장 낮은 비용으로 핵심 가정을 검증할 작은 실험을 실행합니다.",
      "관찰 결과를 기록하고 효용 변수와 순위를 다시 계산합니다."
    ],
    caveats: ["데모 추정치이며 실제 시장·환경 데이터가 연결되어 있지 않습니다.", "중요한 결정은 실제 비용·확률·전문가 의견을 확인해야 합니다."],
    data_status: "estimated"
  });
}

async function sendMessage() {
  const input = $("prompt");
  const text = input.value.trim();
  if (!text || isBusy) return;
  ensureConversation();
  input.value = "";
  input.style.height = "auto";
  appendMessage("user", text);
  isBusy = true;
  $("send").disabled = true;
  renderMessages();

  try {
    let responseText;
    if (aiEnabled) {
      const messages = currentConversation().messages.slice(-12);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI 요청에 실패했습니다.");
      responseText = result.content;
    } else {
      responseText = demoReply(text);
    }
    appendMessage("assistant", responseText);
  } catch (error) {
    appendMessage("assistant", "요청을 처리하지 못했습니다: " + error.message + " 다시 시도하거나 서비스 운영자에게 알려주세요.");
  } finally {
    isBusy = false;
    $("send").disabled = false;
    renderMessages();
    input.focus();
  }
}

function newConversation() {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: "새 대화",
    messages: [],
    updated: Date.now()
  };
  conversations.unshift(item);
  activeId = item.id;
  persist();
  renderAll();
}

$("send").addEventListener("click", sendMessage);
$("prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
$("prompt").addEventListener("input", (event) => {
  event.target.style.height = "auto";
  event.target.style.height = Math.min(event.target.scrollHeight, 180) + "px";
});
$("newChat").addEventListener("click", newConversation);
$("menu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    $("prompt").value = button.dataset.prompt;
    $("prompt").focus();
  });
});

if (!currentConversation()) newConversation();
else renderAll();
checkHealth();
