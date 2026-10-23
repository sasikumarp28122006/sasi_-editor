// ============================================================================
// ENTERPRISE MULTI-TIER WEB APPLICATION SERVER
// Roles: Owner, Admin (with fine-grained permissions), Public User
// Engine: Node.js HTTP Server + Built-in SQLite / Secure Crypto Auth
// ============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Check SQLite support
let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DatabaseSync = null;
}

// ----------------------------------------------------------------------------
// Configuration & Environment Variables
// ----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'sasi-portfolio-super-secret-key-2026';
const DB_FILE = process.env.DATABASE_FILE || path.join(__dirname, 'database.sqlite');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ----------------------------------------------------------------------------
// Database Initialization (SQLite or Robust JSON-Store Fallback)
// ----------------------------------------------------------------------------
let db = null;
let memoryStore = null;

function hashPassword(password, salt = null) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch (err) {
    return false;
  }
}

function initDatabase() {
  if (DatabaseSync) {
    try {
      db = new DatabaseSync(DB_FILE);
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          permissions TEXT DEFAULT '{}',
          avatar TEXT DEFAULT '',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        );

        CREATE TABLE IF NOT EXISTS content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          excerpt TEXT DEFAULT '',
          content TEXT DEFAULT '',
          category TEXT DEFAULT 'General',
          tags TEXT DEFAULT '',
          media_url TEXT DEFAULT '',
          media_type TEXT DEFAULT 'image',
          thumbnail_url TEXT DEFAULT '',
          status TEXT DEFAULT 'published',
          views INTEGER DEFAULT 0,
          author_id INTEGER,
          author_name TEXT DEFAULT 'Admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          media_type TEXT DEFAULT 'image',
          size_bytes INTEGER DEFAULT 0,
          uploaded_by TEXT DEFAULT 'Owner',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          subject TEXT DEFAULT 'General Inquiry',
          message TEXT NOT NULL,
          status TEXT DEFAULT 'unread',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT NOT NULL,
          role TEXT NOT NULL,
          action TEXT NOT NULL,
          details TEXT DEFAULT '',
          ip TEXT DEFAULT '127.0.0.1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `);

      seedDatabaseSQLite();
      console.log('✅ SQLite Database successfully initialized at', DB_FILE);
      return;
    } catch (err) {
      console.warn('⚠️ SQLite initialization failed, falling back to JSON storage:', err.message);
    }
  }

  // Fallback in-memory/JSON store
  initJsonStore();
}

function initJsonStore() {
  const jsonPath = path.join(__dirname, 'datastore.json');
  if (fs.existsSync(jsonPath)) {
    try {
      memoryStore = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
      memoryStore = null;
    }
  }

  if (!memoryStore) {
    memoryStore = {
      users: [],
      content: [],
      media: [],
      contact_messages: [],
      settings: {},
      activity_logs: [],
      sessions: []
    };
    seedJsonStore();
    saveJsonStore();
  }
  console.log('✅ Local Store initialized fallback mode.');
}

function saveJsonStore() {
  if (!memoryStore) return;
  const jsonPath = path.join(__dirname, 'datastore.json');
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write JSON datastore:', e.message);
  }
}

// ----------------------------------------------------------------------------
// Seeding Default Accounts and Creative Content
// ----------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  site_name: 'Sasi Editz — Cinematic Portfolio & Creative Studio',
  tagline: 'Visual Storyteller · Video Editor · Motion Graphics Designer',
  brand_color: '#FF5A5F',
  secondary_color: '#00D9C0',
  contact_email: 'sasi.editor@example.com',
  contact_phone: '+91 98765 43210',
  location: 'Chennai, India',
  hero_title: 'CRAFTING VISUAL MASTERPIECES',
  hero_subtitle: 'High-octane event aftermovies, cinematic color grading, music videos, and dynamic visual narratives.',
  maintenance_mode: 'false',
  social_instagram: 'https://instagram.com/sasi_editz',
  social_youtube: 'https://youtube.com/@sasieditz',
  social_linkedin: 'https://linkedin.com/in/sasikumar-editor'
};

