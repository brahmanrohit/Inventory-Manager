# Inventory & Order Management System

A production-ready, fully containerized full-stack application for managing **products, customers, orders, and inventory tracking**.

| Layer | Technology |
|-------|------------|
| Frontend | React 18 (JavaScript) + Vite + React Router + Axios |
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| Database | PostgreSQL 16 |
| Containerization | Docker + Docker Compose |
| Frontend serving | Nginx (multi-stage build) |

---

## ✨ Features

**Authentication** — JWT-based sign-up & login · passwords hashed with bcrypt · all business APIs protected behind a bearer token · token persisted client-side with auto-logout on expiry
**Products** — create, list, view, update, delete · unique SKU enforcement · stock badges
**Customers** — create, list, view, delete · unique email enforcement
**Orders** — multi-product orders · automatic stock deduction · stock restored on delete · backend-computed totals
**Dashboard** — totals for products / customers / orders + low-stock list

### Business rules enforced by the backend
- Product SKU must be unique (`409` on conflict)
- Customer email must be unique (`409` on conflict)
- Product quantity can never go negative (DB check constraint + validation)
- Orders are rejected when stock is insufficient (`400`)
- Creating an order automatically reduces stock; deleting an order restores it
- The order total is always calculated server-side from current prices
- All inputs validated via Pydantic; proper HTTP status codes throughout

---

## 🚀 Quick Start (Docker Compose — recommended)

Prerequisite: **Docker Desktop**.

```bash
# 1. From the project root, create your env file
cp .env.example .env          # (Windows PowerShell: copy .env.example .env)

# 2. Build and start everything
docker compose up --build
```

Then open:
- **Frontend:** http://localhost:3000
- **Backend API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

The database is seeded with a few demo products/customers on first run (toggle with `SEED_ON_STARTUP`).

Stop and remove containers (keeps the DB volume):
```bash
docker compose down
```
Wipe everything including data:
```bash
docker compose down -v
```

---

## 🧑‍💻 Local Development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Point at a local Postgres (or run just the db via: docker compose up db)
# Set env vars or create backend/.env from backend/.env.example
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173  (proxies /api -> http://localhost:8000)
```

---

## 📡 API Reference

Base URL: `/` (e.g. `http://localhost:8000`)

> All Products/Customers/Orders/Dashboard endpoints require an `Authorization: Bearer <token>` header. Obtain a token from `/auth/register` or `/auth/login`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create an account → returns token + user |
| POST | `/auth/login` | Log in → returns token + user |
| GET | `/auth/me` | Get the current authenticated user |

### Products
| Method | Path | Description |
|--------|------|-------------|
| POST | `/products` | Create a product |
| GET | `/products` | List products |
| GET | `/products/{id}` | Get a product |
| PUT | `/products/{id}` | Update a product |
| DELETE | `/products/{id}` | Delete a product |

### Customers
| Method | Path | Description |
|--------|------|-------------|
| POST | `/customers` | Create a customer |
| GET | `/customers` | List customers |
| GET | `/customers/{id}` | Get a customer |
| DELETE | `/customers/{id}` | Delete a customer |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Create an order (reduces stock) |
| GET | `/orders` | List orders |
| GET | `/orders/{id}` | Get order details |
| DELETE | `/orders/{id}` | Delete an order (restores stock) |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Totals + low-stock products |
| GET | `/health` | Health check |

**Example — create a product**
```bash
curl -X POST http://localhost:8000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Webcam","sku":"WC-009","price":49.99,"quantity":30}'
```

**Example — create an order**
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"items":[{"product_id":1,"quantity":2}]}'
```

---

## ⚙️ Environment Variables

**Root / Compose (`.env`)** — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGINS`, `LOW_STOCK_THRESHOLD`, `SEED_ON_STARTUP`

**Backend (`backend/.env`)** — same as above plus `DATABASE_URL` (full URL for cloud hosting; overrides the individual `POSTGRES_*` values), `SECRET_KEY` (**set a strong random value in production** — signs JWT tokens), and `ACCESS_TOKEN_EXPIRE_MINUTES`. Postgres `postgres://` URLs are auto-normalized to `postgresql://`.

**Frontend (`frontend/.env`)** — `VITE_API_BASE_URL` (build-time; `/api` for compose, or your live backend URL for cloud).

No credentials are hardcoded; all are read from environment variables.

---

## ☁️ Deployment Guide

### Backend → Render / Railway / Fly.io
1. Push this repo to GitHub.
2. Create a new **Web Service** from the repo, root directory `backend/`.
3. It builds from `backend/Dockerfile` (the container listens on `$PORT`).
4. Provision a managed PostgreSQL instance and set **`DATABASE_URL`** on the service.
5. Set **`CORS_ORIGINS`** to your deployed frontend URL (e.g. `https://your-app.vercel.app`).

### Frontend → Vercel / Netlify
1. Import the repo, set the project root to `frontend/`.
2. Build command `npm run build`, output directory `dist`.
3. Set env var **`VITE_API_BASE_URL`** to your live backend URL (e.g. `https://your-backend.onrender.com`).
4. Redeploy so the value is baked into the build.

### Docker Hub (backend image deliverable)
```bash
docker build -t <your-dockerhub-username>/inventory-backend:latest ./backend
docker push <your-dockerhub-username>/inventory-backend:latest
```

---

## 📦 Submission Checklist
- [ ] GitHub repository link (frontend + backend)
- [ ] Docker Hub image link for the backend image
- [ ] Live frontend deployment URL
- [ ] Live backend API URL

---

## 🗂️ Project Structure
```
.
├── docker-compose.yml
├── .env.example
├── PLAN.md                 # work log / resume notes
├── backend/                # FastAPI app, Dockerfile, requirements
│   └── app/{main,config,database,models,schemas,seed}.py + routers/
└── frontend/               # React + Vite app, Dockerfile, nginx.conf
    └── src/{api,components,pages}/
```
