# Deployment Guide — Inventory & POS System

Stack: **Laravel** (backend API) + **React/Vite** (frontend) + **SQLite** (or MySQL).

---

## 1. Backend (Laravel API)

Requirements: PHP 8.2+, Composer.

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env          # if no .env yet
php artisan key:generate       # sets APP_KEY
php artisan migrate --force    # create all tables
```

Edit `backend/.env` for production:
```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

# Database — SQLite (simple) …
DB_CONNECTION=sqlite
# (create the file: touch database/database.sqlite  — must be writable)
# … or MySQL (recommended for production):
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_DATABASE=inventory
# DB_USERNAME=...
# DB_PASSWORD=...

# ABA PayWay (live)
PAYWAY_BASE_URL=https://checkout.payway.com.kh
PAYWAY_MERCHANT_ID=your_live_merchant_id
PAYWAY_API_KEY=your_live_api_key
PAYWAY_RETURN_URL=https://api.yourdomain.com/api/payway/callback
```

- Point your web server's document root to **`backend/public`**.
- Make `backend/storage`, `backend/bootstrap/cache`, and the SQLite file **writable**.
- Whitelist your server's public IP in the ABA PayWay portal.

Optional production caching:
```bash
php artisan config:cache && php artisan route:cache
```

---

## 2. Frontend (React)

Before building, set the API URL so the app talks to your hosted backend.

Create `frontend/.env`:
```
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

Build:
```bash
cd frontend
npm install
npm run build      # outputs static files to frontend/dist
```

Host the contents of **`frontend/dist`** on any static host (Netlify, Vercel,
cPanel, Nginx, or the same server). For single-page routing, make the server
fall back to `index.html` for unknown routes.

---

## 3. CORS
Backend must allow the frontend's domain. Check `backend/config/cors.php`
(`allowed_origins`) includes `https://yourdomain.com`.

---

## 4. First login
Create the master admin (run once on the server):
```bash
cd backend
php artisan tinker --execute="\App\Models\User::create(['name'=>'Admin','email'=>'admin@yourdomain.com','password'=>bcrypt('CHANGE_ME'),'role'=>'master_admin','active'=>true]);"
```
Then log in and create staff/admin accounts from **User Management**.

---

## Quick checklist
- [ ] backend `.env` filled (APP_KEY, DB, PayWay), `migrate --force` run
- [ ] web root → `backend/public`; storage writable
- [ ] `frontend/.env` → `VITE_API_BASE_URL`, then `npm run build`
- [ ] serve `frontend/dist` with SPA fallback
- [ ] CORS allows the frontend domain
- [ ] ABA PayWay: live keys + server IP whitelisted
- [ ] master admin created
