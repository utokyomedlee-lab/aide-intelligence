import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-6.1-sol";
const BODY_LIMIT = 48 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 12;
const counters = new Map();

const AIDE_INSTRUCTIONS = `
당신은 Aide Intelligence의 한국어 의사결정 분석 AI입니다. 사용자가 자연어로 설명한 문제를 분석하고, 가능한 선택지를 2~5개 도출한 뒤 아래 효용 모델을 적용할 수 있도록 구조화된 JSON만 출력하세요. JSON 바깥의 설명, 마크다운 코드 펜스는 쓰지 마세요.

효용 기여도 = [alpha * ln(1 + max(0,a) * (1+w))] / [beta * ln(1 + max(0,b) * (1+R/100)) + 1e-5] * S * A
각 선택지의 효용 점수는 앱 코드가 이 공식을 계산합니다. 당신은 계산 점수를 직접 생성하거나 1순위를 임의로 정하지 말고 평가 변수를 제안하세요.

JSON 스키마:
{
 "clarification_required": boolean,
 "clarifying_question": string,
 "alpha": number,
 "beta": number,
 "summary": string,
 "options": [
  {
   "name": string,
   "summary": string,
   "factors": [
    {
     "name": string,
     "benefit": string,
     "risk_note": string,
     "a": number,
     "w": number,
     "b": number,
     "R": number,
     "S": number,
     "A": number
    }
   ]
  }
 ],
 "rationale": string,
 "action_plan": [string, string, string],
 "caveats": [string],
 "data_status": "estimated" | "verified"
}

규칙:
- alpha와 beta는 각각 0.5~2.0 사이. 성장·기회 중심이면 alpha를, 안전·건강·생계·원금보존 중심이면 beta를 높이되 요약에 이유를 설명합니다.
- 선택지는 2~5개. 각 선택지에는 평가요인 2~5개.
- a: 0~100, w: -0.5~1.0, b: 0.1~100, R: 0~100, S: 0.1~1.0, A: 0.1~2.0.
- 변수 추정치는 문제 맥락에 맞게 보수적으로 설정하고, 증거 없는 숫자를 객관적 사실처럼 쓰지 않습니다.
- 실시간 시장·환경 정보나 공공 데이터에 접근하지 못했으면 data_status는 "estimated"로 설정하고 caveats에 명시합니다. 출처가 명확한 사용자 제공 데이터만 사용해도 그 범위를 설명합니다.
- 핵심 변수가 없어 결론을 바꿀 수 있는 경우에는 clarification_required=true, options=[]로 하고 가장 중요한 확인 질문 딱 하나를 clarifying_question에 씁니다.
- 의료·법률·금융·안전 문제는 위해를 줄이는 제약을 별도 caveats에 명시하고 전문 검토를 권합니다.
- action_plan은 실행 가능한 3단계로 씁니다.
- 사용자에게 복잡한 점수 입력을 요구하지 말고 자연어를 이해해 평가요인을 제안합니다.
`;

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  securityHeaders(res);
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress) || "unknown";
  return ip.slice(0, 100);
}

function allowed(req) {
  const now = Date.now();
  const key = getClientKey(req);
  let entry = counters.get(key);
  if (!entry || now - entry.start > WINDOW_MS) entry = { start: now, count: 0 };
  entry.count += 1;
  counters.set(key, entry);
  if (counters.size > 5000) {
    for (const [k, v] of counters) if (now - v.start > WINDOW_MS) counters.delete(k);
  }
  return entry.count <= MAX_REQUESTS;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("요청이 너무 큽니다. 대화를 줄여 다시 시도해 주세요.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractOutputText(data) {
  const parts = [];
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/healthz") {
      return send(res, 200, { ok: true, aiEnabled: Boolean(API_KEY), model: MODEL, version: "0.3.0" });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(path.join(HERE, "index.html"));
      return send(res, 200, html, "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/privacy") {
      const html = await readFile(path.join(HERE, "PRIVACY.md"), "utf8");
      const safe = html.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return send(res, 200, "<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Aide Privacy</title><body style=\"max-width:760px;margin:48px auto;padding:0 20px;font:16px/1.7 system-ui;background:#101318;color:#edf2f7\"><pre style=\"white-space:pre-wrap;font:inherit\">" + safe + "</pre><p><a style=\"color:#60d7c6\" href=\"/\">Aide로 돌아가기</a></p></body></html>", "text/html; charset=utf-8");
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      if (!API_KEY) return send(res, 503, { error: "AI 서버가 아직 연결되지 않았습니다. 데모 모드로 사용할 수 있습니다." });
      if (!allowed(req)) return send(res, 429, { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "요청 형식이 올바르지 않습니다." }); }
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
        return send(res, 400, { error: "대화 메시지 수가 올바르지 않습니다." });
      }
      const messages = body.messages.map(m => {
        if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 4000) {
          throw new Error("메시지 형식 또는 길이가 올바르지 않습니다.");
        }
        return { role: m.role, content: m.content };
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      let upstream;
      try {
        upstream = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            instructions: AIDE_INSTRUCTIONS,
            input: messages,
            text: { format: { type: "json_object" } },
            max_output_tokens: 2600,
            store: false
          }),
          signal: controller.signal
        });
      } catch (error) {
        if (error.name === "AbortError") return send(res, 504, { error: "AI 응답 시간이 초과되었습니다. 다시 시도해 주세요." });
        return send(res, 502, { error: "AI 서비스에 연결하지 못했습니다." });
      } finally {
        clearTimeout(timeout);
      }
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const status = upstream.status === 429 ? 429 : 502;
        return send(res, status, { error: upstream.status === 429 ? "AI 서비스 사용량 한도에 도달했습니다." : "AI 서비스 요청이 실패했습니다. 운영자가 API 설정을 확인해야 합니다." });
      }
      const content = extractOutputText(result);
      if (!content) return send(res, 502, { error: "AI가 비어 있는 응답을 반환했습니다." });
      return send(res, 200, { content, model: MODEL });
    }
    if (req.method === "GET") return send(res, 404, { error: "페이지를 찾을 수 없습니다." });
    return send(res, 405, { error: "지원하지 않는 요청입니다." });
  } catch (error) {
    const status = error.message.includes("너무 큽니다") ? 413 : error.message.includes("메시지 형식") ? 400 : 500;
    return send(res, status, { error: error.message || "서버 내부 오류가 발생했습니다." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Aide Intelligence 0.3.0 listening on ${PORT}`);
});
