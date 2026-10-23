# Sasi Creative Studio — Multi-Tier Web Application

A modern, high-performance, responsive creative portfolio and management platform featuring three strictly separated interfaces:
1. **Public Main Website** (`http://localhost:3000/`)
2. **Admin Dashboard** (`http://localhost:3000/admin.html`)
3. **Owner Command Center** (`http://localhost:3000/owner.html`)

Powered by **Node.js** with embedded **SQLite3** database, secure scrypt password hashing, session cookies, and server-side Role-Based Access Control (RBAC).

---

## 🚀 Quick Start Guide

### 1. Launch the Server
Double-click `start.bat` or run:
```bash
node server.js
```
The server will automatically initialize `database.sqlite` (or memory fallback), run migrations, seed initial demo accounts, and begin listening on **`http://localhost:3000`**.

### 2. Run Automated Security & RBAC Test Suite
```bash
node test_server.js
```
Validates all 13 security suites (privilege escalation prevention, owner immutability, scoped admin permissions, session cookies, and CRUD).

---

## 🔑 Default Login Credentials

| Role | Username / Email | Password | Access Level & Capabilities |
| :--- | :--- | :--- | :--- |
| **👑 Website Owner** | `owner@sasiportfolio.com` (or `owner`) | `OwnerSecure2026!` | **Supreme Authority**: Full system analytics, create/edit/delete admins, assign permissions, edit branding, view activity logs. Unalterable and immune to deletion. |
| **🛡️ Lead Admin** | `admin@sasiportfolio.com` (or `lead_admin`) | `AdminSecure2026!` | **Full Admin**: Manage content, manage public users, upload media, view stats, manage contact feedback. |
| **✏️ Junior Editor** | `editor@sasiportfolio.com` (or `editor_john`) | `EditorSecure2026!` | **Scoped Admin**: Content & media management only. User management and analytics are restricted by the owner. |
| **👤 Public User** | `user@example.com` (or `creative_alex`) | `UserSecure2026!` | **Public Member**: Access public showcase, search works, submit project inquiries. |

> *Tip: The Login modal on the main website features a 1-click demo credential autofiller for instantaneous testing.*

---

## 🌐 Three Dedicated Interfaces

### 1. Main Public Website (`/` or `index.html`)
- **Modern Cinematic Aesthetic**: Dynamic glassmorphism, glowing ambient gradients, and fluid typography.
- **Instant Search & Category Filters**: Real-time keyword filtering across projects, categories (`Event Aftermovie`, `Color Grading`, `Music Video`, `Tutorials`), and tags.
- **Interactive Project Modal**: Instant video streaming with custom media player, view counter increment, tags, and full project story.
- **About Creator Section**: Portfolio timeline, live statistics (50+ Projects, 4yrs Experience, 12 Awards), and interactive skill badges.
- **Interactive Contact Form**: Client inquiry submission that writes directly to the SQLite database.
- **Unified Authentication**: Tabbed modal for signing in or registering public accounts.

### 2. Admin Dashboard (`/admin.html`)
- **Dashboard Overview**: Key performance indicators (Total Posts, Registered Users, Video Views, Client Messages).
- **Post & Project Manager**: Full CRUD (Create, Read, Update, Delete), slug generation, category assignment, draft/publish toggling.
- **Registered User Governance**: View community members and toggle active/suspended status (strictly barred from altering admins/owner).
- **Media Asset Library**: Upload, preview, copy URLs, and manage assets.
- **Inquiry Management**: Inbox for reading, marking as replied, or deleting client messages.
- **Owner Permission Enforcement**: If an admin's permission is revoked by the owner, that section is cleanly locked with an explanation notice and server-enforced `403 Forbidden`.

### 3. Owner Command Center (`/owner.html`)
- **Executive Analytics**: Global statistics, server uptime monitor, database status, and node health.
- **Admin Governance Hub**:
  - List all administrators with active permission badges.
  - Create new admins with custom permission flags:
    - `can_manage_content`
    - `can_manage_users`
    - `can_upload_media`
    - `can_view_stats`
    - `can_manage_feedback`
  - Modify permissions, reset admin passwords, or revoke/delete admin accounts.
  - **Owner Protection**: The owner account is highlighted as `OWNER (SUPREME)` and cannot be deleted, demoted, or edited by other admins.
- **Branding & Global Configuration**: Update Website Name, Tagline, Hero Title, Accent Colors, Contact Info, Social URLs, and Maintenance Mode in real-time.
- **System Audit Trail**: Complete activity stream logging all logins, content edits, permissions changes, and contact submissions with IP addresses and timestamps.

---

## 🛡️ Security Architecture

1. **Zero Plaintext Passwords**: Hashed using Node's cryptographic `scrypt` algorithm with unique 16-byte cryptographic salts and timing-safe equality comparison.
2. **Server-Side Authorization**: Dashboard links are not just hidden; every `/api/owner/*` and `/api/admin/*` endpoint strictly verifies the session cookie/token and checks granular permission flags before execution.
3. **Privilege Escalation Prevention**: The public `/api/auth/register` endpoint strictly enforces `role: 'user'` on the server.
4. **Anti-Lockout Protection**: Deletion or permission demotion requests targeting the Owner ID return `403 Forbidden` at the database middleware layer.

---

## 🗄️ Database Schema (SQLite)

- **`users`**: `id`, `username`, `email`, `password_hash`, `salt`, `role`, `permissions`, `avatar`, `status`, `created_at`, `last_login`
- **`content`**: `id`, `title`, `slug`, `excerpt`, `content`, `category`, `tags`, `media_url`, `media_type`, `thumbnail_url`, `status`, `views`, `author_id`, `author_name`, `created_at`, `updated_at`
- **`media`**: `id`, `name`, `url`, `media_type`, `size_bytes`, `uploaded_by`, `created_at`
- **`contact_messages`**: `id`, `name`, `email`, `subject`, `message`, `status`, `created_at`
- **`settings`**: `key`, `value`, `updated_at`
- **`activity_logs`**: `id`, `user_id`, `username`, `role`, `action`, `details`, `ip`, `created_at`
- **`sessions`**: `token`, `user_id`, `expires_at`

---

## 🚢 Deployment Guide

### Deploying to Render / Railway / Heroku
1. Push this repository to GitHub.
2. Create a new **Web Service** on [Render](https://render.com) or [Railway](https://railway.app).
3. Set **Build Command**: `npm install` (or leave empty as there are zero external dependencies).
4. Set **Start Command**: `node server.js`
5. Add Environment Variables:
   - `PORT=3000` (or leave managed by host)
   - `SESSION_SECRET=your-random-production-secret`

### Deploying to VPS (Ubuntu / Debian)
```bash
git clone <repo-url> /var/www/sasi-portfolio
cd /var/www/sasi-portfolio
pm2 start server.js --name "sasi-portfolio"
pm2 startup
pm2 save
```
Configure Nginx reverse proxy to forward port 80/443 to `http://localhost:3000`.
