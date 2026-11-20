# Sasi Portfolio — Complete Website Owner Control, Customization & Media Management System

An enterprise-grade, high-performance web application and creative portfolio engine built with Vanilla JavaScript, CSS custom properties, zero-dependency Node.js HTTP backend, embedded SQLite3 persistent storage, and streaming multipart file upload engine.

---

## 🌟 System Architecture Overview

The system features three distinct, role-separated portals:

1. **Public Showcase Website** (`http://localhost:3000/`)
   - Dynamically renders active published theme variables (colors, fonts, radius, custom CSS).
   - Dynamically organizes and orders website sections according to owner specifications.
   - Filterable project grid, modal video player, contact inquiry form, and unified authentication modal.

2. **Owner Studio Command Center** (`http://localhost:3000/owner.html`)
   - **Persistent Save System**: Multi-stage state machine with `Save Draft`, `Live Viewport Preview`, and `Publish Changes Live` with timestamps and database persistence.
   - **Visual Theme & Design Editor**: Custom color pickers with HEX input, typography selector, border radius slider, light/dark mode presets, live component swatch preview, and custom CSS overrides.
   - **Page & Section Layout Manager**: Reorder sections (Up/Down), toggle visibility, customize titles and subtitles, and select custom background colors, gradients, or uploaded hero images.
   - **Media Library & Direct File Upload**: Drag-and-drop multipart upload engine supporting JPG, PNG, WEBP, SVG, MP4, and WEBM files up to 60MB with real-time progress bars, categorization, and 1-click "Copy URL" or "Set as Logo/Banner".
   - **Video & Content CMS**: Add and edit video projects with custom thumbnails, tags, category pills, English text, and instant publishing.
   - **Security & Sub-Admin Governance Hub**: Manage sub-admins with scoped permissions and inspect chronological audit activity logs.

3. **Super Admin Dashboard** (`http://localhost:3000/admin.html`)
   - **System Health & Storage Diagnostics**: Real-time server diagnostics (OS platform, Node.js version, process uptime, memory RSS/heap, SQLite3 database file size, and database table row counts).
   - **Database Backup & Disaster Recovery**: 1-Click JSON backup export and authenticated snapshot restore interface with schema validation.
   - **Platform Administration**: User management, media asset oversight, client inquiries inbox, and security audit logs.

---

## 🚀 Quick Start Guide

### 1. Launch with One Click
Double-click `start.bat` in the project root, or open PowerShell / Command Prompt and run:
```powershell
.\start.bat
```
`start.bat` automatically locates your Node runtime (standard `node` or local Node binary), opens `http://localhost:3000/owner.html` in your default browser, and launches the persistent server.

Or run manually:
```bash
node server.js
```

### 2. Run Comprehensive End-to-End Test Suite
Run the 20-phase verification test suite validating authentication, RBAC, theme draft/publish, section reordering, multipart file uploads, bilingual content CRUD, system diagnostics, and database backup:
```bash
node test_server.js
```
*(If Node is not in your system PATH on Windows, execute via: `& "C:\Users\acer\AppData\Local\ms-playwright-go\1.57.0\node.exe" test_server.js`)*

---

## 🔑 Default User Roles & Credentials

| Role | Username / Email | Password | Access Level & Capabilities |
| :--- | :--- | :--- | :--- |
| **👑 Website Owner** | `owner@sasiportfolio.com` (or `owner`) | `OwnerSecure2026!` | **Supreme Authority**: Full access to visual design editor, sections manager, direct file uploads, theme publishing, branding, sub-admin management, and audit logs. Protected against deletion or demotion. |
| **🛡️ Super Admin** | `admin@sasiportfolio.com` (or `admin`) | `AdminSecure2026!` | **Platform Administrator**: System health diagnostics, database backup export & restore, user status governance, media assets, and client inquiries. |
| **✏️ Junior Editor** | `editor@sasiportfolio.com` (or `editor`) | `EditorSecure2026!` | **Content Editor**: Scoped access to content creation and media upload. Administrative settings and user management restricted. |
| **👤 Public User** | `user@example.com` (or `creative_alex`) | `UserSecure2026!` | **Community Member**: Browse public showcase, stream video reels, submit contact inquiries. |

---

## 🎨 Theme & Design Customization Options

The Owner Dashboard provides a code-free visual design editor that writes directly to the SQLite `theme_settings` table:

- **Color Tokens**:
  - Primary Brand Accent (`--primary`)
  - Secondary Accent (`--cyan`)
  - Highlight Accent (`--accent`)
  - Background Dark / Canvas (`--bg-dark` / `--bg-darker`)
  - Card & Container Surface (`--bg-card`)
  - Text Primary (`--text-main`)
  - Text Secondary / Muted (`--text-muted`)
