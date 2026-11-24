# Aide Intelligence

**대화형 수리과학 의사결정 AI 프로토타입**

Aide Intelligence는 사용자가 자연어로 고민을 설명하면 2~5개 선택지를 구성하고, Aide 효용 모델로 상대 점수를 계산해 최적 대안·비교·근거·3단계 실행계획을 대화형으로 제시합니다.

<details>
<summary>English</summary>

Aide Intelligence is a chat-first decision-support prototype built around the Aide Mathematical Utility Model. It proposes alternatives, explains assumptions and risks, and calculates comparative utility scores in application code.

</details>

## Current release

**v0.3.0 — Public preview**

- ChatGPT-style Korean interface
- Local browser conversation history (no user accounts or server-side chat database yet)
- Optional server-side OpenAI Responses API integration
- Local rule-based demo mode when no API key is configured
- Aide formula calculated by application code
- Basic request-size, timeout, security-header and per-IP rate controls
- Render Blueprint deployment configuration

## Download source

[Download Aide Intelligence v0.3.0 source ZIP](./aide-intelligence-v0.3.0.zip)

The archive contains the full Node.js application, browser UI, server adapter, privacy notice, environment template and setup instructions.

## Deploy publicly on Render

The root-level `render.yaml` is configured for a Render Blueprint.

1. Create or sign in to a Render account.
2. Connect your GitHub account to Render.
3. In Render, choose **New → Blueprint**.
4. Select `utokyomedlee-lab/aide-intelligence` and apply the Blueprint.
5. Optionally set `OPENAI_API_KEY` as a secret environment variable to enable real AI responses. Without it, the service runs in local demo mode.
6. After deployment, open the generated `onrender.com` URL and check `/healthz`.

The Blueprint uses a Render Free instance for initial testing. Free services can spin down when idle and are not intended for production reliability. See [Render free-instance limitations](https://render.com/docs/free).

## AI configuration

The server-side default model is `gpt-6.2-sol`. Set `OPENAI_API_KEY` only in Render's Environment/Secrets settings. Never place a real key in browser code, source control, public issues, or the ZIP.

ChatGPT subscriptions and OpenAI API billing are separate.

## Data and privacy

- Conversation history is saved in the current browser's local storage. It is not an account-based history and does not sync across devices.
- When AI mode is enabled, the current conversation messages are sent to the OpenAI API for response generation.
- This app does not intentionally store conversation transcripts in an Aide-operated server database.
- Do not enter government identifiers, passwords, bank details, confidential business information, or sensitive health data.
- Read [the prototype privacy notice](./aide-intelligence-v0.3.0.zip) (inside the archive: `aide-intelligence-chat/PRIVACY.md`).

## Important limitations

This is an early public preview, not a production-hardened AI service. It does not yet have user sign-in, a central conversation database, external market/public-data connectors, robust bot prevention, or a full privacy-consent workflow. Basic in-memory rate limiting is not a guarantee against API abuse. Before wider public promotion, add a CAPTCHA or sign-in layer, durable per-user/global quotas, monitoring, spending alerts, a reviewed privacy policy and terms of use.

The demo's numerical values are initial estimates, not independently verified big-data results. Utility scores are relative model outputs, not probabilities or guarantees. For medical, legal, financial or safety decisions, obtain qualified professional review.

## Project files

The full source code is currently distributed in the v0.3.0 ZIP archive. The repository root contains this deployment configuration and project README.

## License

No open-source license has been selected yet. Public visibility does not automatically grant permission to reuse, modify or redistribute the code.
