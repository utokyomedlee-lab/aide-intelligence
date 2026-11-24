# Aide Intelligence

**A chat-first decision-support prototype powered by the Aide Mathematical Utility Model.**

Aide Intelligence lets people describe a decision in natural language, compare 2–5 options, and review a transparent utility-score ranking with assumptions, risks, and a three-step action plan.

> **Status:** Public prototype (v0.2.0). This is not yet a production-ready public AI service.

## Get the source

The complete v0.2.0 project is included in [aide-intelligence-v0.2.0-chat.zip](./aide-intelligence-v0.2.0-chat.zip). Download the ZIP from this repository and extract it.

The package contains:
- `index.html` — Korean chat interface and browser-side Aide formula engine
- `server.mjs` — Node.js web server and optional server-side OpenAI Responses API adapter
- `package.json` — runtime script and Node.js requirement
- `.env.example` — environment variable template
- `.gitignore` — local secret and dependency exclusions
- A full setup guide in the package's `README.md`

## Run locally

Requirements: Node.js 20 or newer.

1. Download and extract the ZIP.
2. Open a terminal in the extracted project folder.
3. Run:

```bash
npm start
```

4. Visit http://localhost:3000.

## Operating modes

### Local demo
Works without an API key. It uses rule-based example templates and calculates the Aide utility score. It is a demonstration mode, not a generative AI model and not a live-data service.

### AI chat
Set `OPENAI_API_KEY` as a **server-side environment variable** and restart the server. The default model is `gpt-6.2-sol`; override it with `OPENAI_MODEL` when needed.

Never put an API key in `index.html`, client-side JavaScript, a committed `.env` file, or a public issue. API usage and billing are separate from ChatGPT subscriptions.

## The Aide utility model

For each evaluation factor, the app calculates:

```
(alpha * ln(1 + max(0,a) * (1+w)))
------------------------------------------------ * S * A
 beta * ln(1 + max(0,b) * (1+R/100)) + 1e-5
```

The app applies the supplied variable bounds and rounds each factor contribution to four decimal places before summing.

## Important limitations

- Local demo values are illustrative template estimates, not measured big-data results.
- AI mode can propose estimates, but those estimates are not verified facts unless supported by external evidence.
- The prototype does not yet connect to external market, public-sector, or research databases.
- Scores are relative model outputs, not probabilities of success or guarantees.
- Health, legal, financial, and safety decisions require appropriate professional review.
- Do not deploy the API-backed server publicly without adding authentication, request quotas, monitoring, and abuse protections. The included server is intended for local evaluation.

## Development

This repository currently distributes the complete v0.2.0 source as a ZIP archive. See the package README for implementation notes and setup.

## License

No open-source license has been applied yet. Public visibility does not by itself grant permission to reuse, modify, or redistribute the code.