- **Typography**: Select from Google Fonts (`Plus Jakarta Sans`, `Space Grotesk`, `Outfit`, `Inter`, `Cinzel`, `Bebas Neue`, etc.).
- **Component Geometry**: Border radius controls (`0px` sharp, `8px` subtle, `14px` modern, `24px` pill).
- **Custom CSS Overrides**: Integrated CSS editor for custom animations, gradients, or vendor widgets.
- **Workflow State Controls**:
  - `Save Draft`: Saves modifications to draft state without altering the live website.
  - `Live Preview`: Opens an interactive responsive device viewport simulator (Desktop 100%, Tablet 768px, Mobile 375px).
  - `Publish Changes Live`: Atomically promotes the draft theme and settings to the public website.

---

## 📁 File Upload Engine & Media Library

- **Zero-Dependency RFC 7578 Parser**: Direct streaming multipart parser in Node.js handles file uploads up to 60MB without third-party dependencies (like Multer).
- **Supported Formats**:
  - Images: `JPG`, `JPEG`, `PNG`, `WEBP`, `SVG`
  - Video: `MP4`, `WEBM`
- **Security & Validation**: Enforces MIME-type verification, sanitized filenames with unique timestamps, and persistent disk storage in `/uploads`.
- **Media Asset Management**: Categorize by `Banners`, `Profile`, `Reels`, `Photos`, `Branding`, search by title, view file sizes in MB, copy public URLs, and assign assets directly to site branding.

---

## 🌐 Dynamic Section Management & Layout
 
 - **Reorderable Layout**: Move sections up or down; sort orders are saved in SQLite and respected by the public website.
 - **Show / Hide Toggles**: Deactivate any section with one click without deleting content.
 - **Custom Backgrounds**: Set solid dark colors, gradients, or background images per section.

---

## 🗄️ Database Schema & File Persistence

All changes persist permanently in `database.sqlite` located in the application root directory:

```sql
-- Website Theme Settings (Draft vs. Published)
CREATE TABLE theme_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preset_name TEXT DEFAULT 'Custom',
  is_draft INTEGER DEFAULT 0,
  primary_color TEXT DEFAULT '#FF5A5F',
  secondary_color TEXT DEFAULT '#00D9C0',
  accent_color TEXT DEFAULT '#F59E0B',
  bg_dark TEXT DEFAULT '#0B0E14',
  bg_card TEXT DEFAULT 'rgba(21, 27, 40, 0.7)',
  text_main TEXT DEFAULT '#F8FAFC',
  text_muted TEXT DEFAULT '#94A3B8',
  font_family TEXT DEFAULT 'Plus Jakarta Sans',
  border_radius TEXT DEFAULT '14px',
  custom_css TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic Website Sections
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT UNIQUE,
  title TEXT,
  title_ta TEXT,
  subtitle TEXT,
  subtitle_ta TEXT,
  is_visible INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  background_type TEXT DEFAULT 'color',
  background_value TEXT DEFAULT '#07090E',
  custom_css TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Media Asset Metadata
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  category TEXT DEFAULT 'General',
  size_bytes INTEGER DEFAULT 0,
  title TEXT,
  caption TEXT,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bilingual Content & Video Projects
CREATE TABLE content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  title_ta TEXT,
  slug TEXT UNIQUE,
  excerpt TEXT,
  excerpt_ta TEXT,
  content TEXT,
  content_ta TEXT,
  category TEXT,
  tags TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'image',
  thumbnail_url TEXT,
  status TEXT DEFAULT 'published',
  sort_order INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  author_id INTEGER,
  author_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Website Global Branding & Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users & Granular RBAC Permissions
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  permissions TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

---

## ⚙️ Environment Variables

Configuration options can be supplied via environment variables or a `.env` file:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATABASE_FILE` | Absolute or relative path to SQLite database | `./database.sqlite` |
| `SESSION_SECRET` | Cryptographic secret for session tokens | `sasi-portfolio-super-secret-key-2026` |

---

## 🚢 Production Deployment

### Option A: Standard Node.js Server / VPS
1. Clone repository to server.
2. Run `npm start` or start with process manager:
   ```bash
   npx pm2 start server.js --name "sasi-portfolio"
   ```
3. Set up a reverse proxy (e.g. Nginx or Caddy) pointing to `http://localhost:3000`.

### Option B: Cloud Hosting (Render / Railway / Fly.io)
- **Build Command**: none required (zero build steps, pure native ES/Node).
- **Start Command**: `node server.js`
- **Persistent Disk**: Attach a volume to `./uploads` and `./database.sqlite` to preserve uploaded media and database records across deployments.
