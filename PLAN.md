# PLAN.md — Inventory & Order Management System

Production-ready, containerized full-stack app for managing Products, Customers, Orders, and Inventory tracking.

## Tech Stack
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2 (PostgreSQL via psycopg2)
- **Frontend:** React 18 (JavaScript) + Vite + React Router + Axios
- **Database:** PostgreSQL 16
- **Containerization:** Docker (multi-stage) + Docker Compose
- **Frontend serving (prod):** Nginx

## Architecture
```
shrey_ethara/
├── docker-compose.yml          # orchestrates db + backend + frontend
├── .env.example                # root env for compose
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, router registration, startup
│   │   ├── config.py           # settings from env vars
│   │   ├── database.py         # engine, session, Base
│   │   ├── models.py           # Product, Customer, Order, OrderItem
│   │   ├── schemas.py          # Pydantic request/response models
│   │   ├── seed.py             # optional demo data
│   │   └── routers/
│   │       ├── products.py
│   │       ├── customers.py
│   │       ├── orders.py
│   │       └── dashboard.py
│   ├── Dockerfile             # production-ready, slim base
│   ├── .dockerignore
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js
    │   ├── components/         # Layout, Navbar, Modal, Toast, forms, tables
    │   ├── pages/              # Dashboard, Products, Customers, Orders
    │   ├── App.jsx
    │   └── main.jsx
    ├── Dockerfile             # multi-stage build -> nginx
    ├── nginx.conf
    ├── .dockerignore
    ├── package.json
    └── .env.example
```

## Data Model
- **Product**: id, name, sku (unique), price, quantity, created_at
- **Customer**: id, full_name, email (unique), phone, created_at
- **Order**: id, customer_id (FK), total_amount, status, created_at
- **OrderItem**: id, order_id (FK), product_id (FK), quantity, unit_price (supports multiple products per order)

## Business Rules (must implement)
- [x] Product SKU unique
- [x] Customer email unique
- [x] Product quantity cannot be negative
- [x] Orders blocked if inventory insufficient
- [x] Creating an order auto-reduces stock
- [x] Total order amount computed by backend
- [x] Proper error handling + HTTP status codes
- [x] Validate all request data (Pydantic)

## API Endpoints
- Products: POST/GET /products, GET/PUT/DELETE /products/{id}
- Customers: POST/GET /customers, GET/DELETE /customers/{id}
- Orders: POST/GET /orders, GET/DELETE /orders/{id} (delete restores stock)
- Dashboard: GET /dashboard/stats (totals + low stock)
- Health: GET /health

## Frontend Pages
- Dashboard (totals: products/customers/orders + low-stock list)
- Products (list, add, edit, delete)
- Customers (list, add, delete)
- Orders (list, create with line items, view details, delete)

---

## WORK LOG

### 2026-06-01
- [x] Read PDF + image instructions
- [x] Created PLAN.md
- [x] Backend scaffold (config, db, models, schemas)
- [x] Backend routers (products, customers, orders, dashboard)
- [x] Backend Docker (Dockerfile, .dockerignore, .env.example)
- [x] Frontend scaffold (Vite, routing, API client)
- [x] Frontend pages + components (Dashboard, Products, Customers, Orders, Toast, Modal, Layout)
- [x] Frontend Docker + nginx (multi-stage, /api proxy, SPA fallback)
- [x] docker-compose.yml + root .env.example + .gitignore
- [x] README with run + deploy instructions
- [x] Frontend production build verified (vite build OK)
- [x] Backend business-logic E2E verified — 23/23 tests pass against SQLite
      (unique SKU/email, insufficient stock 400, auto stock reduction,
       backend-computed total, stock restored on order delete, validation 422s)
- [ ] Full `docker compose up` verification — BLOCKED: Docker Desktop daemon
      not running. Code + compose config validated; needs daemon to do the
      live containerized run.

## RESUME NOTES
If work is interrupted, check the WORK LOG checkboxes above. Next unchecked item is where to resume.

### 2026-06-01 — Auth added (user request)
- [x] Backend: User model, bcrypt hashing, JWT (pyjwt), /auth/register, /auth/login, /auth/me
- [x] Backend: all business routers protected behind get_current_user (401 without token)
- [x] Frontend: AuthContext + token persistence + axios interceptor (auto-logout on 401)
- [x] Frontend: Login + Signup pages (split-screen), ProtectedRoute, logout + user chip in topbar
- [x] Verified live: 401 without token, register/login work, protected routes return 200 with token
- [x] Docs/env updated (SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES) across README, compose, .env.example
- Note: new requirements (pyjwt, bcrypt) added to backend/requirements.txt

### 2026-06-01 — DEPLOYED ✅ (all 4 deliverables done)
- [x] GitHub repo: https://github.com/brahmanrohit/Inventory-Manager
- [x] Docker Hub image: https://hub.docker.com/r/rohitethara/inventory-backend (tags latest, 1.0.0)
- [x] Backend live on Render + managed PostgreSQL: https://inventory-manager-2huq.onrender.com
      (verified /health, register→Postgres write, dashboard→Postgres read, 401 without token)
- [x] Frontend live on Vercel: https://inventory-manager-chi-seven.vercel.app
      (public after disabling Deployment Protection; bundle points at Render backend)
- [x] CORS verified: preflight echoes Vercel origin; cross-origin login 200 OK
- Optional hardening left: set Render CORS_ORIGINS to exact Vercel URL (currently * — works,
  but explicit origin is best practice).

### Current status (2026-06-01)
Application is CODE-COMPLETE and verified at the code level. Remaining steps are
operational, not coding:
1. Start Docker Desktop, then run `docker compose up --build` from project root
   to confirm the live 3-container stack (db + backend + frontend).
2. Deployment (needs user accounts — see EXTERNAL RESOURCES below).

To resume the containerized test: ensure Docker Desktop is running, then:
  cd project root → `docker compose up --build` → open http://localhost:3000

## EXTERNAL RESOURCES NEEDED FROM USER (for deployment)
1. **GitHub** account + new empty repo URL (to push code).
2. **Docker Hub** account username (to push backend image) — for the "Docker Hub image link" deliverable.
3. **Render/Railway/Fly.io** account (backend hosting) — connect GitHub repo.
4. **Vercel/Netlify** account (frontend hosting) — connect GitHub repo.
Local development needs only Docker Desktop installed.
