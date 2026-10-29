# After Hours — AI Mystery Room

An interactive fictional investigation game. Create a premise, examine the evidence, question the alibis, and make one final accusation.

## Run locally

Requirements: Node.js 20 or newer. MongoDB and a Gemini API key are optional for trying the local demo.

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:5000` and exposes `GET /health`.

When `MONGODB_URI` is configured, cases and sessions are stored in MongoDB. Without it, the server uses in-memory case storage and data is lost when the server stops. When `GEMINI_API_KEY` is configured, cases are generated through the Google GenAI SDK using `GEMINI_MODEL`. Without a key, the server creates a clearly identified deterministic demo mystery so the full flow can be explored. The frontend never calls Gemini.

Set `SESSION_SECRET` to a long, random value before deployment. In production, configure HTTPS, `NODE_ENV=production`, `CLIENT_URL`, a persistent MongoDB database, and server-side Gemini credentials. Image evidence uses labeled illustrations; this project does not claim to generate AI images or video.

## Project structure

- `client/` — React, Vite, React Router, responsive investigation UI.
- `server/` — Express API, session ownership, case generation and validation, optional MongoDB persistence, Gemini adapter.
- `spec.md` — Product requirements and acceptance criteria.

## API

- `GET /health`
- `POST /api/v1/cases`
- `GET /api/v1/cases/:caseId`
- `POST /api/v1/cases/:caseId/evidence/:evidenceId/examine`
- `POST /api/v1/cases/:caseId/accusation`
- `GET /api/v1/cases/:caseId/solution`

Case routes use an HttpOnly session cookie and verify case ownership. Public case responses omit the hidden solution and culprit ID; the solution endpoint is available only after an accusation has been evaluated.
