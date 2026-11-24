# Aide Intelligence

**대화형 수리과학 의사결정 AI · Public Preview v0.3.0**

Aide Intelligence는 사용자가 자연어로 고민을 설명하면 필요한 맥락을 대화로 확인하고, 2~5개 선택지를 구성한 뒤 Aide 효용 모델을 실제 애플리케이션 코드에서 계산해 순위·근거·3단계 실행계획을 제시하는 공개 프로토타입입니다.

## 저장소 파일

- `index.html` — ChatGPT형 대화 인터페이스, 브라우저 대화 기록, 점수 계산 및 결과 카드
- `server.mjs` — Node.js 서버, OpenAI Responses API 연결, 상태 점검 및 기본 요청 제한
- `package.json` — Node.js 실행 설정
- `render.yaml` — Render Blueprint 배포 설정
- `.env.example` — 환경변수 예시
- `PRIVACY.md` — 프리뷰 개인정보 처리 안내

## 로컬 실행

Node.js 22 이상:

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 여세요. API 키가 없는 경우 예시값을 이용하는 데모 모드로 실행됩니다.

## Render에 공개 배포하기

1. Render 계정을 만들고 GitHub 계정을 연결합니다.
2. Render Dashboard에서 **New → Blueprint**를 선택합니다.
3. `utokyomedlee-lab/aide-intelligence` 저장소를 선택하고 Blueprint를 적용합니다.
4. 배포 중 `OPENAI_API_KEY` 비밀 환경변수를 입력합니다. 기존 API 키를 넣거나, 나중에 Render 서비스의 Environment 메뉴에서 설정할 수도 있습니다.
5. 배포가 끝나면 생성된 `onrender.com` 주소를 열고 `/healthz` 응답을 확인합니다.

API 키는 GitHub에 올리지 마세요. Render의 비밀 환경변수 설정에만 입력해야 합니다.

## Aide 수리과학 효용 모델

각 선택지의 각 평가요인에 대해 앱이 다음 기여도를 계산합니다.

```
[alpha * ln(1 + max(0,a) * (1+w))]
------------------------------------------------ * S * A
[beta * ln(1 + max(0,b) * (1+R/100)) + 1e-5]
```

각 요인 기여도는 소수점 넷째 자리까지 반올림한 뒤 합산합니다. AI는 평가 변수를 제안하고, 최종 효용 점수는 브라우저의 계산 코드가 산출합니다.

## 운영 모드

- **AI 모드:** 서버 환경변수 `OPENAI_API_KEY`가 설정되면 OpenAI Responses API를 사용합니다. 기본 모델은 `gpt-6.1-sol`이며 `OPENAI_MODEL`로 바꿀 수 있습니다.
- **데모 모드:** API 키가 없으면 예시용 규칙 기반 평가값을 사용합니다. 이는 실제 생성형 AI나 실시간 시장 데이터 분석이 아닙니다.

ChatGPT 구독과 API 사용료는 별도입니다.

## 개인정보와 현재 한계

- 대화 기록은 현재 사용 중인 브라우저의 localStorage에 보관됩니다. 계정 기반 동기화가 아니며 기기 간 공유되지 않습니다.
- AI 모드에서는 답변을 만들기 위해 최근 대화 일부가 OpenAI API로 전송됩니다.
- 이 프리뷰는 Aide 서버의 대화 기록 DB에 대화를 저장하지 않습니다.
- 인증, 중앙 대화 기록 DB, CAPTCHA, 내구성 있는 전역 사용량 제한, 운영 모니터링은 아직 구현되지 않았습니다. IP별 메모리 제한은 API 남용을 완전히 방지하지 못합니다.
- 실제로 불러온 외부 시장·공공 데이터는 아직 없습니다. AI가 제안하는 수치들은 별도 근거가 없다면 추정치입니다.
- 의료·법률·금융·안전 분야의 점수는 전문가 검토를 대체하지 않습니다.

대중 홍보 또는 상업적 사용 전에는 사용자 인증, CAPTCHA, 사용량/비용 제한, 개인정보 동의, 약관 및 법률 검토, 모니터링을 추가해야 합니다.

자세한 내용은 [개인정보 안내](./PRIVACY.md)를 읽으세요.

## License

아직 오픈소스 라이선스를 선택하지 않았습니다. 저장소가 공개되어 있어도 별도 라이선스 없이 재사용·수정·재배포 권한이 자동으로 부여되는 것은 아닙니다.