function seedDatabaseSQLite() {
  const checkOwner = db.prepare('SELECT id FROM users WHERE role = ?').get('owner');
  if (!checkOwner) {
    const ownerPw = hashPassword('OwnerSecure2026!');
    const adminPw = hashPassword('AdminSecure2026!');
    const editorPw = hashPassword('EditorSecure2026!');
    const userPw = hashPassword('UserSecure2026!');

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, salt, role, permissions, avatar, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Owner: Supreme authority, cannot be removed
    insertUser.run(
      'owner',
      'owner@sasiportfolio.com',
      ownerPw.hash,
      ownerPw.salt,
      'owner',
      JSON.stringify({ all: true }),
      'sasi_profile.jpg',
      'active'
    );

    // 2. Lead Admin: Full admin privileges granted by owner
    insertUser.run(
      'lead_admin',
      'admin@sasiportfolio.com',
      adminPw.hash,
      adminPw.salt,
      'admin',
      JSON.stringify({
        can_manage_content: true,
        can_manage_users: true,
        can_upload_media: true,
        can_view_stats: true,
        can_manage_feedback: true
      }),
      '',
      'active'
    );

    // 3. Junior Editor: Scoped permissions
    insertUser.run(
      'editor_john',
      'editor@sasiportfolio.com',
      editorPw.hash,
      editorPw.salt,
      'admin',
      JSON.stringify({
        can_manage_content: true,
        can_manage_users: false,
        can_upload_media: true,
        can_view_stats: false,
        can_manage_feedback: false
      }),
      '',
      'active'
    );

    // 4. Sample Public User
    insertUser.run(
      'creative_alex',
      'alex@example.com',
      userPw.hash,
      userPw.salt,
      'user',
      '{}',
      '',
      'active'
    );

    // Initial Content items
    const insertContent = db.prepare(`
      INSERT INTO content (title, slug, excerpt, content, category, tags, media_url, media_type, thumbnail_url, status, views, author_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertContent.run(
      'TAKSHAK 2026 — College Event Aftermovie',
      'takshak-2026-aftermovie',
      'High-energy 4K college fest recap with dynamic beat-synced transitions and atmospheric color grading.',
      'Full coverage of the premier cultural and technical college festival Takshak 2026. Featuring live concert footage, stage pyro effects, hyper-lapse crowd sweeps, and custom sound design mixed in 5.1 surround sound.',
      'Event Aftermovie',
      '4K, Premiere Pro, After Effects, Sound Design',
      'Event_TAKSHAK_2026.mp4',
      'video',
      'college_event_1.jpg',
      'published',
      1420,
      'Sasikumar'
    );

    insertContent.run(
      'Visual Edit Reel — Cinematic Motion & Grading',
      'visual-edit-reel-motion-grading',
      'Showcase of advanced color transformation using DaVinci Resolve Studio and custom ACES film luts.',
      'A breakdown reel highlighting commercial grading, skin-tone isolation, sky replacement, and seamless day-for-night color transformations. Rendered with custom film grain and anamorphic flares.',
      'Color Grading',
      'DaVinci Resolve, ACES, Film LUTs, Commercial',
      'VID_20260624_005809_508.mp4',
      'video',
      'college_event_2.jpg',
      'published',
      980,
      'Sasikumar'
    );

    insertContent.run(
      'City Lights — Cyberpunk Music Video',
      'city-lights-music-video',
      'Neon-soaked aesthetic featuring fast-paced cuts, beat synchronizations, and custom VFX transitions.',
      'Produced in downtown Chennai with night cinematography. Includes glitch transitions, speed ramps, and retro-futuristic CRT distortion animations.',
      'Music Video',
      'Cinematic, VFX, Music, 60FPS',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
      'image',
      'chatgpt_thumbnail_1.png',
      'published',
      745,
      'Lead Admin'
    );

    insertContent.run(
      'Mastering Speed Ramping in DaVinci Resolve',
      'mastering-speed-ramping-davinci-resolve',
      'A deep dive into optical flow motion estimation and smooth speed ramp curves for cinematic reels.',
      'Step-by-step tutorial covering frame rate mismatches, velocity curves, dynamic zoom, and adding whoosh audio markers for impactful transitions.',
      'Tutorials',
      'Tutorial, DaVinci, Speed Ramp, Education',
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=80',
      'image',
      'chatgpt_thumbnail_2.png',
      'published',
      620,
      'Sasikumar'
    );

    // Initial Media items
    const insertMedia = db.prepare(`
      INSERT INTO media (name, url, media_type, size_bytes, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertMedia.run('TAKSHAK 2026 Video', 'Event_TAKSHAK_2026.mp4', 'video', 21443536, 'Sasikumar');
    insertMedia.run('Visual Motion Reel', 'VID_20260624_005809_508.mp4', 'video', 11615538, 'Sasikumar');
    insertMedia.run('Fest Thumbnail 1', 'college_event_1.jpg', 'image', 127516, 'Sasikumar');
    insertMedia.run('Fest Thumbnail 2', 'college_event_2.jpg', 'image', 118448, 'Sasikumar');
    insertMedia.run('Sasi Profile Photo', 'sasi_profile.jpg', 'image', 168309, 'Sasikumar');

    // Initial Settings
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(k, v);
    }

    // Initial Activity Logs
    const insertLog = db.prepare(`
      INSERT INTO activity_logs (user_id, username, role, action, details, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertLog.run(1, 'owner', 'owner', 'SYSTEM_INIT', 'Owner account and database seeded successfully', '127.0.0.1');
    insertLog.run(2, 'lead_admin', 'admin', 'CONTENT_PUBLISH', 'Published TAKSHAK 2026 Aftermovie project', '127.0.0.1');
    insertLog.run(1, 'owner', 'owner', 'PERMISSION_UPDATE', 'Assigned permissions to lead_admin and editor_john', '127.0.0.1');

    // Initial Contact message
    const insertMsg = db.prepare(`
      INSERT INTO contact_messages (name, email, subject, message, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertMsg.run(
      'Anand Rao (Studio Red)',
      'anand@studiored.in',
      'Commercial Video Production Collaboration',
      'Hi Sasi, we loved your TAKSHAK aftermovie reel! We have a corporate brand film shoot scheduled for next month in Chennai and would love to hire you for lead editing and color grading. Let us know your availability.',
      'unread'
    );
  }
}

function seedJsonStore() {
  const ownerPw = hashPassword('OwnerSecure2026!');
  const adminPw = hashPassword('AdminSecure2026!');
  const editorPw = hashPassword('EditorSecure2026!');
  const userPw = hashPassword('UserSecure2026!');

  memoryStore.users = [
    {
      id: 1,
      username: 'owner',
      email: 'owner@sasiportfolio.com',
      password_hash: ownerPw.hash,
      salt: ownerPw.salt,
      role: 'owner',
      permissions: { all: true },
      avatar: 'sasi_profile.jpg',
      status: 'active',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      username: 'lead_admin',
      email: 'admin@sasiportfolio.com',
      password_hash: adminPw.hash,
      salt: adminPw.salt,
      role: 'admin',
      permissions: {
        can_manage_content: true,
        can_manage_users: true,
        can_upload_media: true,
        can_view_stats: true,
        can_manage_feedback: true
      },
      avatar: '',
      status: 'active',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      username: 'editor_john',
      email: 'editor@sasiportfolio.com',
      password_hash: editorPw.hash,
      salt: editorPw.salt,
      role: 'admin',
      permissions: {
        can_manage_content: true,
        can_manage_users: false,
        can_upload_media: true,
        can_view_stats: false,
        can_manage_feedback: false
      },
      avatar: '',
      status: 'active',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      username: 'creative_alex',
      email: 'alex@example.com',
      password_hash: userPw.hash,
      salt: userPw.salt,
      role: 'user',
      permissions: {},
      avatar: '',
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];

  memoryStore.content = [
    {
      id: 1,
      title: 'TAKSHAK 2026 — College Event Aftermovie',
      slug: 'takshak-2026-aftermovie',
      excerpt: 'High-energy 4K college fest recap with dynamic beat-synced transitions and atmospheric color grading.',
      content: 'Full coverage of the premier cultural and technical college festival Takshak 2026. Featuring live concert footage, stage pyro effects, hyper-lapse crowd sweeps, and custom sound design mixed in 5.1 surround sound.',
      category: 'Event Aftermovie',
      tags: '4K, Premiere Pro, After Effects, Sound Design',
      media_url: 'Event_TAKSHAK_2026.mp4',
      media_type: 'video',
      thumbnail_url: 'college_event_1.jpg',
      status: 'published',
      views: 1420,
      author_name: 'Sasikumar',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Visual Edit Reel — Cinematic Motion & Grading',
      slug: 'visual-edit-reel-motion-grading',
      excerpt: 'Showcase of advanced color transformation using DaVinci Resolve Studio and custom ACES film luts.',
      content: 'A breakdown reel highlighting commercial grading, skin-tone isolation, sky replacement, and seamless day-for-night color transformations. Rendered with custom film grain and anamorphic flares.',
      category: 'Color Grading',
      tags: 'DaVinci Resolve, ACES, Film LUTs, Commercial',
      media_url: 'VID_20260624_005809_508.mp4',
      media_type: 'video',
      thumbnail_url: 'college_event_2.jpg',
      status: 'published',
      views: 980,
      author_name: 'Sasikumar',
      created_at: new Date().toISOString()
    }
  ];

  memoryStore.media = [
    { id: 1, name: 'TAKSHAK 2026 Video', url: 'Event_TAKSHAK_2026.mp4', media_type: 'video', size_bytes: 21443536, uploaded_by: 'Sasikumar' },
    { id: 2, name: 'Visual Motion Reel', url: 'VID_20260624_005809_508.mp4', media_type: 'video', size_bytes: 11615538, uploaded_by: 'Sasikumar' },
    { id: 3, name: 'Fest Thumbnail 1', url: 'college_event_1.jpg', media_type: 'image', size_bytes: 127516, uploaded_by: 'Sasikumar' }
  ];

  memoryStore.settings = { ...DEFAULT_SETTINGS };

  memoryStore.activity_logs = [
    { id: 1, user_id: 1, username: 'owner', role: 'owner', action: 'SYSTEM_INIT', details: 'Owner initialized database', ip: '127.0.0.1', created_at: new Date().toISOString() }
  ];

  memoryStore.contact_messages = [
    {
      id: 1,
      name: 'Anand Rao (Studio Red)',
      email: 'anand@studiored.in',
      subject: 'Commercial Video Production Collaboration',
      message: 'Hi Sasi, we loved your TAKSHAK aftermovie reel! We have a corporate brand film shoot scheduled for next month in Chennai and would love to hire you for lead editing and color grading.',
      status: 'unread',
      created_at: new Date().toISOString()
    }
  ];
}

// ----------------------------------------------------------------------------
// Log Activity Helper
// ----------------------------------------------------------------------------
function logActivity(userId, username, role, action, details, ip = '127.0.0.1') {
  if (db) {
    try {
      db.prepare(`
        INSERT INTO activity_logs (user_id, username, role, action, details, ip)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId || 0, username || 'Anonymous', role || 'guest', action, details || '', ip);
    } catch (e) {
      console.error('Error logging activity:', e.message);
    }
  } else if (memoryStore) {
    memoryStore.activity_logs.unshift({
      id: memoryStore.activity_logs.length + 1,
      user_id: userId || 0,
      username: username || 'Anonymous',
      role: role || 'guest',
      action,
      details: details || '',
      ip,
      created_at: new Date().toISOString()
    });
    saveJsonStore();
  }
}

// ----------------------------------------------------------------------------
// Session & Auth Utilities
// ----------------------------------------------------------------------------
function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  if (db) {
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
  } else if (memoryStore) {
    memoryStore.sessions.push({ token, user_id: user.id, expires_at: expiresAt });
    saveJsonStore();
  }
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  const now = Date.now();

  if (db) {
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);
    if (!session || session.expires_at < now) {
      if (session) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }
    const user = db.prepare('SELECT id, username, email, role, permissions, avatar, status FROM users WHERE id = ?').get(session.user_id);
    if (!user || user.status !== 'active') return null;
    try {
      user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      user.permissions = {};
    }
    return user;
  } else if (memoryStore) {
    const session = memoryStore.sessions.find(s => s.token === token);
    if (!session || session.expires_at < now) {
      memoryStore.sessions = memoryStore.sessions.filter(s => s.token !== token);
      return null;
    }
    const user = memoryStore.users.find(u => u.id === session.user_id);
    if (!user || user.status !== 'active') return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions || {},
      avatar: user.avatar || '',
      status: user.status
    };
  }
  return null;
}

function destroySession(token) {
  if (db) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  } else if (memoryStore) {
    memoryStore.sessions = memoryStore.sessions.filter(s => s.token !== token);
    saveJsonStore();
  }
}

// ----------------------------------------------------------------------------
// HTTP Request / Response Helpers
// ----------------------------------------------------------------------------
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', err => reject(err));
  });
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function authenticate(req) {
  const cookies = parseCookies(req);
  let token = cookies.auth_token;
  if (!token && req.headers.authorization) {
    const auth = req.headers.authorization;
    if (auth.startsWith('Bearer ')) token = auth.substring(7);
  }
  return getSessionUser(token);
}

// ----------------------------------------------------------------------------
// STATIC FILE SERVING
// ----------------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support Video Partial Content (Range Requests) for smooth streaming
    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      fileStream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ----------------------------------------------------------------------------
// API ROUTE HANDLERS
// ----------------------------------------------------------------------------

async function handleApiRequest(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  const ip = getClientIp(req);
  const currentUser = authenticate(req);

  // 1. PUBLIC AUTH: REGISTER
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return sendJson(res, 400, { success: false, message: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { success: false, message: 'Password must be at least 6 characters' });
    }

    // Role MUST ALWAYS BE 'user' for public registration (prevent privilege escalation)
    const role = 'user';
    const permissions = '{}';
    const { hash, salt } = hashPassword(password);

    if (db) {
      try {
        const check = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (check) {
          return sendJson(res, 409, { success: false, message: 'Username or email already exists' });
        }
        const result = db.prepare(`
          INSERT INTO users (username, email, password_hash, salt, role, permissions, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
        `).run(username, email, hash, salt, role, permissions);

        const newUser = { id: Number(result.lastInsertRowid), username, email, role, permissions: {} };
        const token = createSession(newUser);
        logActivity(newUser.id, username, role, 'USER_REGISTER', `New user registered: ${username}`, ip);

        return sendJson(res, 201, {
          success: true,
          message: 'Account created successfully',
          token,
          user: newUser
        }, { 'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    } else if (memoryStore) {
      const exists = memoryStore.users.find(u => u.username === username || u.email === email);
      if (exists) {
        return sendJson(res, 409, { success: false, message: 'Username or email already exists' });
      }
      const newUser = {
        id: memoryStore.users.length + 1,
        username,
        email,
        password_hash: hash,
        salt,
        role: 'user',
        permissions: {},
        avatar: '',
        status: 'active',
        created_at: new Date().toISOString()
      };
      memoryStore.users.push(newUser);
      saveJsonStore();
      const token = createSession(newUser);
      logActivity(newUser.id, username, 'user', 'USER_REGISTER', `New user registered: ${username}`, ip);

      return sendJson(res, 201, {
        success: true,
        message: 'Account created successfully',
        token,
        user: { id: newUser.id, username, email, role: 'user', permissions: {} }
      }, { 'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
    }
  }

  // 2. AUTH: LOGIN
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { login, password } = body;

    if (!login || !password) {
      return sendJson(res, 400, { success: false, message: 'Login credentials are required' });
    }

    let user = null;
    if (db) {
      user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    } else if (memoryStore) {
      user = memoryStore.users.find(u => u.username === login || u.email === login);
    }

    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Invalid username/email or password' });
    }

    if (user.status !== 'active') {
      return sendJson(res, 403, { success: false, message: 'This account has been suspended or deactivated.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return sendJson(res, 401, { success: false, message: 'Invalid username/email or password' });
    }

    // Update last login
    if (db) {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    }

    const token = createSession(user);
    logActivity(user.id, user.username, user.role, 'USER_LOGIN', `User logged in from ${ip}`, ip);

    let permissions = user.permissions;
    if (typeof permissions === 'string') {
      try { permissions = JSON.parse(permissions); } catch (e) { permissions = {}; }
    }

    return sendJson(res, 200, {
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: permissions || {},
        avatar: user.avatar || ''
      }
    }, { 'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
  }

  // 3. AUTH: LOGOUT
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    let token = cookies.auth_token;
    if (token) destroySession(token);
    if (currentUser) {
      logActivity(currentUser.id, currentUser.username, currentUser.role, 'USER_LOGOUT', 'User logged out', ip);
    }
    return sendJson(res, 200, { success: true, message: 'Logged out successfully' }, {
      'Set-Cookie': 'auth_token=; Path=/; HttpOnly; Max-Age=0'
    });
  }

  // 4. AUTH: CURRENT USER PROFILE
  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, 401, { success: false, message: 'Not authenticated' });
    }
    return sendJson(res, 200, {
      success: true,
      user: currentUser
    });
  }

  // 5. PUBLIC CONTENT: LIST & SEARCH
  if (pathname === '/api/public/content' && method === 'GET') {
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let items = [];
    if (db) {
      let sql = "SELECT * FROM content WHERE status = 'published'";
      const params = [];

      if (category && category !== 'all') {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (query) {
        sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
        const like = `%${query}%`;
        params.push(like, like, like);
      }
      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      items = db.prepare(sql).all(...params);
    } else if (memoryStore) {
      items = memoryStore.content.filter(c => {
        if (c.status !== 'published') return false;
        if (category && category !== 'all' && c.category.toLowerCase() !== category.toLowerCase()) return false;
        if (query) {
          const q = query.toLowerCase();
          return c.title.toLowerCase().includes(q) ||
                 c.content.toLowerCase().includes(q) ||
                 (c.tags && c.tags.toLowerCase().includes(q));
        }
        return true;
      }).slice(0, limit);
    }
    return sendJson(res, 200, { success: true, count: items.length, data: items });
  }

  // 6. PUBLIC CONTENT: DETAIL & VIEW COUNT INCREMENT
  if (pathname.startsWith('/api/public/content/') && method === 'GET') {
    const id = pathname.replace('/api/public/content/', '');
    let item = null;
    if (db) {
      item = db.prepare('SELECT * FROM content WHERE id = ? OR slug = ?').get(id, id);
      if (item) {
        db.prepare('UPDATE content SET views = views + 1 WHERE id = ?').run(item.id);
        item.views += 1;
      }
    } else if (memoryStore) {
      item = memoryStore.content.find(c => c.id.toString() === id || c.slug === id);
      if (item) {
        item.views = (item.views || 0) + 1;
        saveJsonStore();
      }
    }
    if (!item) return sendJson(res, 404, { success: false, message: 'Content not found' });
    return sendJson(res, 200, { success: true, data: item });
  }

  // 7. PUBLIC SETTINGS & BRANDING
  if (pathname === '/api/public/settings' && method === 'GET') {
    let settings = {};
    if (db) {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      rows.forEach(r => { settings[r.key] = r.value; });
    } else if (memoryStore) {
      settings = { ...memoryStore.settings };
    }
    return sendJson(res, 200, { success: true, data: settings });
  }

  // 8. PUBLIC CONTACT FORM SUBMISSION
  if (pathname === '/api/public/contact' && method === 'POST') {
    const body = await parseBody(req);
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return sendJson(res, 400, { success: false, message: 'Name, email, and message are required' });
    }

    if (db) {
      db.prepare(`
        INSERT INTO contact_messages (name, email, subject, message, status)
        VALUES (?, ?, ?, ?, 'unread')
      `).run(name, email, subject || 'General Inquiry', message);
    } else if (memoryStore) {
      memoryStore.contact_messages.push({
        id: memoryStore.contact_messages.length + 1,
        name,
        email,
        subject: subject || 'General Inquiry',
        message,
        status: 'unread',
        created_at: new Date().toISOString()
      });
      saveJsonStore();
    }
    logActivity(0, name, 'guest', 'CONTACT_MESSAGE', `New inquiry from ${email}: ${subject || 'General'}`, ip);
    return sendJson(res, 201, { success: true, message: 'Message sent successfully! We will get back to you soon.' });
  }

  // ==========================================================================
  // OWNER-ONLY API ENDPOINTS (Strict Supreme Authority)
  // Admins or Users CANNOT access these endpoints. Verified server-side.
  // ==========================================================================
  if (pathname.startsWith('/api/owner/')) {
    if (!currentUser || currentUser.role !== 'owner') {
      return sendJson(res, 403, {
        success: false,
        message: 'Forbidden: Owner level access required. This incident has been logged.'
      });
    }

    // A. Owner Analytics & Statistics
    if (pathname === '/api/owner/analytics' && method === 'GET') {
      let stats = {};
      if (db) {
        const totalUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").get().count;
        const totalAdmins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
        const totalContent = db.prepare('SELECT COUNT(*) AS count FROM content').get().count;
        const publishedContent = db.prepare("SELECT COUNT(*) AS count FROM content WHERE status = 'published'").get().count;
        const totalViews = db.prepare('SELECT SUM(views) AS sum FROM content').get().sum || 0;
        const unreadMessages = db.prepare("SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'unread'").get().count;
        const totalMedia = db.prepare('SELECT COUNT(*) AS count FROM media').get().count;

        stats = {
          totalUsers,
          totalAdmins,
          totalContent,
          publishedContent,
          totalViews,
          unreadMessages,
          totalMedia,
          serverUptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          databaseType: 'SQLite3'
        };
      } else if (memoryStore) {
        stats = {
          totalUsers: memoryStore.users.filter(u => u.role === 'user').length,
          totalAdmins: memoryStore.users.filter(u => u.role === 'admin').length,
          totalContent: memoryStore.content.length,
          publishedContent: memoryStore.content.filter(c => c.status === 'published').length,
          totalViews: memoryStore.content.reduce((sum, c) => sum + (c.views || 0), 0),
          unreadMessages: memoryStore.contact_messages.filter(m => m.status === 'unread').length,
          totalMedia: memoryStore.media.length,
          serverUptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          databaseType: 'MemoryStore'
        };
      }
      return sendJson(res, 200, { success: true, data: stats });
    }

    // B. Manage Admins: List All Admins
    if (pathname === '/api/owner/admins' && method === 'GET') {
      let admins = [];
      if (db) {
        admins = db.prepare(`
          SELECT id, username, email, role, permissions, status, created_at, last_login
          FROM users WHERE role = 'admin' OR role = 'owner' ORDER BY id ASC
        `).all();
        admins.forEach(a => {
          try { a.permissions = JSON.parse(a.permissions); } catch (e) { a.permissions = {}; }
        });
      } else if (memoryStore) {
        admins = memoryStore.users.filter(u => u.role === 'admin' || u.role === 'owner').map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          permissions: u.permissions || {},
          status: u.status,
          created_at: u.created_at,
          last_login: u.last_login
        }));
      }
      return sendJson(res, 200, { success: true, data: admins });
    }

    // C. Manage Admins: Create New Admin
    if (pathname === '/api/owner/admins' && method === 'POST') {
      const body = await parseBody(req);
      const { username, email, password, permissions } = body;

      if (!username || !email || !password) {
        return sendJson(res, 400, { success: false, message: 'Username, email, and initial password are required' });
      }

      const { hash, salt } = hashPassword(password);
      const permsJson = JSON.stringify(permissions || {
        can_manage_content: true,
        can_manage_users: false,
        can_upload_media: true,
        can_view_stats: false,
        can_manage_feedback: false
      });

      if (db) {
        try {
          const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
          if (exists) return sendJson(res, 409, { success: false, message: 'Username or email already exists' });

          const result = db.prepare(`
            INSERT INTO users (username, email, password_hash, salt, role, permissions, status)
            VALUES (?, ?, ?, ?, 'admin', ?, 'active')
          `).run(username, email, hash, salt, permsJson);

          logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_CREATE', `Created new admin: ${username}`, ip);
          return sendJson(res, 201, {
            success: true,
            message: `Admin ${username} created successfully`,
            adminId: Number(result.lastInsertRowid)
          });
        } catch (err) {
          return sendJson(res, 500, { success: false, message: err.message });
        }
      } else if (memoryStore) {
        const exists = memoryStore.users.find(u => u.username === username || u.email === email);
        if (exists) return sendJson(res, 409, { success: false, message: 'Username or email already exists' });

        const newAdmin = {
          id: memoryStore.users.length + 1,
          username,
          email,
          password_hash: hash,
          salt,
          role: 'admin',
          permissions: JSON.parse(permsJson),
          avatar: '',
          status: 'active',
          created_at: new Date().toISOString()
        };
        memoryStore.users.push(newAdmin);
        saveJsonStore();
        logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_CREATE', `Created new admin: ${username}`, ip);

        return sendJson(res, 201, { success: true, message: `Admin ${username} created successfully`, adminId: newAdmin.id });
      }
    }

    // D. Manage Admins: Update Admin Permissions or Status
    if (pathname.startsWith('/api/owner/admins/') && method === 'PUT') {
      const adminId = parseInt(pathname.replace('/api/owner/admins/', ''), 10);
      const body = await parseBody(req);
      const { permissions, status, password } = body;

      // Protection: Owner cannot be altered by admin APIs, and nobody can demote owner
      let targetUser = null;
      if (db) {
        targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
      } else if (memoryStore) {
        targetUser = memoryStore.users.find(u => u.id === adminId);
      }

      if (!targetUser) return sendJson(res, 404, { success: false, message: 'Admin account not found' });
      if (targetUser.role === 'owner') {
        return sendJson(res, 400, { success: false, message: 'Owner account cannot be modified via admin manager' });
      }

      if (db) {
        if (permissions) {
          db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), adminId);
        }
        if (status) {
          db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, adminId);
        }
        if (password && password.trim().length >= 6) {
          const { hash, salt } = hashPassword(password);
          db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, adminId);
        }
      } else if (memoryStore) {
        if (permissions) targetUser.permissions = permissions;
        if (status) targetUser.status = status;
        if (password && password.trim().length >= 6) {
          const { hash, salt } = hashPassword(password);
          targetUser.password_hash = hash;
          targetUser.salt = salt;
        }
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_UPDATE', `Updated permissions/status for admin ${targetUser.username}`, ip);
      return sendJson(res, 200, { success: true, message: `Admin ${targetUser.username} updated successfully` });
    }

    // E. Manage Admins: Delete Admin
    if (pathname.startsWith('/api/owner/admins/') && method === 'DELETE') {
      const adminId = parseInt(pathname.replace('/api/owner/admins/', ''), 10);

      let targetUser = null;
      if (db) {
        targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
      } else if (memoryStore) {
        targetUser = memoryStore.users.find(u => u.id === adminId);
      }

      if (!targetUser) return sendJson(res, 404, { success: false, message: 'Admin account not found' });
      if (targetUser.role === 'owner') {
        return sendJson(res, 403, { success: false, message: 'Security Violation: Cannot delete the website Owner account!' });
      }

      if (db) {
        db.prepare('DELETE FROM users WHERE id = ?').run(adminId);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminId);
      } else if (memoryStore) {
        memoryStore.users = memoryStore.users.filter(u => u.id !== adminId);
        memoryStore.sessions = memoryStore.sessions.filter(s => s.user_id !== adminId);
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_DELETE', `Deleted admin account ${targetUser.username}`, ip);
      return sendJson(res, 200, { success: true, message: `Admin ${targetUser.username} removed successfully` });
    }

    // F. Owner Settings: Update Website Branding & Config
    if (pathname === '/api/owner/settings' && method === 'PUT') {
      const body = await parseBody(req);
      if (db) {
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        for (const [key, value] of Object.entries(body)) {
          updateSetting.run(key, String(value));
        }
      } else if (memoryStore) {
        Object.assign(memoryStore.settings, body);
        saveJsonStore();
      }
      logActivity(currentUser.id, currentUser.username, 'owner', 'SETTINGS_UPDATE', 'Updated site branding and system settings', ip);
      return sendJson(res, 200, { success: true, message: 'Settings and branding updated successfully' });
    }

    // G. Owner Activity Logs
    if (pathname === '/api/owner/activity-logs' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      let logs = [];
      if (db) {
        logs = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?').all(limit);
      } else if (memoryStore) {
        logs = memoryStore.activity_logs.slice(0, limit);
      }
      return sendJson(res, 200, { success: true, data: logs });
    }
  }

  // ==========================================================================
  // ADMIN DASHBOARD APIS (Accessible to Admin & Owner, subject to fine-grained permissions)
  // ==========================================================================
  if (pathname.startsWith('/api/admin/')) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Admin authorization required' });
    }

    const perms = currentUser.role === 'owner' ? { all: true } : (currentUser.permissions || {});

    // Helper: Verify specific admin permission
    function checkAdminPerm(permKey) {
      if (currentUser.role === 'owner') return true;
      return !!perms[permKey];
    }

    // A. Admin Stats Summary
    if (pathname === '/api/admin/stats' && method === 'GET') {
      if (!checkAdminPerm('can_view_stats')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Cannot view statistics' });
      }

      let data = {};
      if (db) {
        data = {
          totalContent: db.prepare('SELECT COUNT(*) AS count FROM content').get().count,
          totalUsers: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").get().count,
          totalMessages: db.prepare('SELECT COUNT(*) AS count FROM contact_messages').get().count,
          totalMedia: db.prepare('SELECT COUNT(*) AS count FROM media').get().count,
          totalViews: db.prepare('SELECT SUM(views) AS sum FROM content').get().sum || 0
        };
      } else if (memoryStore) {
        data = {
          totalContent: memoryStore.content.length,
          totalUsers: memoryStore.users.filter(u => u.role === 'user').length,
          totalMessages: memoryStore.contact_messages.length,
          totalMedia: memoryStore.media.length,
          totalViews: memoryStore.content.reduce((sum, c) => sum + (c.views || 0), 0)
        };
      }
      return sendJson(res, 200, { success: true, data });
    }

    // B. Content Management: List all content (including drafts)
    if (pathname === '/api/admin/content' && method === 'GET') {
      let items = [];
      if (db) {
        items = db.prepare('SELECT * FROM content ORDER BY id DESC').all();
      } else if (memoryStore) {
        items = [...memoryStore.content].sort((a, b) => b.id - a.id);
      }
      return sendJson(res, 200, { success: true, data: items });
    }

    // C. Content Management: Create Content Post
    if (pathname === '/api/admin/content' && method === 'POST') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content creation restricted by owner' });
      }

      const body = await parseBody(req);
      const { title, excerpt, content, category, tags, media_url, media_type, thumbnail_url, status } = body;

      if (!title) {
        return sendJson(res, 400, { success: false, message: 'Post title is required' });
      }

      // Generate unique slug
      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      if (db) {
        const result = db.prepare(`
          INSERT INTO content (title, slug, excerpt, content, category, tags, media_url, media_type, thumbnail_url, status, author_id, author_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          title,
          slug,
          excerpt || '',
          content || '',
          category || 'General',
          tags || '',
          media_url || '',
          media_type || 'image',
          thumbnail_url || '',
          status || 'published',
          currentUser.id,
          currentUser.username
        );
        logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_CREATE', `Created post "${title}"`, ip);
        return sendJson(res, 201, { success: true, message: 'Content created successfully', id: Number(result.lastInsertRowid), slug });
      } else if (memoryStore) {
        const newItem = {
          id: memoryStore.content.length + 1,
          title,
          slug,
          excerpt: excerpt || '',
          content: content || '',
          category: category || 'General',
          tags: tags || '',
          media_url: media_url || '',
          media_type: media_type || 'image',
          thumbnail_url: thumbnail_url || '',
          status: status || 'published',
          views: 0,
          author_id: currentUser.id,
          author_name: currentUser.username,
          created_at: new Date().toISOString()
        };
        memoryStore.content.unshift(newItem);
        saveJsonStore();
        logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_CREATE', `Created post "${title}"`, ip);
        return sendJson(res, 201, { success: true, message: 'Content created successfully', id: newItem.id, slug });
      }
    }

    // D. Content Management: Update Post
    if (pathname.startsWith('/api/admin/content/') && method === 'PUT') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content editing restricted by owner' });
      }

      const id = parseInt(pathname.replace('/api/admin/content/', ''), 10);
      const body = await parseBody(req);
      const { title, excerpt, content, category, tags, media_url, media_type, thumbnail_url, status } = body;

      if (db) {
        db.prepare(`
          UPDATE content
          SET title = COALESCE(?, title),
              excerpt = COALESCE(?, excerpt),
              content = COALESCE(?, content),
              category = COALESCE(?, category),
              tags = COALESCE(?, tags),
              media_url = COALESCE(?, media_url),
              media_type = COALESCE(?, media_type),
              thumbnail_url = COALESCE(?, thumbnail_url),
              status = COALESCE(?, status),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(title, excerpt, content, category, tags, media_url, media_type, thumbnail_url, status, id);
      } else if (memoryStore) {
        const item = memoryStore.content.find(c => c.id === id);
        if (!item) return sendJson(res, 404, { success: false, message: 'Post not found' });
        if (title !== undefined) item.title = title;
        if (excerpt !== undefined) item.excerpt = excerpt;
        if (content !== undefined) item.content = content;
        if (category !== undefined) item.category = category;
        if (tags !== undefined) item.tags = tags;
        if (media_url !== undefined) item.media_url = media_url;
        if (media_type !== undefined) item.media_type = media_type;
        if (thumbnail_url !== undefined) item.thumbnail_url = thumbnail_url;
        if (status !== undefined) item.status = status;
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_UPDATE', `Updated post ID ${id}`, ip);
      return sendJson(res, 200, { success: true, message: 'Post updated successfully' });
    }

    // E. Content Management: Delete Post
    if (pathname.startsWith('/api/admin/content/') && method === 'DELETE') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content deletion restricted by owner' });
      }

      const id = parseInt(pathname.replace('/api/admin/content/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM content WHERE id = ?').run(id);
      } else if (memoryStore) {
        memoryStore.content = memoryStore.content.filter(c => c.id !== id);
        saveJsonStore();
      }
      logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_DELETE', `Deleted post ID ${id}`, ip);
      return sendJson(res, 200, { success: true, message: 'Post deleted successfully' });
    }

    // F. User Management: List Registered Users
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!checkAdminPerm('can_manage_users')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: User management restricted by owner' });
      }

      let users = [];
      if (db) {
        // Admins can ONLY see standard users (or owner can see all)
        users = db.prepare("SELECT id, username, email, role, status, created_at, last_login FROM users WHERE role = 'user' ORDER BY id DESC").all();
      } else if (memoryStore) {
        users = memoryStore.users.filter(u => u.role === 'user').map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
          last_login: u.last_login
        }));
      }
      return sendJson(res, 200, { success: true, data: users });
    }

    // G. User Management: Toggle User Status (Suspend/Activate)
    if (pathname.startsWith('/api/admin/users/') && method === 'PUT') {
      if (!checkAdminPerm('can_manage_users')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: User management restricted by owner' });
      }

      const userId = parseInt(pathname.replace('/api/admin/users/', ''), 10);
      const body = await parseBody(req);
      const { status } = body;

      // Ensure admins cannot touch owner or other admins
      let targetUser = null;
      if (db) targetUser = db.prepare('SELECT id, role, username FROM users WHERE id = ?').get(userId);
      else if (memoryStore) targetUser = memoryStore.users.find(u => u.id === userId);

      if (!targetUser) return sendJson(res, 404, { success: false, message: 'User not found' });
      if (targetUser.role !== 'user') {
        return sendJson(res, 403, { success: false, message: 'Security alert: Admins cannot alter admin or owner accounts' });
      }

      if (db) {
        db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
      } else if (memoryStore) {
        targetUser.status = status;
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'USER_STATUS_CHANGE', `Changed user ${targetUser.username} status to ${status}`, ip);
      return sendJson(res, 200, { success: true, message: `User status changed to ${status}` });
    }

    // H. Media Management: List & Add Media
    if (pathname === '/api/admin/media' && method === 'GET') {
      let mediaItems = [];
      if (db) {
        mediaItems = db.prepare('SELECT * FROM media ORDER BY id DESC').all();
      } else if (memoryStore) {
        mediaItems = [...memoryStore.media].sort((a, b) => b.id - a.id);
      }
      return sendJson(res, 200, { success: true, data: mediaItems });
    }

    if (pathname === '/api/admin/media' && method === 'POST') {
      if (!checkAdminPerm('can_upload_media')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Media upload restricted by owner' });
      }

      const body = await parseBody(req);
      const { name, url, media_type, size_bytes } = body;

      if (!name || !url) {
        return sendJson(res, 400, { success: false, message: 'Media name and URL are required' });
      }

      if (db) {
        const result = db.prepare(`
          INSERT INTO media (name, url, media_type, size_bytes, uploaded_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(name, url, media_type || 'image', size_bytes || 0, currentUser.username);
        logActivity(currentUser.id, currentUser.username, currentUser.role, 'MEDIA_UPLOAD', `Added media asset: ${name}`, ip);
        return sendJson(res, 201, { success: true, message: 'Media added successfully', id: Number(result.lastInsertRowid) });
      } else if (memoryStore) {
        const newMedia = {
          id: memoryStore.media.length + 1,
          name,
          url,
          media_type: media_type || 'image',
          size_bytes: size_bytes || 0,
          uploaded_by: currentUser.username,
          created_at: new Date().toISOString()
        };
        memoryStore.media.unshift(newMedia);
        saveJsonStore();
        logActivity(currentUser.id, currentUser.username, currentUser.role, 'MEDIA_UPLOAD', `Added media asset: ${name}`, ip);
        return sendJson(res, 201, { success: true, message: 'Media added successfully', id: newMedia.id });
      }
    }

    if (pathname.startsWith('/api/admin/media/') && method === 'DELETE') {
      if (!checkAdminPerm('can_upload_media')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Media management restricted by owner' });
      }
      const mediaId = parseInt(pathname.replace('/api/admin/media/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);
      } else if (memoryStore) {
        memoryStore.media = memoryStore.media.filter(m => m.id !== mediaId);
        saveJsonStore();
      }
      return sendJson(res, 200, { success: true, message: 'Media item removed' });
    }

    // I. Contact Messages & Feedback Management
    if (pathname === '/api/admin/messages' && method === 'GET') {
      if (!checkAdminPerm('can_manage_feedback')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Feedback management restricted by owner' });
      }

      let msgs = [];
      if (db) {
        msgs = db.prepare('SELECT * FROM contact_messages ORDER BY id DESC').all();
      } else if (memoryStore) {
        msgs = [...memoryStore.contact_messages].sort((a, b) => b.id - a.id);
      }
      return sendJson(res, 200, { success: true, data: msgs });
    }

    if (pathname.startsWith('/api/admin/messages/') && method === 'PUT') {
      if (!checkAdminPerm('can_manage_feedback')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Feedback management restricted by owner' });
      }

      const msgId = parseInt(pathname.replace('/api/admin/messages/', ''), 10);
      const body = await parseBody(req);
      const { status } = body;

      if (db) {
        db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, msgId);
      } else if (memoryStore) {
        const msg = memoryStore.contact_messages.find(m => m.id === msgId);
        if (msg) msg.status = status;
        saveJsonStore();
      }
      return sendJson(res, 200, { success: true, message: 'Message status updated' });
    }

    if (pathname.startsWith('/api/admin/messages/') && method === 'DELETE') {
      if (!checkAdminPerm('can_manage_feedback')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Feedback management restricted by owner' });
      }

      const msgId = parseInt(pathname.replace('/api/admin/messages/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM contact_messages WHERE id = ?').run(msgId);
      } else if (memoryStore) {
        memoryStore.contact_messages = memoryStore.contact_messages.filter(m => m.id !== msgId);
        saveJsonStore();
      }
      return sendJson(res, 200, { success: true, message: 'Message removed' });
    }
  }

  // Fallback for unhandled API endpoints
  return sendJson(res, 404, { success: false, message: 'API endpoint not found' });
}

// ----------------------------------------------------------------------------
// MAIN HTTP SERVER REQUEST DISPATCHER
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. API Route Dispatcher
  if (pathname.startsWith('/api/')) {
    try {
      await handleApiRequest(req, res, parsedUrl);
    } catch (err) {
      console.error('Unhandled API Error:', err);
      sendJson(res, 500, { success: false, message: 'Internal Server Error', error: err.message });
    }
    return;
  }

  // 2. Clean URL Navigation & Static Assets Dispatcher
  let filePath = '';

  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/admin' || pathname === '/admin.html') {
    filePath = path.join(__dirname, 'admin.html');
  } else if (pathname === '/owner' || pathname === '/owner.html') {
    filePath = path.join(__dirname, 'owner.html');
  } else {
    // Relative file in workspace
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    filePath = path.join(__dirname, safePath);
  }

  serveStatic(req, res, filePath);
});

// Initialize Database & Start Listening
initDatabase();

server.listen(PORT, HOST, () => {
  console.log(`========================================================================`);
  console.log(`🚀 Sasi Portfolio Multi-Tier Application Server Running!`);
  console.log(`🌐 Public Website:     http://localhost:${PORT}/`);
  console.log(`🛡️ Admin Dashboard:    http://localhost:${PORT}/admin.html`);
  console.log(`👑 Owner Dashboard:    http://localhost:${PORT}/owner.html`);
  console.log(`========================================================================`);
  console.log(`Default Credentials:`);
  console.log(`  Owner:  owner@sasiportfolio.com  /  OwnerSecure2026!`);
  console.log(`  Admin:  admin@sasiportfolio.com  /  AdminSecure2026!`);
  console.log(`  Editor: editor@sasiportfolio.com /  EditorSecure2026!`);
  console.log(`  User:   user@example.com         /  UserSecure2026!`);
  console.log(`========================================================================`);
});
