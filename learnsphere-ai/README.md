# LearnSphere AI — AI Learning Assistant + AI Mock Interview

AHGV BuildVerse 2026 prototype (Team Cold Reboot).

**Stack:** React + Vite (frontend) · FastAPI (backend) · SQLite (storage) · OpenAI API (AI).

## What works
- **Learning assistant chat** — question + lesson time + uploaded text → AI answer (saved to history).
- **AI Mock Interview** — choose role/topic/difficulty → AI questions → answer each → AI feedback
  (relevance, clarity, depth, strengths, improvements) → final summary and study recommendations.
- **Dashboard** — questions asked, interviews finished, answers reviewed, average rating, past interviews.

## Honest limitations (say these in the demo)
- No login: each browser gets an anonymous id (data is separated per browser, not per account).
- Ratings are AI-assisted coaching aids, not validated scores.
- Course list, lesson video, transcript, quiz and resource search are prepared sample content.
- SQLite on a free host is wiped on restart/redeploy.
- PDF/PPT uploads are listed but their text is not extracted (txt/md/csv/json are).

## Run locally
```bash
# 1) backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then put your OPENAI_API_KEY inside
uvicorn app.main:app --reload --port 8000 --env-file .env

# 2) frontend (new terminal, project root)
npm install
npm run dev                                            # http://localhost:5173 (proxies /api -> :8000)
```
Tests: `cd backend && pip install pytest && python -m pytest -q`

## Deploy (single service, Docker)
`docker build -t learnsphere . && docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... learnsphere`
On Render: New → Web Service → connect repo → Runtime **Docker** → add env var `OPENAI_API_KEY` →
health check path `/api/health`.

## API
`GET /api/health` · `POST /api/chat` · `GET /api/history` · `POST /api/interview/start` ·
`POST /api/interview/{id}/answer` · `POST /api/interview/{id}/finish` · `GET /api/interview/sessions` ·
`GET /api/interview/{id}` · `GET /api/stats` · `DELETE /api/me/data`
(all except health need header `X-User-Id`; the frontend sends it automatically).
