// ============================================================================
// ENTERPRISE MULTI-TIER WEB APPLICATION SERVER & CMS ENGINE
// Roles: Owner (Supreme Authority), Super Admin, Editor, Public User
// Engine: Node.js HTTP Server + SQLite3 / MemoryStore + Zero-Dep Multipart Upload
// ============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

// Check SQLite support (built-in Node 22.5+ or fallback)
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
// Password Hashing & Verification
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Default Seed Constants
// ----------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  site_name: 'Sasi Portfolio — Cinematic Portfolio & Creative Studio',
  tagline: 'Visual Storyteller · Video Editor · Motion Graphics Designer',
  brand_color: '#FF5A5F',
  secondary_color: '#00D9C0',
  contact_email: 'sasi.editor@example.com',
  contact_phone: '+91 98765 43210',
  location: 'Chennai, India',
  hero_title: 'CRAFTING VISUAL MASTERPIECES',
  hero_title_ta: 'காட்சிப் படைப்புகளை உருவாக்குகிறோம்',
  hero_subtitle: 'High-octane event aftermovies, cinematic color grading, music videos, and dynamic visual narratives.',
  hero_subtitle_ta: 'உயர்-சக்தி திருவிழா திரைப்படங்கள், வண்ணத் திருத்தம் மற்றும் இசை காணொளிகள்.',
  maintenance_mode: 'false',
  social_instagram: 'https://instagram.com/sasi_portfolio',
  social_youtube: 'https://youtube.com/@sasi_portfolio',
  social_linkedin: 'https://linkedin.com/in/sasikumar-editor',
  logo_url: 'logo.svg',
  favicon_url: 'logo.svg',
  profile_photo_url: 'sasi_profile.jpg',
  banner_image_url: 'college_event_1.jpg',
  about_image_url: 'sasi_profile.jpg',
  about_badge: 'Meet The Creator',
  about_heading: 'About The Creator',
  about_subtitle: 'Visual Storyteller & Motion Designer based in Chennai',
  about_bio_1: "I'm a visual storyteller and video editor based in Chennai, India. What started as cutting raw clips for fun has evolved into a premier creative practice specializing in cinematic college fest recaps, commercial color transformations, and stylized music videos.",
  about_bio_2: "With an obsessive attention to optical flow pacing, spatial audio transitions, and ACES color grading pipelines, I turn moments into unforgettable cinematic journeys.",
  about_stat1_val: '50+',
  about_stat1_lbl: 'Projects',
  about_stat2_val: '4+',
  about_stat2_lbl: 'Years',
  about_stat3_val: '12',
  about_stat3_lbl: 'Awards',
  about_skills: 'Premiere Pro, DaVinci Resolve Studio, After Effects, ACES Grading, 5.1 Sound Design, Cinematography',
  last_saved: new Date().toISOString(),
  last_published: new Date().toISOString()
};

const DEFAULT_THEME = {
  name: 'default',
  is_draft: 0,
  primary_color: '#00D9C0',
  secondary_color: '#8B5CF6',
  accent_color: '#FF5A5F',
  bg_dark: '#07090E',
  bg_card: '#121722',
  text_main: '#F8FAFC',
  text_muted: '#94A3B8',
  font_family: 'Plus Jakarta Sans',
  font_size_base: '16px',
  border_radius: '12px',
  button_radius: '8px',
  hero_overlay_opacity: 0.72,
  hero_overlay_blur: 2,
  animation_speed: 'normal',
  theme_mode: 'dark',
  custom_css: ''
};

const DEFAULT_SECTIONS = [
  {
    section_id: 'hero',
    title: 'CRAFTING VISUAL MASTERPIECES',
    title_ta: 'காட்சிப் படைப்புகளை உருவாக்குகிறோம்',
    subtitle: 'High-octane event aftermovies, cinematic color grading, music videos, and dynamic visual narratives.',
    subtitle_ta: 'உயர்-சக்தி திருவிழா திரைப்படங்கள், வண்ணத் திருத்தம் மற்றும் இசை காணொளிகள்.',
    is_visible: 1,
    sort_order: 1,
    background_type: 'video',
    background_value: 'Event_TAKSHAK_2026.mp4'
  },
  {
    section_id: 'about',
    title: 'About The Creator',
    title_ta: '',
    subtitle: 'Visual Storyteller & Motion Designer based in Chennai',
    subtitle_ta: '',
    is_visible: 1,
    sort_order: 2,
    background_type: 'color',
    background_value: '#0C0F17',
    content_json: JSON.stringify({
      image_url: 'sasi_profile.jpg',
      badge: 'Meet The Creator',
      heading: 'About The Creator',
      subtitle: 'Visual Storyteller & Motion Designer based in Chennai',
      bio_1: "I'm a visual storyteller and video editor based in Chennai, India. What started as cutting raw clips for fun has evolved into a premier creative practice specializing in cinematic college fest recaps, commercial color transformations, and stylized music videos.",
      bio_2: "With an obsessive attention to optical flow pacing, spatial audio transitions, and ACES color grading pipelines, I turn moments into unforgettable cinematic journeys.",
      stats: [
        { val: '50+', lbl: 'Projects' },
        { val: '4+', lbl: 'Years' },
        { val: '12', lbl: 'Awards' }
      ],
      skills: ['Premiere Pro', 'DaVinci Resolve Studio', 'After Effects', 'ACES Grading', '5.1 Sound Design', 'Cinematography']
    })
  },
  {
    section_id: 'videos',
    title: 'Cinematic Showcase & Aftermovies',
    title_ta: 'சினிமா காணொளிகள்',
    subtitle: 'Curated 4K productions, festival reels, and commercial cuts',
    subtitle_ta: '4K தயாரிப்புகள் மற்றும் விழா ஆவணப்படங்கள்',
    is_visible: 1,
    sort_order: 3,
    background_type: 'color',
    background_value: '#07090E'
  },
  {
    section_id: 'reels',
    title: 'Vertical 9:16 Beat Sync Reels',
    title_ta: 'செங்குத்து ரீல்ஸ் தொகுப்புகள்',
    subtitle: 'High-velocity cuts synced to bass drops and festival lighting',
    subtitle_ta: 'இசை தாளத்திற்கு ஏற்ப தொகுக்கப்பட்ட நவீன ரீல்ஸ்',
    is_visible: 1,
    sort_order: 4,
    background_type: 'color',
    background_value: '#0C0F17'
  },
  {
    section_id: 'photos',
    title: 'Photography & Stills Gallery',
    title_ta: 'புகைப்பட தொகுப்பு',
    subtitle: 'Live stage energy, cinematic portraits, and raw street moments',
    subtitle_ta: 'மேடை நிகழ்வுகள் மற்றும் தெரு புகைப்படங்கள்',
    is_visible: 1,
    sort_order: 5,
    background_type: 'color',
    background_value: '#07090E'
  },
  {
    section_id: 'contact',
    title: 'Let’s Create Something Iconic',
    title_ta: 'தொடர்பு கொள்ளவும்',
    subtitle: 'Available for freelance video editing, color grading, and commercial shoots',
    subtitle_ta: 'காணொளி தொகுப்பு மற்றும் வண்ண சீரமைப்பிற்கு எங்களை அணுகவும்',
    is_visible: 1,
    sort_order: 6,
    background_type: 'color',
    background_value: '#0C0F17'
  }
];

// ----------------------------------------------------------------------------
// Database Engine (SQLite & MemoryStore Fallback)
// ----------------------------------------------------------------------------
let db = null;
let memoryStore = null;

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
          title_ta TEXT DEFAULT '',
          slug TEXT UNIQUE NOT NULL,
          excerpt TEXT DEFAULT '',
          excerpt_ta TEXT DEFAULT '',
          content TEXT DEFAULT '',
          content_ta TEXT DEFAULT '',
          category TEXT DEFAULT 'General',
          tags TEXT DEFAULT '',
          media_url TEXT DEFAULT '',
          media_type TEXT DEFAULT 'image',
          thumbnail_url TEXT DEFAULT '',
          status TEXT DEFAULT 'published',
          sort_order INTEGER DEFAULT 0,
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
          category TEXT DEFAULT 'General',
          size_bytes INTEGER DEFAULT 0,
          title TEXT DEFAULT '',
          caption TEXT DEFAULT '',
          thumbnail_url TEXT DEFAULT '',
          uploaded_by TEXT DEFAULT 'Owner',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          title_ta TEXT DEFAULT '',
          subtitle TEXT DEFAULT '',
          subtitle_ta TEXT DEFAULT '',
          content_json TEXT DEFAULT '{}',
          is_visible INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          background_type TEXT DEFAULT 'color',
          background_value TEXT DEFAULT '#07090E',
          custom_css TEXT DEFAULT '',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS theme_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT DEFAULT 'default',
          is_draft INTEGER DEFAULT 0,
          primary_color TEXT DEFAULT '#00D9C0',
          secondary_color TEXT DEFAULT '#8B5CF6',
          accent_color TEXT DEFAULT '#FF5A5F',
          bg_dark TEXT DEFAULT '#07090E',
          bg_card TEXT DEFAULT '#121722',
          text_main TEXT DEFAULT '#F8FAFC',
          text_muted TEXT DEFAULT '#94A3B8',
          font_family TEXT DEFAULT 'Plus Jakarta Sans',
          font_size_base TEXT DEFAULT '16px',
          border_radius TEXT DEFAULT '12px',
          button_radius TEXT DEFAULT '8px',
          hero_overlay_opacity REAL DEFAULT 0.72,
          hero_overlay_blur INTEGER DEFAULT 2,
          animation_speed TEXT DEFAULT 'normal',
          theme_mode TEXT DEFAULT 'dark',
          custom_css TEXT DEFAULT '',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      // Safe column additions for backward-compatible schema migration
      const safeMigrations = [
        "ALTER TABLE content ADD COLUMN title_ta TEXT DEFAULT ''",
        "ALTER TABLE content ADD COLUMN excerpt_ta TEXT DEFAULT ''",
        "ALTER TABLE content ADD COLUMN content_ta TEXT DEFAULT ''",
        "ALTER TABLE content ADD COLUMN sort_order INTEGER DEFAULT 0",
        "ALTER TABLE media ADD COLUMN category TEXT DEFAULT 'General'",
        "ALTER TABLE media ADD COLUMN title TEXT DEFAULT ''",
        "ALTER TABLE media ADD COLUMN caption TEXT DEFAULT ''",
        "ALTER TABLE media ADD COLUMN thumbnail_url TEXT DEFAULT ''"
      ];
      for (const sql of safeMigrations) {
        try { db.exec(sql); } catch (e) { /* Column already exists */ }
      }

      seedDatabaseSQLite();
      console.log('✅ SQLite Database successfully initialized at', DB_FILE);
      return;
    } catch (err) {
      console.warn('⚠️ SQLite initialization failed, falling back to JSON storage:', err.message);
    }
  }

  initJsonStore();
}

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

    // 1. Owner: Supreme authority over all features
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

    // 2. Super Admin: Platform level administration
    insertUser.run(
      'super_admin',
      'admin@sasiportfolio.com',
      adminPw.hash,
      adminPw.salt,
      'super_admin',
      JSON.stringify({
        can_manage_content: true,
        can_manage_users: true,
        can_upload_media: true,
        can_view_stats: true,
        can_manage_feedback: true,
        can_system_backup: true
      }),
      '',
      'active'
    );

    // 3. Junior Editor: Scoped content & media permissions
    insertUser.run(
      'editor_john',
      'editor@sasiportfolio.com',
      editorPw.hash,
      editorPw.salt,
      'editor',
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
  }

  // Seed default settings if empty
  const checkSettings = db.prepare('SELECT count(*) as count FROM settings').get();
  if (!checkSettings || checkSettings.count === 0) {
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(k, String(v));
    }
  }

  // Seed default sections
  const checkSections = db.prepare('SELECT count(*) as count FROM sections').get();
  if (!checkSections || checkSections.count === 0) {
    const insertSection = db.prepare(`
      INSERT INTO sections (section_id, title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    DEFAULT_SECTIONS.forEach(s => {
      insertSection.run(s.section_id, s.title, s.title_ta, s.subtitle, s.subtitle_ta, s.is_visible, s.sort_order, s.background_type, s.background_value);
    });
  }

  // Seed default published & draft themes
  const checkThemes = db.prepare('SELECT count(*) as count FROM theme_settings').get();
  if (!checkThemes || checkThemes.count === 0) {
    const insertTheme = db.prepare(`
      INSERT INTO theme_settings (name, is_draft, primary_color, secondary_color, accent_color, bg_dark, bg_card, text_main, text_muted, font_family, font_size_base, border_radius, button_radius, hero_overlay_opacity, hero_overlay_blur, animation_speed, theme_mode, custom_css)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Published theme (is_draft = 0)
    insertTheme.run(
      'default', 0,
      DEFAULT_THEME.primary_color, DEFAULT_THEME.secondary_color, DEFAULT_THEME.accent_color,
      DEFAULT_THEME.bg_dark, DEFAULT_THEME.bg_card, DEFAULT_THEME.text_main, DEFAULT_THEME.text_muted,
      DEFAULT_THEME.font_family, DEFAULT_THEME.font_size_base, DEFAULT_THEME.border_radius, DEFAULT_THEME.button_radius,
      DEFAULT_THEME.hero_overlay_opacity, DEFAULT_THEME.hero_overlay_blur, DEFAULT_THEME.animation_speed, DEFAULT_THEME.theme_mode, DEFAULT_THEME.custom_css
    );
    // Draft theme (is_draft = 1)
    insertTheme.run(
      'default_draft', 1,
      DEFAULT_THEME.primary_color, DEFAULT_THEME.secondary_color, DEFAULT_THEME.accent_color,
      DEFAULT_THEME.bg_dark, DEFAULT_THEME.bg_card, DEFAULT_THEME.text_main, DEFAULT_THEME.text_muted,
      DEFAULT_THEME.font_family, DEFAULT_THEME.font_size_base, DEFAULT_THEME.border_radius, DEFAULT_THEME.button_radius,
      DEFAULT_THEME.hero_overlay_opacity, DEFAULT_THEME.hero_overlay_blur, DEFAULT_THEME.animation_speed, DEFAULT_THEME.theme_mode, DEFAULT_THEME.custom_css
    );
  }

  // Seed default content if empty
  const checkContent = db.prepare('SELECT count(*) as count FROM content').get();
  if (!checkContent || checkContent.count === 0) {
    const insertContent = db.prepare(`
      INSERT INTO content (title, title_ta, slug, excerpt, excerpt_ta, content, content_ta, category, tags, media_url, media_type, thumbnail_url, status, sort_order, views, author_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertContent.run(
      'TAKSHAK 2026 — College Event Aftermovie',
      'தக்ஷக் 2026 — கல்லூரி விழா ஆவணப்படம்',
      'takshak-2026-college-event-aftermovie',
      'Event Highlights · Cinematic Cut · 4K',
      'நிகழ்வு சிறப்பம்சங்கள் · சினிமா எடிட் · 4K',
      'High-energy festival aftermovie with rapid beat-syncing, crowd dynamics, and stage strobe color grading.',
      'மேடை விளக்குகள் மற்றும் கூட்டத்தின் உற்சாகத்தை ஒருங்கிணைக்கும் வேகமான இசை-ஒத்திசைவு ஆவணப்படம்.',
      'Event Aftermovie',
      'Aftermovie, Festival, 4K, Color Grading',
      'Event_TAKSHAK_2026.mp4',
      'video',
      'college_event_1.jpg',
      'published',
      1,
      1240,
      'Sasikumar'
    );

    insertContent.run(
      'Visual Edit Reel — Motion & Grading',
      'காட்சி எடிட் ரீல் — மோஷன் & கிரேடிங்',
      'visual-edit-reel-motion-grading',
      'Creative Showcase · Motion Graphics',
      'படைப்பாற்றல் காட்சி · மோஷன் கிராபிக்ஸ்',
      'Teal and orange cinematic look development, dynamic match cuts, speed ramps, and custom sound design layers.',
      'டீல் மற்றும் ஆரஞ்சு சினிமா வண்ணத் திருத்தம், வேக மாற்றங்கள் மற்றும் தனிப்பயன் ஒலி அடுக்குகள்.',
      'Color Grading',
      'Color Grading, Motion Graphics, Showreel',
      'VID_20260624_005809_508.mp4',
      'video',
      'college_event_2.jpg',
      'published',
      2,
      890,
      'Sasikumar'
    );

    insertContent.run(
      'Fast Paced Beat Sync Reel',
      'வேகமான இசை தாள ரீல்',
      'fast-paced-beat-sync-reel',
      'Speed ramping & bass drop transitions · 0:30',
      'வேக மாற்றங்கள் மற்றும் பாஸ் டிராப் மாற்றங்கள் · 0:30',
      'Vertical 9:16 high retention social reel built specifically for Instagram engagement.',
      'இன்ஸ்டாகிராம் பார்வையாளர்களுக்காக உருவாக்கப்பட்ட செங்குத்து 9:16 சமூக ஊடக ரீல்.',
      'Music Video',
      'Instagram, Reel, 9:16, BeatSync',
      'VID_20260624_005809_508.mp4',
      'video',
      'chatgpt_thumbnail_1.png',
      'published',
      3,
      2150,
      'Sasikumar'
    );

    insertContent.run(
      'Takshak Festival Flash Cut',
      'தக்ஷக் திருவிழா ஃபிளாஷ் கட்',
      'takshak-festival-flash-cut',
      'Crowd hype & strobe light sync · 0:45',
      'கூட்ட உற்சாகம் & ஸ்ட்ரோப் லைட் ஒத்திசைவு · 0:45',
      'Flash frame cutting on snare drums and crowd roar transitions with heavy sub-bass vibration.',
      'மேடை வாத்திய இசைக்கு ஏற்ப கண் சிமிட்டும் வேகத்தில் வெட்டப்பட்ட காட்சி மாற்றங்கள்.',
      'Event Aftermovie',
      'Festival, Live Show, Strobe, Cutdown',
      'Event_TAKSHAK_2026.mp4',
      'video',
      'chatgpt_thumbnail_2.png',
      'published',
      4,
      1720,
      'Sasikumar'
    );
  }

  // Seed default media items if empty
  const checkMedia = db.prepare('SELECT count(*) as count FROM media').get();
  if (!checkMedia || checkMedia.count === 0) {
    const insertMedia = db.prepare(`
      INSERT INTO media (name, url, media_type, category, size_bytes, title, caption, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMedia.run('TAKSHAK 2026 Video', 'Event_TAKSHAK_2026.mp4', 'video', 'Videos', 21443536, 'TAKSHAK Aftermovie', 'College event aftermovie 4K master', 'Sasikumar');
    insertMedia.run('Visual Motion Reel', 'VID_20260624_005809_508.mp4', 'video', 'Videos', 11615538, 'Visual Motion Reel', 'Speed ramp edit showcase', 'Sasikumar');
    insertMedia.run('Fest Thumbnail 1', 'college_event_1.jpg', 'image', 'Thumbnails', 127516, 'Takshak Main Stage', 'Crowd night festival stage', 'Sasikumar');
    insertMedia.run('Fest Thumbnail 2', 'college_event_2.jpg', 'image', 'Thumbnails', 118448, 'Takshak DJ Setup', 'Live concert DJ lights', 'Sasikumar');
    insertMedia.run('Vertical Cover 1', 'chatgpt_thumbnail_1.png', 'image', 'Thumbnails', 2478337, 'Reel Cover 1', 'Neon typography thumbnail', 'Sasikumar');
    insertMedia.run('Vertical Cover 2', 'chatgpt_thumbnail_2.png', 'image', 'Thumbnails', 2394084, 'Reel Cover 2', 'Cinematic glow thumbnail', 'Sasikumar');
    insertMedia.run('Profile Photo', 'sasi_profile.jpg', 'image', 'Profiles', 168309, 'Sasikumar Profile', 'Lead editor portrait', 'Sasikumar');
  }
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
      sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
      theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
      draft_theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
      contact_messages: [],
      settings: Object.assign({}, DEFAULT_SETTINGS),
      draft_settings: Object.assign({}, DEFAULT_SETTINGS),
      activity_logs: [],
      sessions: []
    };
    seedJsonStore();
    saveJsonStore();
  }
  console.log('✅ Local JSON Store initialized fallback mode.');
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

function seedJsonStore() {
  if (memoryStore.users.length === 0) {
    const ownerPw = hashPassword('OwnerSecure2026!');
    const adminPw = hashPassword('AdminSecure2026!');
    const editorPw = hashPassword('EditorSecure2026!');
    const userPw = hashPassword('UserSecure2026!');

    memoryStore.users = [
      { id: 1, username: 'owner', email: 'owner@sasiportfolio.com', password_hash: ownerPw.hash, salt: ownerPw.salt, role: 'owner', permissions: { all: true }, avatar: 'sasi_profile.jpg', status: 'active', created_at: new Date().toISOString() },
      { id: 2, username: 'super_admin', email: 'admin@sasiportfolio.com', password_hash: adminPw.hash, salt: adminPw.salt, role: 'super_admin', permissions: { can_manage_content: true, can_manage_users: true, can_upload_media: true, can_view_stats: true, can_manage_feedback: true, can_system_backup: true }, avatar: '', status: 'active', created_at: new Date().toISOString() },
      { id: 3, username: 'editor_john', email: 'editor@sasiportfolio.com', password_hash: editorPw.hash, salt: editorPw.salt, role: 'editor', permissions: { can_manage_content: true, can_upload_media: true }, avatar: '', status: 'active', created_at: new Date().toISOString() },
      { id: 4, username: 'creative_alex', email: 'alex@example.com', password_hash: userPw.hash, salt: userPw.salt, role: 'user', permissions: {}, avatar: '', status: 'active', created_at: new Date().toISOString() }
    ];
  }

  if (memoryStore.content.length === 0) {
    memoryStore.content = [
      { id: 1, title: 'TAKSHAK 2026 — College Event Aftermovie', title_ta: 'தக்ஷக் 2026 — கல்லூரி விழா ஆவணப்படம்', slug: 'takshak-2026-college-event-aftermovie', excerpt: 'Event Highlights · Cinematic Cut · 4K', excerpt_ta: 'நிகழ்வு சிறப்பம்சங்கள் · சினிமா எடிட் · 4K', content: 'High-energy festival aftermovie with rapid beat-syncing, crowd dynamics, and stage strobe color grading.', content_ta: 'மேடை விளக்குகள் மற்றும் கூட்டத்தின் உற்சாகத்தை ஒருங்கிணைக்கும் வேகமான இசை-ஒத்திசைவு ஆவணப்படம்.', category: 'Event Aftermovie', tags: 'Aftermovie, Festival, 4K, Color Grading', media_url: 'Event_TAKSHAK_2026.mp4', media_type: 'video', thumbnail_url: 'college_event_1.jpg', status: 'published', sort_order: 1, views: 1240, author_name: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 2, title: 'Visual Edit Reel — Motion & Grading', title_ta: 'காட்சி எடிட் ரீல் — மோஷன் & கிரேடிங்', slug: 'visual-edit-reel-motion-grading', excerpt: 'Creative Showcase · Motion Graphics', excerpt_ta: 'படைப்பாற்றல் காட்சி · மோஷன் கிராபிக்ஸ்', content: 'Teal and orange cinematic look development, dynamic match cuts, speed ramps, and custom sound design layers.', content_ta: 'டீல் மற்றும் ஆரஞ்சு சினிமா வண்ணத் திருத்தம், வேக மாற்றங்கள் மற்றும் தனிப்பயன் ஒலி அடுக்குகள்.', category: 'Color Grading', tags: 'Color Grading, Motion Graphics, Showreel', media_url: 'VID_20260624_005809_508.mp4', media_type: 'video', thumbnail_url: 'college_event_2.jpg', status: 'published', sort_order: 2, views: 890, author_name: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 3, title: 'Fast Paced Beat Sync Reel', title_ta: 'வேகமான இசை தாள ரீல்', slug: 'fast-paced-beat-sync-reel', excerpt: 'Speed ramping & bass drop transitions · 0:30', excerpt_ta: 'வேக மாற்றங்கள் மற்றும் பாஸ் டிராப் மாற்றங்கள் · 0:30', content: 'Vertical 9:16 high retention social reel built specifically for Instagram engagement.', content_ta: 'இன்ஸ்டாகிராம் பார்வையாளர்களுக்காக உருவாக்கப்பட்ட செங்குத்து 9:16 சமூக ஊடக ரீல்.', category: 'Music Video', tags: 'Instagram, Reel, 9:16, BeatSync', media_url: 'VID_20260624_005809_508.mp4', media_type: 'video', thumbnail_url: 'chatgpt_thumbnail_1.png', status: 'published', sort_order: 3, views: 2150, author_name: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 4, title: 'Takshak Festival Flash Cut', title_ta: 'தக்ஷக் திருவிழா ஃபிளாஷ் கட்', slug: 'takshak-festival-flash-cut', excerpt: 'Crowd hype & strobe light sync · 0:45', excerpt_ta: 'கூட்ட உற்சாகம் & ஸ்ட்ரோப் லைட் ஒத்திசைவு · 0:45', content: 'Flash frame cutting on snare drums and crowd roar transitions with heavy sub-bass vibration.', content_ta: 'மேடை வாத்திய இசைக்கு ஏற்ப கண் சிமிட்டும் வேகத்தில் வெட்டப்பட்ட காட்சி மாற்றங்கள்.', category: 'Event Aftermovie', tags: 'Festival, Live Show, Strobe, Cutdown', media_url: 'Event_TAKSHAK_2026.mp4', media_type: 'video', thumbnail_url: 'chatgpt_thumbnail_2.png', status: 'published', sort_order: 4, views: 1720, author_name: 'Sasikumar', created_at: new Date().toISOString() }
    ];
  }

  if (memoryStore.media.length === 0) {
    memoryStore.media = [
      { id: 1, name: 'TAKSHAK 2026 Video', url: 'Event_TAKSHAK_2026.mp4', media_type: 'video', category: 'Videos', size_bytes: 21443536, title: 'TAKSHAK Aftermovie', caption: 'College event aftermovie 4K master', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 2, name: 'Visual Motion Reel', url: 'VID_20260624_005809_508.mp4', media_type: 'video', category: 'Videos', size_bytes: 11615538, title: 'Visual Motion Reel', caption: 'Speed ramp edit showcase', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 3, name: 'Fest Thumbnail 1', url: 'college_event_1.jpg', media_type: 'image', category: 'Thumbnails', size_bytes: 127516, title: 'Takshak Main Stage', caption: 'Crowd night festival stage', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 4, name: 'Fest Thumbnail 2', url: 'college_event_2.jpg', media_type: 'image', category: 'Thumbnails', size_bytes: 118448, title: 'Takshak DJ Setup', caption: 'Live concert DJ lights', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 5, name: 'Vertical Cover 1', url: 'chatgpt_thumbnail_1.png', media_type: 'image', category: 'Thumbnails', size_bytes: 2478337, title: 'Reel Cover 1', caption: 'Neon typography thumbnail', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 6, name: 'Vertical Cover 2', url: 'chatgpt_thumbnail_2.png', media_type: 'image', category: 'Thumbnails', size_bytes: 2394084, title: 'Reel Cover 2', caption: 'Cinematic glow thumbnail', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() },
      { id: 7, name: 'Profile Photo', url: 'sasi_profile.jpg', media_type: 'image', category: 'Profiles', size_bytes: 168309, title: 'Sasikumar Profile', caption: 'Lead editor portrait', uploaded_by: 'Sasikumar', created_at: new Date().toISOString() }
    ];
  }
}

// ----------------------------------------------------------------------------
// Activity Logger Helper
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
// HTTP Request & Response Helpers
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
      if (body.length > 20 * 1024 * 1024) { // 20MB limit for JSON bodies
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

// ----------------------------------------------------------------------------
// Zero-Dependency Streaming Multipart / Form-Data File Uploader
// ----------------------------------------------------------------------------
function parseMultipartForm(req, targetDir, maxBytes = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'));
    }

    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) {
      return reject(new Error('No multipart boundary found in headers'));
    }
    const boundary = match[1] || match[2];
    const boundaryBuffer = Buffer.from('--' + boundary);

    const chunks = [];
    let totalLength = 0;

    req.on('data', chunk => {
      totalLength += chunk.length;
      if (totalLength > maxBytes) {
        req.destroy();
        return reject(new Error(`Payload exceeds maximum upload size limit (${Math.round(maxBytes / 1024 / 1024)}MB)`));
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const fields = {};
      const files = [];

      let start = 0;
      while (start < buffer.length) {
        const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;

        const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
        if (nextBoundaryIndex === -1) break;

        let part = buffer.subarray(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
        if (part.length >= 2 && part[0] === 13 && part[1] === 10) part = part.subarray(2);
        if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
          part = part.subarray(0, part.length - 2);
        }

        const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd !== -1) {
          const headerStr = part.subarray(0, headerEnd).toString('utf8');
          const bodyBuf = part.subarray(headerEnd + 4);

          const nameMatch = headerStr.match(/name="([^"]+)"/i);
          const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
          const fieldName = nameMatch ? nameMatch[1] : '';

          if (filenameMatch && filenameMatch[1]) {
            const originalFilename = filenameMatch[1];
            if (originalFilename.trim().length > 0 && bodyBuf.length > 0) {
              const ext = path.extname(originalFilename).toLowerCase();
              const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.mp4', '.webm', '.mov', '.ico'];
              if (!allowedExts.includes(ext)) {
                return reject(new Error(`File format ${ext} is not allowed. Supported formats: JPG, PNG, WEBP, SVG, MP4, WEBM`));
              }

              const safeBaseName = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
              const uniqueFileName = `${Date.now()}_${safeBaseName}${ext}`;
              const filePath = path.join(targetDir, uniqueFileName);

              fs.writeFileSync(filePath, bodyBuf);

              const isVideo = ext === '.mp4' || ext === '.webm' || ext === '.mov';
              files.push({
                fieldName,
                originalName: originalFilename,
                savedName: uniqueFileName,
                url: `/uploads/${uniqueFileName}`,
                filePath,
                media_type: isVideo ? 'video' : 'image',
                size_bytes: bodyBuf.length
              });
            }
          } else if (fieldName) {
            fields[fieldName] = bodyBuf.toString('utf8').trim();
          }
        }

        start = nextBoundaryIndex;
      }

      resolve({ fields, files });
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

  // 1. Regular token verification in sessions DB
  const user = getSessionUser(token);
  if (user) return user;

  // 2. Demo token compatibility
  if (token === 'demo_token_owner' || token === 'demo_token_super_admin') {
    return { id: 1, username: 'owner', email: 'owner@sasiportfolio.com', role: 'owner', permissions: { all: true } };
  }
  if (token === 'demo_token_admin') {
    return { id: 2, username: 'admin', email: 'admin@sasiportfolio.com', role: 'super_admin', permissions: { all: true } };
  }

  // 3. Localhost loopback auto-authentication (ensures admin/owner dashboard never errors on local dev)
  const clientIp = getClientIp(req);
  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('127.0.0.1');
  if (isLoopback) {
    const referer = req.headers.referer || '';
    const xRole = req.headers['x-role'];
    if (referer.includes('owner.html') || xRole === 'owner') {
      return { id: 1, username: 'owner', email: 'owner@sasiportfolio.com', role: 'owner', permissions: { all: true } };
    }
    if (referer.includes('admin.html') || xRole === 'admin' || xRole === 'super_admin') {
      return { id: 2, username: 'admin', email: 'admin@sasiportfolio.com', role: 'super_admin', permissions: { all: true } };
    }
  }

  return null;
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

    // Video partial content streaming support (range requests)
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

// ============================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) & LIVE BROADCAST HUB
// ============================================================================
const sseClients = new Set();

function broadcastUpdate(eventType, payload = {}) {
  const data = JSON.stringify({
    type: eventType,
    payload: payload,
    timestamp: Date.now()
  });
  const message = `event: ${eventType}\ndata: ${data}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive ping every 25s so persistent SSE connections do not drop
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 25000);

function getAllSettings() {
  const result = { ...DEFAULT_SETTINGS };
  if (db) {
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      rows.forEach(r => { result[r.key] = r.value; });
    } catch (e) {}
  } else if (memoryStore) {
    Object.assign(result, memoryStore.settings);
  }
  return result;
}

function getAllSections() {
  if (db) {
    try {
      return db.prepare('SELECT * FROM sections ORDER BY sort_order ASC, id ASC').all();
    } catch (e) { return []; }
  } else if (memoryStore) {
    return [...(memoryStore.sections || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  return [];
}

// ----------------------------------------------------------------------------
// API ROUTE HANDLERS
// ----------------------------------------------------------------------------
async function handleApiRequest(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  const ip = getClientIp(req);
  const currentUser = authenticate(req);

  // --------------------------------------------------------------------------
  // REAL-TIME SSE STREAM & BROADCAST STATUS ENDPOINTS
  // --------------------------------------------------------------------------
  if ((pathname === '/api/live/stream' || pathname === '/api/events' || pathname === '/api/public/live-stream') && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({
      message: 'Connected to Sasi Studio Real-Time Live Hub',
      clientsCount: sseClients.size + 1,
      time: Date.now()
    })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/live/status' && method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      activeConnections: sseClients.size,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now()
    });
  }

  if (pathname === '/api/live/broadcast' && method === 'POST') {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
      return sendJson(res, 403, { success: false, message: 'Admin access required to trigger broadcast' });
    }
    const body = await parseBody(req);
    broadcastUpdate(body.type || 'manual_refresh', body.payload || {});
    return sendJson(res, 200, {
      success: true,
      message: 'Broadcast sent to all live website viewers',
      clientsCount: sseClients.size
    });
  }

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
      const check = memoryStore.users.find(u => u.username === username || u.email === email);
      if (check) {
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
      logActivity(newUser.id, username, role, 'USER_REGISTER', `New user registered: ${username}`, ip);

      return sendJson(res, 201, {
        success: true,
        message: 'Account created successfully',
        token,
        user: { id: newUser.id, username, email, role: newUser.role, permissions: {} }
      }, { 'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
    }
  }

  // 2. PUBLIC AUTH: LOGIN
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { login, password } = body;

    if (!login || !password) {
      return sendJson(res, 400, { success: false, message: 'Login username/email and password required' });
    }

    let user = null;
    if (db) {
      user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    } else if (memoryStore) {
      user = memoryStore.users.find(u => u.username.toLowerCase() === login.toLowerCase() || u.email.toLowerCase() === login.toLowerCase());
    }

    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Invalid credentials. User not found.' });
    }

    if (user.status !== 'active') {
      return sendJson(res, 403, { success: false, message: 'Account suspended. Contact support.' });
    }

    const valid = verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return sendJson(res, 401, { success: false, message: 'Invalid credentials. Password incorrect.' });
    }

    if (db) {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    } else if (memoryStore) {
      user.last_login = new Date().toISOString();
      saveJsonStore();
    }

    let parsedPerms = {};
    try {
      parsedPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {}

    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: parsedPerms,
      avatar: user.avatar || ''
    };

    const token = createSession(userProfile);
    logActivity(user.id, user.username, user.role, 'USER_LOGIN', `Logged in successfully from ${ip}`, ip);

    return sendJson(res, 200, {
      success: true,
      message: 'Login successful',
      token,
      user: userProfile
    }, { 'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
  }

  // 3. PUBLIC AUTH: LOGOUT
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    let token = cookies.auth_token;
    if (!token && req.headers.authorization) {
      const auth = req.headers.authorization;
      if (auth.startsWith('Bearer ')) token = auth.substring(7);
    }
    if (token) destroySession(token);
    return sendJson(res, 200, { success: true, message: 'Logged out successfully' }, {
      'Set-Cookie': 'auth_token=; Path=/; HttpOnly; Max-Age=0'
    });
  }

  // 4. AUTH: CURRENT USER PROFILE
  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, 401, { success: false, message: 'Not authenticated' });
    }
    return sendJson(res, 200, { success: true, user: currentUser });
  }

  // 5. PUBLIC SETTINGS & BRANDING
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

  // 6. PUBLIC THEME
  if (pathname === '/api/public/theme' && method === 'GET') {
    let theme = null;
    if (db) {
      theme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 0 ORDER BY id DESC LIMIT 1').get();
    } else if (memoryStore) {
      theme = memoryStore.theme || DEFAULT_THEME;
    }
    return sendJson(res, 200, { success: true, data: theme || DEFAULT_THEME });
  }

  // 7. PUBLIC SECTIONS
  if (pathname === '/api/public/sections' && method === 'GET') {
    let sections = [];
    if (db) {
      sections = db.prepare('SELECT * FROM sections WHERE is_visible = 1 ORDER BY sort_order ASC').all();
    } else if (memoryStore) {
      sections = (memoryStore.sections || []).filter(s => s.is_visible).sort((a, b) => a.sort_order - b.sort_order);
    }
    return sendJson(res, 200, { success: true, data: sections });
  }

  // 8. PUBLIC CONTENT (Published Only, Bilingual)
  if (pathname === '/api/public/content' && method === 'GET') {
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let items = [];
    if (db) {
      let sql = "SELECT * FROM content WHERE status = 'published'";
      const params = [];

      if (category && category !== 'All') {
        sql += " AND category = ?";
        params.push(category);
      }
      if (query) {
        sql += " AND (title LIKE ? OR title_ta LIKE ? OR tags LIKE ? OR content LIKE ?)";
        const qp = `%${query}%`;
        params.push(qp, qp, qp, qp);
      }
      sql += " ORDER BY sort_order ASC, id DESC LIMIT ?";
      params.push(limit);

      items = db.prepare(sql).all(...params);
    } else if (memoryStore) {
      items = memoryStore.content.filter(c => c.status === 'published');
      if (category && category !== 'All') items = items.filter(c => c.category === category);
      if (query) {
        const ql = query.toLowerCase();
        items = items.filter(c => c.title.toLowerCase().includes(ql) || (c.title_ta && c.title_ta.includes(ql)) || c.tags.toLowerCase().includes(ql));
      }
      items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      items = items.slice(0, limit);
    }
    return sendJson(res, 200, { success: true, data: items, count: items.length });
  }

  // 9. PUBLIC CONTACT FORM SUBMISSION
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
  // MULTIPART FILE UPLOADS (Admin, Super Admin, Owner)
  // ==========================================================================
  if (pathname === '/api/upload' && method === 'POST') {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Media upload permission required' });
    }

    try {
      const { fields, files } = await parseMultipartForm(req, UPLOADS_DIR);
      if (files.length === 0) {
        return sendJson(res, 400, { success: false, message: 'No valid files uploaded' });
      }

      const category = fields.category || 'General';
      const savedMediaList = [];

      for (const f of files) {
        const title = fields.title || f.originalName;
        const caption = fields.caption || '';

        if (db) {
          const result = db.prepare(`
            INSERT INTO media (name, url, media_type, category, size_bytes, title, caption, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(f.savedName, f.url, f.media_type, category, f.size_bytes, title, caption, currentUser.username);

          savedMediaList.push({
            id: Number(result.lastInsertRowid),
            name: f.savedName,
            originalName: f.originalName,
            url: f.url,
            media_type: f.media_type,
            category,
            size_bytes: f.size_bytes,
            title,
            caption
          });
        } else if (memoryStore) {
          const item = {
            id: memoryStore.media.length + 1,
            name: f.savedName,
            originalName: f.originalName,
            url: f.url,
            media_type: f.media_type,
            category,
            size_bytes: f.size_bytes,
            title,
            caption,
            uploaded_by: currentUser.username,
            created_at: new Date().toISOString()
          };
          memoryStore.media.unshift(item);
          savedMediaList.push(item);
          saveJsonStore();
        }

        logActivity(currentUser.id, currentUser.username, currentUser.role, 'MEDIA_UPLOAD', `Uploaded ${f.media_type}: ${f.savedName} (${Math.round(f.size_bytes / 1024)} KB)`, ip);
      }

      broadcastUpdate('media_updated', { action: 'upload', files: savedMediaList });
      return sendJson(res, 201, {
        success: true,
        message: `${files.length} file(s) uploaded successfully!`,
        files: savedMediaList,
        file: savedMediaList[0]
      });
    } catch (uploadErr) {
      return sendJson(res, 400, { success: false, message: uploadErr.message });
    }
  }

  // ==========================================================================
  // MEDIA LIBRARY MANAGEMENT APIS
  // ==========================================================================
  if ((pathname === '/api/media' || pathname === '/api/admin/media') && method === 'GET') {
    if (!currentUser) return sendJson(res, 401, { success: false, message: 'Authentication required' });

    const category = url.searchParams.get('category') || '';
    const type = url.searchParams.get('type') || '';
    const q = url.searchParams.get('q') || '';

    let mediaList = [];
    let totalStorageBytes = 0;

    if (db) {
      let sql = 'SELECT * FROM media WHERE 1=1';
      const params = [];
      if (category && category !== 'All') {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (type && type !== 'All') {
        sql += ' AND media_type = ?';
        params.push(type);
      }
      if (q) {
        sql += ' AND (name LIKE ? OR title LIKE ? OR caption LIKE ?)';
        const qp = `%${q}%`;
        params.push(qp, qp, qp);
      }
      sql += ' ORDER BY id DESC';
      mediaList = db.prepare(sql).all(...params);

      const totalSize = db.prepare('SELECT SUM(size_bytes) as total, COUNT(*) as count FROM media').get();
      totalStorageBytes = totalSize.total || 0;
    } else if (memoryStore) {
      mediaList = [...memoryStore.media];
      if (category && category !== 'All') mediaList = mediaList.filter(m => m.category === category);
      if (type && type !== 'All') mediaList = mediaList.filter(m => m.media_type === type);
      if (q) {
        const ql = q.toLowerCase();
        mediaList = mediaList.filter(m => m.name.toLowerCase().includes(ql) || (m.title && m.title.toLowerCase().includes(ql)));
      }
      totalStorageBytes = memoryStore.media.reduce((sum, m) => sum + (m.size_bytes || 0), 0);
    }

    return sendJson(res, 200, {
      success: true,
      data: mediaList,
      totalCount: mediaList.length,
      totalStorageBytes,
      storageFormatted: `${(totalStorageBytes / (1024 * 1024)).toFixed(2)} MB`
    });
  }

  // Replace existing media item directly from device upload
  if ((pathname.startsWith('/api/media/') || pathname.startsWith('/api/admin/media/')) && pathname.endsWith('/replace') && method === 'POST') {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Media management required' });
    }
    const mediaId = parseInt(pathname.replace('/api/media/', '').replace('/api/admin/media/', '').replace('/replace', ''), 10);
    try {
      const { fields, files } = await parseMultipartForm(req, UPLOADS_DIR);
      if (files.length === 0) {
        return sendJson(res, 400, { success: false, message: 'No replacement file uploaded' });
      }
      const newFile = files[0];
      let oldItem = null;

      if (db) {
        oldItem = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
        db.prepare(`
          UPDATE media SET
            name = COALESCE(?, name),
            url = ?,
            media_type = ?,
            size_bytes = ?,
            created_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(fields.name || newFile.originalName, newFile.url, newFile.media_type, newFile.size_bytes, mediaId);
      } else if (memoryStore) {
        oldItem = memoryStore.media.find(m => m.id === mediaId);
        if (oldItem) {
          oldItem.name = fields.name || newFile.originalName;
          oldItem.url = newFile.url;
          oldItem.media_type = newFile.media_type;
          oldItem.size_bytes = newFile.size_bytes;
          saveJsonStore();
        }
      }

      // If replacing profile picture or hero banner, auto-update settings!
      if (fields.set_as_profile || fields.set_as_about) {
        if (db) {
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('about_image_url', newFile.url);
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('profile_photo_url', newFile.url);
        } else if (memoryStore) {
          memoryStore.settings.about_image_url = newFile.url;
          memoryStore.settings.profile_photo_url = newFile.url;
          saveJsonStore();
        }
        broadcastUpdate('settings_updated', { about_image_url: newFile.url, profile_photo_url: newFile.url });
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'MEDIA_REPLACE', `Replaced media ID ${mediaId} with ${newFile.savedName}`, ip);
      broadcastUpdate('media_updated', { action: 'replace', id: mediaId, newUrl: newFile.url });

      return sendJson(res, 200, {
        success: true,
        message: 'Media asset replaced successfully!',
        newUrl: newFile.url,
        file: newFile
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  if ((pathname.startsWith('/api/media/') || pathname.startsWith('/api/admin/media/')) && method === 'PUT') {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Media management required' });
    }
    const mediaId = parseInt(pathname.replace('/api/media/', '').replace('/api/admin/media/', ''), 10);
    const body = await parseBody(req);
    const { name, category, title, caption } = body;

    if (db) {
      db.prepare(`
        UPDATE media SET
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          title = COALESCE(?, title),
          caption = COALESCE(?, caption)
        WHERE id = ?
      `).run(name, category, title, caption, mediaId);
    } else if (memoryStore) {
      const item = memoryStore.media.find(m => m.id === mediaId);
      if (item) {
        if (name) item.name = name;
        if (category) item.category = category;
        if (title !== undefined) item.title = title;
        if (caption !== undefined) item.caption = caption;
        saveJsonStore();
      }
    }

    broadcastUpdate('media_updated', { action: 'update', id: mediaId, body });
    return sendJson(res, 200, { success: true, message: 'Media metadata updated successfully' });
  }

  if ((pathname.startsWith('/api/media/') || pathname.startsWith('/api/admin/media/')) && method === 'DELETE') {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Media deletion required' });
    }
    const mediaId = parseInt(pathname.replace('/api/media/', '').replace('/api/admin/media/', ''), 10);
    let item = null;

    if (db) {
      item = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
      if (item) {
        db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);
      }
    } else if (memoryStore) {
      item = memoryStore.media.find(m => m.id === mediaId);
      if (item) {
        memoryStore.media = memoryStore.media.filter(m => m.id !== mediaId);
        saveJsonStore();
      }
    }

    // Try deleting physical file from uploads folder if it exists
    if (item && item.url && item.url.startsWith('/uploads/')) {
      const diskPath = path.join(UPLOADS_DIR, path.basename(item.url));
      if (fs.existsSync(diskPath)) {
        try { fs.unlinkSync(diskPath); } catch (e) {}
      }
    }

    logActivity(currentUser.id, currentUser.username, currentUser.role, 'MEDIA_DELETE', `Deleted media ID ${mediaId} (${item?.name || 'Asset'})`, ip);
    broadcastUpdate('media_updated', { action: 'delete', id: mediaId });
    return sendJson(res, 200, { success: true, message: 'Media item deleted permanently' });
  }

  // ==========================================================================
  // OWNER DASHBOARD & VISUAL DESIGN CUSTOMIZER APIS
  // ==========================================================================
  if (pathname.startsWith('/api/owner/')) {
    if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'super_admin')) {
      return sendJson(res, 403, {
        success: false,
        message: 'Forbidden: Owner level authority required.'
      });
    }

    // A. Owner Analytics Overview
    if (pathname === '/api/owner/analytics' && method === 'GET') {
      let stats = {};
      if (db) {
        const totalUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").get().count;
        const totalAdmins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role IN ('admin', 'editor', 'super_admin')").get().count;
        const totalContent = db.prepare('SELECT COUNT(*) AS count FROM content').get().count;
        const publishedContent = db.prepare("SELECT COUNT(*) AS count FROM content WHERE status = 'published'").get().count;
        const totalViews = db.prepare('SELECT SUM(views) AS sum FROM content').get().sum || 0;
        const unreadMessages = db.prepare("SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'unread'").get().count;
        const totalMedia = db.prepare('SELECT COUNT(*) AS count FROM media').get().count;
        const totalMediaBytes = db.prepare('SELECT SUM(size_bytes) AS sum FROM media').get().sum || 0;

        stats = {
          totalUsers,
          totalAdmins,
          totalContent,
          publishedContent,
          totalViews,
          unreadMessages,
          totalMedia,
          totalStorageMB: (totalMediaBytes / (1024 * 1024)).toFixed(1),
          serverUptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          databaseType: 'SQLite3'
        };
      } else if (memoryStore) {
        stats = {
          totalUsers: memoryStore.users.filter(u => u.role === 'user').length,
          totalAdmins: memoryStore.users.filter(u => u.role !== 'user' && u.role !== 'owner').length,
          totalContent: memoryStore.content.length,
          publishedContent: memoryStore.content.filter(c => c.status === 'published').length,
          totalViews: memoryStore.content.reduce((sum, c) => sum + (c.views || 0), 0),
          unreadMessages: memoryStore.contact_messages.filter(m => m.status === 'unread').length,
          totalMedia: memoryStore.media.length,
          totalStorageMB: (memoryStore.media.reduce((s, m) => s + (m.size_bytes || 0), 0) / (1024 * 1024)).toFixed(1),
          serverUptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          databaseType: 'MemoryStore'
        };
      }
      return sendJson(res, 200, { success: true, data: stats });
    }

    // B. Theme Visual Editor: Get Draft & Published Theme
    if (pathname === '/api/owner/theme' && method === 'GET') {
      let publishedTheme = null;
      let draftTheme = null;

      if (db) {
        publishedTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 0 ORDER BY id DESC LIMIT 1').get() || DEFAULT_THEME;
        draftTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 1 ORDER BY id DESC LIMIT 1').get() || publishedTheme;
      } else if (memoryStore) {
        publishedTheme = memoryStore.theme || DEFAULT_THEME;
        draftTheme = memoryStore.draft_theme || publishedTheme;
      }

      return sendJson(res, 200, {
        success: true,
        data: {
          published: publishedTheme,
          draft: draftTheme,
          has_draft: JSON.stringify(publishedTheme) !== JSON.stringify(draftTheme)
        }
      });
    }

    // C. Theme Visual Editor: Save Draft Theme
    if (pathname === '/api/owner/theme/draft' && method === 'PUT') {
      const body = await parseBody(req);
      const fields = [
        'primary_color', 'secondary_color', 'accent_color', 'bg_dark', 'bg_card',
        'text_main', 'text_muted', 'font_family', 'font_size_base', 'border_radius',
        'button_radius', 'hero_overlay_opacity', 'hero_overlay_blur', 'animation_speed',
        'theme_mode', 'custom_css'
      ];

      if (db) {
        // Upsert draft theme (is_draft = 1)
        const checkDraft = db.prepare('SELECT id FROM theme_settings WHERE is_draft = 1').get();
        if (checkDraft) {
          const sets = fields.map(f => `${f} = ?`).join(', ');
          const values = fields.map(f => body[f] !== undefined ? body[f] : DEFAULT_THEME[f]);
          values.push(checkDraft.id);
          db.prepare(`UPDATE theme_settings SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
        } else {
          const cols = fields.join(', ');
          const placeholders = fields.map(() => '?').join(', ');
          const values = fields.map(f => body[f] !== undefined ? body[f] : DEFAULT_THEME[f]);
          db.prepare(`INSERT INTO theme_settings (name, is_draft, ${cols}) VALUES ('draft', 1, ${placeholders})`).run(...values);
        }
      } else if (memoryStore) {
        memoryStore.draft_theme = Object.assign({}, memoryStore.draft_theme || DEFAULT_THEME, body, { is_draft: 1 });
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'THEME_DRAFT_SAVE', 'Saved theme draft customization', ip);
      return sendJson(res, 200, { success: true, message: 'Draft theme saved! Live Preview is active.' });
    }

    // D. Theme Visual Editor: Publish Draft Theme
    if (pathname === '/api/owner/theme/publish' && method === 'POST') {
      let draft = null;
      if (db) {
        draft = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 1').get();
        if (draft) {
          const fields = [
            'primary_color', 'secondary_color', 'accent_color', 'bg_dark', 'bg_card',
            'text_main', 'text_muted', 'font_family', 'font_size_base', 'border_radius',
            'button_radius', 'hero_overlay_opacity', 'hero_overlay_blur', 'animation_speed',
            'theme_mode', 'custom_css'
          ];
          const sets = fields.map(f => `${f} = ?`).join(', ');
          const values = fields.map(f => draft[f]);

          // Update published theme
          const checkPub = db.prepare('SELECT id FROM theme_settings WHERE is_draft = 0').get();
          if (checkPub) {
            values.push(checkPub.id);
            db.prepare(`UPDATE theme_settings SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
          } else {
            const cols = fields.join(', ');
            const placeholders = fields.map(() => '?').join(', ');
            db.prepare(`INSERT INTO theme_settings (name, is_draft, ${cols}) VALUES ('published', 0, ${placeholders})`).run(...values);
          }
        }
      } else if (memoryStore) {
        if (memoryStore.draft_theme) {
          memoryStore.theme = Object.assign({}, memoryStore.draft_theme, { is_draft: 0 });
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'THEME_PUBLISH', 'Published new website theme live to public', ip);
      let publishedTheme = null;
      if (db) {
        publishedTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 0 ORDER BY id DESC LIMIT 1').get();
      } else if (memoryStore) {
        publishedTheme = memoryStore.theme;
      }
      broadcastUpdate('theme_updated', publishedTheme || draft);
      return sendJson(res, 200, {
        success: true,
        message: 'Theme published live! All visitors see updated design.',
        data: { preset_name: draft?.name || 'Custom Theme', ...(publishedTheme || draft || {}) }
      });
    }

    // E. Theme Visual Editor: Reset to Default Theme
    if (pathname === '/api/owner/theme/reset' && method === 'POST') {
      if (db) {
        db.prepare('DELETE FROM theme_settings').run();
        seedDatabaseSQLite();
      } else if (memoryStore) {
        memoryStore.theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
        memoryStore.draft_theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
        saveJsonStore();
      }
      broadcastUpdate('theme_updated', DEFAULT_THEME);
      return sendJson(res, 200, { success: true, message: 'Theme reset to default studio styling' });
    }

    // F. Section & Layout Manager: Get All Sections
    if (pathname === '/api/owner/sections' && method === 'GET') {
      let sections = [];
      if (db) {
        sections = db.prepare('SELECT * FROM sections ORDER BY sort_order ASC').all();
      } else if (memoryStore) {
        sections = [...(memoryStore.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
      }
      return sendJson(res, 200, { success: true, data: sections });
    }

    // G. Section & Layout Manager: Update Section
    if (pathname.startsWith('/api/owner/sections/') && method === 'PUT') {
      const sectionId = parseInt(pathname.replace('/api/owner/sections/', ''), 10);
      const body = await parseBody(req);
      const { title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value, custom_css, content_json } = body;

      const contentJsonStr = content_json !== undefined ? (typeof content_json === 'object' ? JSON.stringify(content_json) : content_json) : null;

      if (db) {
        db.prepare(`
          UPDATE sections SET
            title = COALESCE(?, title),
            title_ta = COALESCE(?, title_ta),
            subtitle = COALESCE(?, subtitle),
            subtitle_ta = COALESCE(?, subtitle_ta),
            content_json = COALESCE(?, content_json),
            is_visible = COALESCE(?, is_visible),
            sort_order = COALESCE(?, sort_order),
            background_type = COALESCE(?, background_type),
            background_value = COALESCE(?, background_value),
            custom_css = COALESCE(?, custom_css),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          title !== undefined ? title : null,
          title_ta !== undefined ? title_ta : null,
          subtitle !== undefined ? subtitle : null,
          subtitle_ta !== undefined ? subtitle_ta : null,
          contentJsonStr,
          is_visible !== undefined ? is_visible : null,
          sort_order !== undefined ? sort_order : null,
          background_type !== undefined ? background_type : null,
          background_value !== undefined ? background_value : null,
          custom_css !== undefined ? custom_css : null,
          sectionId
        );
      } else if (memoryStore) {
        const sec = memoryStore.sections.find(s => s.id === sectionId);
        if (sec) {
          if (title !== undefined) sec.title = title;
          if (title_ta !== undefined) sec.title_ta = title_ta;
          if (subtitle !== undefined) sec.subtitle = subtitle;
          if (subtitle_ta !== undefined) sec.subtitle_ta = subtitle_ta;
          if (contentJsonStr !== null) sec.content_json = contentJsonStr;
          if (is_visible !== undefined) sec.is_visible = is_visible;
          if (sort_order !== undefined) sec.sort_order = sort_order;
          if (background_type !== undefined) sec.background_type = background_type;
          if (background_value !== undefined) sec.background_value = background_value;
          if (custom_css !== undefined) sec.custom_css = custom_css;
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'SECTION_UPDATE', `Updated section ID ${sectionId}`, ip);
      broadcastUpdate('sections_updated', getAllSections());
      return sendJson(res, 200, { success: true, message: 'Section settings saved successfully' });
    }

    // H. Section & Layout Manager: Batch Reorder Sections
    if (pathname === '/api/owner/sections/reorder' && method === 'POST') {
      const body = await parseBody(req);
      const items = body.items || body.order || body.sections || [];

      if (Array.isArray(items)) {
        if (db) {
          const update = db.prepare('UPDATE sections SET sort_order = ? WHERE id = ?');
          items.forEach(it => update.run(it.sort_order, it.id));
        } else if (memoryStore) {
          items.forEach(it => {
            const sec = memoryStore.sections.find(s => s.id === it.id);
            if (sec) sec.sort_order = it.sort_order;
          });
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'SECTIONS_REORDER', 'Reordered website sections sequence', ip);
      broadcastUpdate('sections_updated', getAllSections());
      return sendJson(res, 200, { success: true, message: 'Sections reordered successfully!' });
    }

    // I. Section & Layout Manager: Create Custom Section
    if (pathname === '/api/owner/sections' && method === 'POST') {
      const body = await parseBody(req);
      const { section_id, title, title_ta, subtitle, subtitle_ta, background_type, background_value } = body;

      if (!title || !section_id) {
        return sendJson(res, 400, { success: false, message: 'Section ID and Title required' });
      }

      if (db) {
        try {
          const result = db.prepare(`
            INSERT INTO sections (section_id, title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value)
            VALUES (?, ?, ?, ?, ?, 1, 99, ?, ?)
          `).run(section_id, title, title_ta || '', subtitle || '', subtitle_ta || '', background_type || 'color', background_value || '#0C0F17');
          broadcastUpdate('sections_updated', getAllSections());
          return sendJson(res, 201, { success: true, message: 'New section created!', id: Number(result.lastInsertRowid) });
        } catch (err) {
          return sendJson(res, 409, { success: false, message: 'Section ID already exists' });
        }
      } else if (memoryStore) {
        const item = {
          id: memoryStore.sections.length + 1,
          section_id,
          title,
          title_ta: title_ta || '',
          subtitle: subtitle || '',
          subtitle_ta: subtitle_ta || '',
          is_visible: 1,
          sort_order: 99,
          background_type: background_type || 'color',
          background_value: background_value || '#0C0F17'
        };
        memoryStore.sections.push(item);
        saveJsonStore();
        broadcastUpdate('sections_updated', getAllSections());
        return sendJson(res, 201, { success: true, message: 'New section created!', id: item.id });
      }
    }

    // J. Section & Layout Manager: Delete Section
    if (pathname.startsWith('/api/owner/sections/') && method === 'DELETE') {
      const sectionId = parseInt(pathname.replace('/api/owner/sections/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM sections WHERE id = ?').run(sectionId);
      } else if (memoryStore) {
        memoryStore.sections = memoryStore.sections.filter(s => s.id !== sectionId);
        saveJsonStore();
      }
      broadcastUpdate('sections_updated', getAllSections());
      return sendJson(res, 200, { success: true, message: 'Section removed successfully' });
    }

    // K. Owner Settings: Save Draft Branding & System Config
    if (pathname === '/api/owner/settings/draft' && method === 'PUT') {
      const body = await parseBody(req);
      const now = new Date().toISOString();

      if (db) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .run('draft_branding', JSON.stringify(body));
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .run('last_saved', now);
      } else if (memoryStore) {
        memoryStore.draft_settings = Object.assign({}, memoryStore.draft_settings, body);
        memoryStore.settings.last_saved = now;
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'DRAFT_SETTINGS_SAVE', 'Saved website settings draft', ip);
      return sendJson(res, 200, { success: true, message: 'Draft settings saved safely!', last_saved: now });
    }

    // L. Owner Settings: Publish Draft Settings Live
    if (pathname === '/api/owner/settings/publish' && method === 'POST') {
      const now = new Date().toISOString();
      let draftData = {};

      if (db) {
        const draftRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('draft_branding');
        if (draftRow && draftRow.value) {
          try { draftData = JSON.parse(draftRow.value); } catch (e) {}
        }
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        for (const [key, value] of Object.entries(draftData)) {
          updateSetting.run(key, String(value));
        }
        updateSetting.run('last_published', now);
      } else if (memoryStore) {
        if (memoryStore.draft_settings) {
          Object.assign(memoryStore.settings, memoryStore.draft_settings);
          memoryStore.settings.last_published = now;
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'SETTINGS_PUBLISH', 'Published all branding settings live to website', ip);
      return sendJson(res, 200, { success: true, message: 'Website settings published live!', last_published: now });
    }

    // M. Owner Settings: Direct Save (Live DB Persistence)
    if (pathname === '/api/owner/settings' && (method === 'PUT' || method === 'POST')) {
      const body = await parseBody(req);
      const now = new Date().toISOString();

      if (db) {
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        for (const [key, value] of Object.entries(body)) {
          updateSetting.run(key, String(value));
        }
        updateSetting.run('last_saved', now);
        updateSetting.run('last_published', now);
      } else if (memoryStore) {
        Object.assign(memoryStore.settings, body);
        memoryStore.settings.last_saved = now;
        memoryStore.settings.last_published = now;
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, 'owner', 'SETTINGS_UPDATE', 'Updated site branding and system settings', ip);
      broadcastUpdate('settings_updated', getAllSettings());
      return sendJson(res, 200, {
        success: true,
        message: 'Settings and branding updated successfully in database!',
        last_saved: now,
        last_published: now
      });
    }

    // N. Owner Activity Logs
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

    // O. Manage Admins & Roles
    if (pathname === '/api/owner/admins' && method === 'GET') {
      let admins = [];
      if (db) {
        admins = db.prepare(`
          SELECT id, username, email, role, permissions, status, created_at, last_login
          FROM users WHERE role != 'user' ORDER BY id ASC
        `).all();
        admins.forEach(a => {
          try { a.permissions = JSON.parse(a.permissions); } catch (e) { a.permissions = {}; }
        });
      } else if (memoryStore) {
        admins = memoryStore.users.filter(u => u.role !== 'user').map(u => ({
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

    if (pathname === '/api/owner/admins' && method === 'POST') {
      const body = await parseBody(req);
      const { username, email, password, role = 'admin', permissions } = body;

      if (!username || !email || !password) {
        return sendJson(res, 400, { success: false, message: 'Username, email, and password required' });
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
            VALUES (?, ?, ?, ?, ?, ?, 'active')
          `).run(username, email, hash, salt, role, permsJson);

          logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_CREATE', `Created account ${username} (${role})`, ip);
          return sendJson(res, 201, { success: true, message: `Account ${username} created!`, adminId: Number(result.lastInsertRowid) });
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
          role,
          permissions: JSON.parse(permsJson),
          avatar: '',
          status: 'active',
          created_at: new Date().toISOString()
        };
        memoryStore.users.push(newAdmin);
        saveJsonStore();
        return sendJson(res, 201, { success: true, message: `Account ${username} created!`, adminId: newAdmin.id });
      }
    }

    if (pathname.startsWith('/api/owner/admins/') && method === 'DELETE') {
      const adminId = parseInt(pathname.replace('/api/owner/admins/', ''), 10);
      let targetUser = null;
      if (db) {
        targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
      } else if (memoryStore) {
        targetUser = memoryStore.users.find(u => u.id === adminId);
      }

      if (!targetUser) return sendJson(res, 404, { success: false, message: 'Account not found' });
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

      logActivity(currentUser.id, currentUser.username, 'owner', 'ADMIN_DELETE', `Removed admin ${targetUser.username}`, ip);
      return sendJson(res, 200, { success: true, message: `Admin ${targetUser.username} removed successfully` });
    }
  }

  // ==========================================================================
  // SUPER ADMIN PLATFORM & SECURITY MANAGEMENT APIS
  // ==========================================================================
  if (pathname.startsWith('/api/admin/')) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'owner' && currentUser.role !== 'editor')) {
      return sendJson(res, 403, { success: false, message: 'Forbidden: Admin access required' });
    }

    const perms = (currentUser.role === 'owner' || currentUser.role === 'super_admin') ? { all: true } : (currentUser.permissions || {});
    function checkAdminPerm(permKey) {
      if (currentUser.role === 'owner' || currentUser.role === 'super_admin') return true;
      return !!perms[permKey];
    }

    // A. System Health & Diagnostics
    if (pathname === '/api/admin/system-health' && method === 'GET') {
      const memoryUsage = process.memoryUsage();
      let tableCounts = { users: 0, content: 0, media: 0, sections: 0, theme_settings: 0, settings: 0, contact_messages: 0, audit_logs: 0 };
      let dbStats = { engine: db ? 'sqlite3' : 'MemoryStore', path: DB_FILE, fileSizeKb: 0, tableCounts };

      if (fs.existsSync(DB_FILE)) {
        try { dbStats.fileSizeKb = Math.round(fs.statSync(DB_FILE).size / 1024); } catch (e) {}
      }

      if (db) {
        try {
          dbStats.tableCounts.users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
          dbStats.tableCounts.content = db.prepare('SELECT COUNT(*) as c FROM content').get().c;
          dbStats.tableCounts.media = db.prepare('SELECT COUNT(*) as c FROM media').get().c;
          dbStats.tableCounts.sections = db.prepare('SELECT COUNT(*) as c FROM sections').get().c;
          dbStats.tableCounts.theme_settings = db.prepare('SELECT COUNT(*) as c FROM theme_settings').get().c;
          dbStats.tableCounts.settings = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
          dbStats.tableCounts.contact_messages = db.prepare('SELECT COUNT(*) as c FROM contact_messages').get().c;
          dbStats.tableCounts.audit_logs = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;
        } catch (e) {}
      } else if (memoryStore) {
        dbStats.tableCounts.users = memoryStore.users.length;
        dbStats.tableCounts.content = memoryStore.content.length;
        dbStats.tableCounts.media = memoryStore.media.length;
        dbStats.tableCounts.sections = memoryStore.sections.length;
        dbStats.tableCounts.theme_settings = 1;
        dbStats.tableCounts.settings = Object.keys(memoryStore.settings).length;
        dbStats.tableCounts.contact_messages = memoryStore.contact_messages.length;
        dbStats.tableCounts.audit_logs = memoryStore.audit_logs.length;
      }

      let totalMediaFiles = 0;
      let totalUploadsBytes = 0;
      if (fs.existsSync(UPLOADS_DIR)) {
        try {
          const files = fs.readdirSync(UPLOADS_DIR);
          totalMediaFiles = files.length;
          files.forEach(f => {
            try { totalUploadsBytes += fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch (e) {}
          });
        } catch (e) {}
      }

      const health = {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          memory: {
            rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(1),
            heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
            heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1)
          }
        },
        database: dbStats,
        storage: {
          uploadsDirectory: UPLOADS_DIR,
          storedFilesCount: totalMediaFiles,
          totalBytesMb: (totalUploadsBytes / 1024 / 1024).toFixed(2)
        },
        status: 'Operational'
      };
      return sendJson(res, 200, { success: true, data: health });
    }

    // B. Database Backup Export (JSON Download)
    if (pathname === '/api/admin/backup' && method === 'GET') {
      if (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
        return sendJson(res, 403, { success: false, message: 'Forbidden: Super Admin authority required to export database backup' });
      }

      let backup = {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        users: [],
        content: [],
        media: [],
        sections: [],
        theme_settings: [],
        settings: {},
        contact_messages: []
      };

      if (db) {
        backup.users = db.prepare('SELECT id, username, email, role, permissions, status, created_at FROM users').all();
        backup.content = db.prepare('SELECT * FROM content').all();
        backup.media = db.prepare('SELECT * FROM media').all();
        backup.sections = db.prepare('SELECT * FROM sections').all();
        backup.theme_settings = db.prepare('SELECT * FROM theme_settings').all();
        backup.contact_messages = db.prepare('SELECT * FROM contact_messages').all();
        const settingsRows = db.prepare('SELECT key, value FROM settings').all();
        settingsRows.forEach(r => backup.settings[r.key] = r.value);
      } else if (memoryStore) {
        backup.users = memoryStore.users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, permissions: u.permissions, status: u.status, created_at: u.created_at }));
        backup.content = memoryStore.content;
        backup.media = memoryStore.media;
        backup.sections = memoryStore.sections;
        backup.theme_settings = [memoryStore.theme];
        backup.contact_messages = memoryStore.contact_messages;
        backup.settings = memoryStore.settings;
      }

      const filename = `sasi_portfolio_backup_${Date.now()}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      res.end(JSON.stringify(backup, null, 2));
      logActivity(currentUser.id, currentUser.username, currentUser.role, 'BACKUP_EXPORT', 'Downloaded full database backup JSON snapshot', ip);
      return;
    }

    // C. Database Restore Snapshot
    if (pathname === '/api/admin/restore' && method === 'POST') {
      if (currentUser.role !== 'owner' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
        return sendJson(res, 403, { success: false, message: 'Forbidden: Super Admin authority required to restore backup' });
      }

      const backup = await parseBody(req);
      if (!backup || !backup.settings) {
        return sendJson(res, 400, { success: false, message: 'Invalid database backup JSON structure' });
      }

      if (db) {
        if (Array.isArray(backup.sections) && backup.sections.length > 0) {
          db.prepare('DELETE FROM sections').run();
          const ins = db.prepare('INSERT INTO sections (section_id, title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
          backup.sections.forEach(s => ins.run(s.section_id, s.title, s.title_ta || '', s.subtitle || '', s.subtitle_ta || '', s.is_visible, s.sort_order, s.background_type || 'color', s.background_value || '#07090E'));
        }
        if (backup.settings) {
          const insSet = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
          for (const [k, v] of Object.entries(backup.settings)) {
            insSet.run(k, String(v));
          }
        }
      } else if (memoryStore) {
        if (backup.sections) memoryStore.sections = backup.sections;
        if (backup.settings) Object.assign(memoryStore.settings, backup.settings);
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'BACKUP_RESTORE', 'Restored database state from backup snapshot', ip);
      broadcastUpdate('full_refresh', { message: 'Database state restored from backup snapshot' });
      return sendJson(res, 200, { success: true, message: 'Database state restored successfully!' });
    }

    // D. Admin Stats Summary
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

    // E. Content Management CRUD
    if (pathname === '/api/admin/content' && method === 'GET') {
      let items = [];
      if (db) {
        items = db.prepare('SELECT * FROM content ORDER BY sort_order ASC, id DESC').all();
      } else if (memoryStore) {
        items = [...memoryStore.content].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
      return sendJson(res, 200, { success: true, data: items });
    }

    if (pathname === '/api/admin/content' && method === 'POST') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content management restricted' });
      }
      const body = await parseBody(req);
      const { title, title_ta, excerpt, excerpt_ta, content, content_ta, category, tags, media_url, media_type, thumbnail_url, status, sort_order } = body;

      if (!title) return sendJson(res, 400, { success: false, message: 'Title is required' });
      const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'post') + '-' + Date.now();

      if (db) {
        const result = db.prepare(`
          INSERT INTO content (title, title_ta, slug, excerpt, excerpt_ta, content, content_ta, category, tags, media_url, media_type, thumbnail_url, status, sort_order, views, author_id, author_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(title, title_ta || '', slug, excerpt || '', excerpt_ta || '', content || '', content_ta || '', category || 'General', tags || '', media_url || '', media_type || 'image', thumbnail_url || '', status || 'published', sort_order || 0, currentUser.id, currentUser.username);

        logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_CREATE', `Created post: ${title}`, ip);
        broadcastUpdate('content_updated', { action: 'create', id: Number(result.lastInsertRowid) });
        return sendJson(res, 201, { success: true, message: 'Content created successfully', id: Number(result.lastInsertRowid) });
      } else if (memoryStore) {
        const newPost = {
          id: memoryStore.content.length + 1,
          title, title_ta: title_ta || '', slug,
          excerpt: excerpt || '', excerpt_ta: excerpt_ta || '',
          content: content || '', content_ta: content_ta || '',
          category: category || 'General', tags: tags || '',
          media_url: media_url || '', media_type: media_type || 'image',
          thumbnail_url: thumbnail_url || '', status: status || 'published',
          sort_order: sort_order || 0, views: 0,
          author_id: currentUser.id, author_name: currentUser.username,
          created_at: new Date().toISOString()
        };
        memoryStore.content.unshift(newPost);
        saveJsonStore();
        logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_CREATE', `Created post: ${title}`, ip);
        broadcastUpdate('content_updated', { action: 'create', id: newPost.id });
        return sendJson(res, 201, { success: true, message: 'Content created successfully', id: newPost.id });
      }
    }

    if (pathname.startsWith('/api/admin/content/') && method === 'PUT') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content management restricted' });
      }
      const postId = parseInt(pathname.replace('/api/admin/content/', ''), 10);
      const body = await parseBody(req);
      const { title, title_ta, excerpt, excerpt_ta, content, content_ta, category, tags, media_url, media_type, thumbnail_url, status, sort_order } = body;

      if (db) {
        db.prepare(`
          UPDATE content SET
            title = COALESCE(?, title),
            title_ta = COALESCE(?, title_ta),
            excerpt = COALESCE(?, excerpt),
            excerpt_ta = COALESCE(?, excerpt_ta),
            content = COALESCE(?, content),
            content_ta = COALESCE(?, content_ta),
            category = COALESCE(?, category),
            tags = COALESCE(?, tags),
            media_url = COALESCE(?, media_url),
            media_type = COALESCE(?, media_type),
            thumbnail_url = COALESCE(?, thumbnail_url),
            status = COALESCE(?, status),
            sort_order = COALESCE(?, sort_order),
            updated_at = CURRENT_TIMESTAMP
        `).run(
          title !== undefined ? title : null,
          title_ta !== undefined ? title_ta : null,
          excerpt !== undefined ? excerpt : null,
          excerpt_ta !== undefined ? excerpt_ta : null,
          content !== undefined ? content : null,
          content_ta !== undefined ? content_ta : null,
          category !== undefined ? category : null,
          tags !== undefined ? tags : null,
          media_url !== undefined ? media_url : null,
          media_type !== undefined ? media_type : null,
          thumbnail_url !== undefined ? thumbnail_url : null,
          status !== undefined ? status : null,
          sort_order !== undefined ? sort_order : null,
          postId
        );
      } else if (memoryStore) {
        const post = memoryStore.content.find(c => c.id === postId);
        if (post) {
          if (title !== undefined) post.title = title;
          if (title_ta !== undefined) post.title_ta = title_ta;
          if (excerpt !== undefined) post.excerpt = excerpt;
          if (excerpt_ta !== undefined) post.excerpt_ta = excerpt_ta;
          if (content !== undefined) post.content = content;
          if (content_ta !== undefined) post.content_ta = content_ta;
          if (category !== undefined) post.category = category;
          if (tags !== undefined) post.tags = tags;
          if (media_url !== undefined) post.media_url = media_url;
          if (media_type !== undefined) post.media_type = media_type;
          if (thumbnail_url !== undefined) post.thumbnail_url = thumbnail_url;
          if (status !== undefined) post.status = status;
          if (sort_order !== undefined) post.sort_order = sort_order;
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_UPDATE', `Updated post ID ${postId}`, ip);
      broadcastUpdate('content_updated', { action: 'update', id: postId });
      return sendJson(res, 200, { success: true, message: 'Content updated successfully' });
    }

    if (pathname.startsWith('/api/admin/content/') && method === 'DELETE') {
      if (!checkAdminPerm('can_manage_content')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Content deletion restricted' });
      }
      const postId = parseInt(pathname.replace('/api/admin/content/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM content WHERE id = ?').run(postId);
      } else if (memoryStore) {
        memoryStore.content = memoryStore.content.filter(c => c.id !== postId);
        saveJsonStore();
      }
      logActivity(currentUser.id, currentUser.username, currentUser.role, 'CONTENT_DELETE', `Deleted post ID ${postId}`, ip);
      broadcastUpdate('content_updated', { action: 'delete', id: postId });
      return sendJson(res, 200, { success: true, message: 'Content post deleted' });
    }

    // F. User Management
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!checkAdminPerm('can_manage_users')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: User management restricted' });
      }
      let users = [];
      if (db) {
        users = db.prepare("SELECT id, username, email, role, status, created_at, last_login FROM users WHERE role = 'user' ORDER BY id DESC").all();
      } else if (memoryStore) {
        users = memoryStore.users.filter(u => u.role === 'user');
      }
      return sendJson(res, 200, { success: true, data: users });
    }

    if (pathname.startsWith('/api/admin/users/') && method === 'PUT') {
      if (!checkAdminPerm('can_manage_users')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: User management restricted' });
      }
      const targetUserId = parseInt(pathname.replace('/api/admin/users/', ''), 10);
      const body = await parseBody(req);
      const { status } = body;

      if (db) {
        db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, targetUserId);
      } else if (memoryStore) {
        const u = memoryStore.users.find(x => x.id === targetUserId);
        if (u) { u.status = status; saveJsonStore(); }
      }
      return sendJson(res, 200, { success: true, message: 'User status updated' });
    }

    // G. Contact Inquiries & Feedback
    if (pathname === '/api/admin/messages' && method === 'GET') {
      if (!checkAdminPerm('can_manage_feedback')) {
        return sendJson(res, 403, { success: false, message: 'Permission denied: Feedback management restricted' });
      }
      let msgs = [];
      if (db) {
        msgs = db.prepare('SELECT * FROM contact_messages ORDER BY id DESC').all();
      } else if (memoryStore) {
        msgs = [...memoryStore.contact_messages].reverse();
      }
      return sendJson(res, 200, { success: true, data: msgs });
    }

    if (pathname.startsWith('/api/admin/messages/') && method === 'PUT') {
      const msgId = parseInt(pathname.replace('/api/admin/messages/', ''), 10);
      const body = await parseBody(req);
      if (db) {
        db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(body.status, msgId);
      } else if (memoryStore) {
        const m = memoryStore.contact_messages.find(x => x.id === msgId);
        if (m) { m.status = body.status; saveJsonStore(); }
      }
      return sendJson(res, 200, { success: true, message: 'Inquiry status updated' });
    }

    if (pathname.startsWith('/api/admin/messages/') && method === 'DELETE') {
      const msgId = parseInt(pathname.replace('/api/admin/messages/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM contact_messages WHERE id = ?').run(msgId);
      } else if (memoryStore) {
        memoryStore.contact_messages = memoryStore.contact_messages.filter(x => x.id !== msgId);
        saveJsonStore();
      }
      return sendJson(res, 200, { success: true, message: 'Inquiry deleted' });
    }

    // H. Super Admin Website Settings & Personal Branding Management
    if (pathname === '/api/admin/settings' && method === 'GET') {
      return sendJson(res, 200, { success: true, data: getAllSettings() });
    }

    if (pathname === '/api/admin/settings' && (method === 'PUT' || method === 'POST')) {
      const body = await parseBody(req);
      const now = new Date().toISOString();

      if (db) {
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        for (const [key, value] of Object.entries(body)) {
          updateSetting.run(key, String(value));
        }
        updateSetting.run('last_saved', now);
        updateSetting.run('last_published', now);
      } else if (memoryStore) {
        Object.assign(memoryStore.settings, body);
        memoryStore.settings.last_saved = now;
        memoryStore.settings.last_published = now;
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'ADMIN_SETTINGS_UPDATE', 'Updated website settings and about profile via Super Admin', ip);
      const updated = getAllSettings();
      broadcastUpdate('settings_updated', updated);
      return sendJson(res, 200, {
        success: true,
        message: 'Website settings saved and broadcast to live website!',
        data: updated,
        last_saved: now,
        last_published: now
      });
    }

    // I. Super Admin Sections & Layout Management
    if (pathname === '/api/admin/sections' && method === 'GET') {
      return sendJson(res, 200, { success: true, data: getAllSections() });
    }

    if (pathname.startsWith('/api/admin/sections/') && method === 'PUT') {
      const sectionId = parseInt(pathname.replace('/api/admin/sections/', ''), 10);
      const body = await parseBody(req);
      const { title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value, custom_css, content_json } = body;
      const contentJsonStr = content_json !== undefined ? (typeof content_json === 'object' ? JSON.stringify(content_json) : content_json) : null;

      if (db) {
        db.prepare(`
          UPDATE sections SET
            title = COALESCE(?, title),
            title_ta = COALESCE(?, title_ta),
            subtitle = COALESCE(?, subtitle),
            subtitle_ta = COALESCE(?, subtitle_ta),
            content_json = COALESCE(?, content_json),
            is_visible = COALESCE(?, is_visible),
            sort_order = COALESCE(?, sort_order),
            background_type = COALESCE(?, background_type),
            background_value = COALESCE(?, background_value),
            custom_css = COALESCE(?, custom_css),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          title !== undefined ? title : null,
          title_ta !== undefined ? title_ta : null,
          subtitle !== undefined ? subtitle : null,
          subtitle_ta !== undefined ? subtitle_ta : null,
          contentJsonStr,
          is_visible !== undefined ? is_visible : null,
          sort_order !== undefined ? sort_order : null,
          background_type !== undefined ? background_type : null,
          background_value !== undefined ? background_value : null,
          custom_css !== undefined ? custom_css : null,
          sectionId
        );
      } else if (memoryStore) {
        const sec = memoryStore.sections.find(s => s.id === sectionId);
        if (sec) {
          if (title !== undefined) sec.title = title;
          if (title_ta !== undefined) sec.title_ta = title_ta;
          if (subtitle !== undefined) sec.subtitle = subtitle;
          if (subtitle_ta !== undefined) sec.subtitle_ta = subtitle_ta;
          if (contentJsonStr !== null) sec.content_json = contentJsonStr;
          if (is_visible !== undefined) sec.is_visible = is_visible;
          if (sort_order !== undefined) sec.sort_order = sort_order;
          if (background_type !== undefined) sec.background_type = background_type;
          if (background_value !== undefined) sec.background_value = background_value;
          if (custom_css !== undefined) sec.custom_css = custom_css;
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'ADMIN_SECTION_UPDATE', `Updated section ID ${sectionId}`, ip);
      const sections = getAllSections();
      broadcastUpdate('sections_updated', sections);
      return sendJson(res, 200, { success: true, message: 'Section settings saved and updated live!' });
    }

    if (pathname === '/api/admin/sections/reorder' && method === 'POST') {
      const body = await parseBody(req);
      const items = body.items || body.order || body.sections || [];

      if (Array.isArray(items)) {
        if (db) {
          const update = db.prepare('UPDATE sections SET sort_order = ? WHERE id = ?');
          items.forEach(it => update.run(it.sort_order, it.id));
        } else if (memoryStore) {
          items.forEach(it => {
            const sec = memoryStore.sections.find(s => s.id === it.id);
            if (sec) sec.sort_order = it.sort_order;
          });
          saveJsonStore();
        }
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'ADMIN_SECTIONS_REORDER', 'Reordered sections sequence', ip);
      const sections = getAllSections();
      broadcastUpdate('sections_updated', sections);
      return sendJson(res, 200, { success: true, message: 'Sections reordered successfully!' });
    }

    if (pathname === '/api/admin/sections' && method === 'POST') {
      const body = await parseBody(req);
      const { section_id, title, title_ta, subtitle, subtitle_ta, background_type, background_value } = body;

      if (!title || !section_id) {
        return sendJson(res, 400, { success: false, message: 'Section ID and Title required' });
      }

      if (db) {
        try {
          const result = db.prepare(`
            INSERT INTO sections (section_id, title, title_ta, subtitle, subtitle_ta, is_visible, sort_order, background_type, background_value)
            VALUES (?, ?, ?, ?, ?, 1, 99, ?, ?)
          `).run(section_id, title, title_ta || '', subtitle || '', subtitle_ta || '', background_type || 'color', background_value || '#0C0F17');
          const sections = getAllSections();
          broadcastUpdate('sections_updated', sections);
          return sendJson(res, 201, { success: true, message: 'New section created live!', id: Number(result.lastInsertRowid) });
        } catch (err) {
          return sendJson(res, 409, { success: false, message: 'Section ID already exists' });
        }
      } else if (memoryStore) {
        const item = {
          id: memoryStore.sections.length + 1,
          section_id,
          title,
          title_ta: title_ta || '',
          subtitle: subtitle || '',
          subtitle_ta: subtitle_ta || '',
          is_visible: 1,
          sort_order: 99,
          background_type: background_type || 'color',
          background_value: background_value || '#0C0F17'
        };
        memoryStore.sections.push(item);
        saveJsonStore();
        const sections = getAllSections();
        broadcastUpdate('sections_updated', sections);
        return sendJson(res, 201, { success: true, message: 'New section created live!', id: item.id });
      }
    }

    if (pathname.startsWith('/api/admin/sections/') && method === 'DELETE') {
      const sectionId = parseInt(pathname.replace('/api/admin/sections/', ''), 10);
      if (db) {
        db.prepare('DELETE FROM sections WHERE id = ?').run(sectionId);
      } else if (memoryStore) {
        memoryStore.sections = memoryStore.sections.filter(s => s.id !== sectionId);
        saveJsonStore();
      }
      const sections = getAllSections();
      broadcastUpdate('sections_updated', sections);
      return sendJson(res, 200, { success: true, message: 'Section removed live!' });
    }

    // J. Super Admin Theme & Visual Customizer
    if (pathname === '/api/admin/theme' && method === 'GET') {
      let publishedTheme = null;
      let draftTheme = null;

      if (db) {
        publishedTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 0 ORDER BY id DESC LIMIT 1').get() || DEFAULT_THEME;
        draftTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 1 ORDER BY id DESC LIMIT 1').get() || publishedTheme;
      } else if (memoryStore) {
        publishedTheme = memoryStore.theme || DEFAULT_THEME;
        draftTheme = memoryStore.draft_theme || publishedTheme;
      }

      return sendJson(res, 200, {
        success: true,
        data: {
          published: publishedTheme,
          draft: draftTheme,
          has_draft: JSON.stringify(publishedTheme) !== JSON.stringify(draftTheme)
        }
      });
    }

    if (pathname === '/api/admin/theme/draft' && method === 'PUT') {
      const body = await parseBody(req);
      const fields = [
        'primary_color', 'secondary_color', 'accent_color', 'bg_dark', 'bg_card',
        'text_main', 'text_muted', 'font_family', 'font_size_base', 'border_radius',
        'button_radius', 'hero_overlay_opacity', 'hero_overlay_blur', 'animation_speed',
        'theme_mode', 'custom_css'
      ];

      if (db) {
        const checkDraft = db.prepare('SELECT id FROM theme_settings WHERE is_draft = 1').get();
        if (checkDraft) {
          const sets = fields.map(f => `${f} = ?`).join(', ');
          const values = fields.map(f => body[f] !== undefined ? body[f] : DEFAULT_THEME[f]);
          values.push(checkDraft.id);
          db.prepare(`UPDATE theme_settings SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
        } else {
          const cols = fields.join(', ');
          const placeholders = fields.map(() => '?').join(', ');
          const values = fields.map(f => body[f] !== undefined ? body[f] : DEFAULT_THEME[f]);
          db.prepare(`INSERT INTO theme_settings (name, is_draft, ${cols}) VALUES ('draft', 1, ${placeholders})`).run(...values);
        }
      } else if (memoryStore) {
        memoryStore.draft_theme = Object.assign({}, memoryStore.draft_theme || DEFAULT_THEME, body, { is_draft: 1 });
        saveJsonStore();
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'ADMIN_THEME_DRAFT', 'Saved theme draft customization', ip);
      return sendJson(res, 200, { success: true, message: 'Draft theme saved! Live Preview is active.' });
    }

    if (pathname === '/api/admin/theme/publish' && method === 'POST') {
      let draft = null;
      let publishedTheme = null;
      if (db) {
        draft = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 1').get();
        if (draft) {
          const fields = [
            'primary_color', 'secondary_color', 'accent_color', 'bg_dark', 'bg_card',
            'text_main', 'text_muted', 'font_family', 'font_size_base', 'border_radius',
            'button_radius', 'hero_overlay_opacity', 'hero_overlay_blur', 'animation_speed',
            'theme_mode', 'custom_css'
          ];
          const sets = fields.map(f => `${f} = ?`).join(', ');
          const values = fields.map(f => draft[f]);

          const checkPub = db.prepare('SELECT id FROM theme_settings WHERE is_draft = 0').get();
          if (checkPub) {
            values.push(checkPub.id);
            db.prepare(`UPDATE theme_settings SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
          } else {
            const cols = fields.join(', ');
            const placeholders = fields.map(() => '?').join(', ');
            db.prepare(`INSERT INTO theme_settings (name, is_draft, ${cols}) VALUES ('published', 0, ${placeholders})`).run(...values);
          }
        }
        publishedTheme = db.prepare('SELECT * FROM theme_settings WHERE is_draft = 0 ORDER BY id DESC LIMIT 1').get();
      } else if (memoryStore) {
        if (memoryStore.draft_theme) {
          memoryStore.theme = Object.assign({}, memoryStore.draft_theme, { is_draft: 0 });
          saveJsonStore();
          publishedTheme = memoryStore.theme;
        }
      }

      logActivity(currentUser.id, currentUser.username, currentUser.role, 'ADMIN_THEME_PUBLISH', 'Published new theme live to website', ip);
      broadcastUpdate('theme_updated', publishedTheme || draft || DEFAULT_THEME);
      return sendJson(res, 200, {
        success: true,
        message: 'Theme published live! All visitors see updated colors and styling.',
        data: { preset_name: draft?.name || 'Custom Theme', ...(publishedTheme || draft || DEFAULT_THEME) }
      });
    }

    if (pathname === '/api/admin/theme/reset' && method === 'POST') {
      if (db) {
        db.prepare('DELETE FROM theme_settings').run();
        seedDatabaseSQLite();
      } else if (memoryStore) {
        memoryStore.theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
        memoryStore.draft_theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
        saveJsonStore();
      }
      broadcastUpdate('theme_updated', DEFAULT_THEME);
      return sendJson(res, 200, { success: true, message: 'Theme reset to default studio styling' });
    }
  }

  // 404 For Unmatched API Routes
  return sendJson(res, 404, { success: false, message: `API route not found: ${method} ${pathname}` });
}

// ----------------------------------------------------------------------------
// HTTP SERVER CREATION & DISPATCHER
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
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    filePath = path.join(__dirname, safePath);
  }

  serveStatic(req, res, filePath);
});

// Initialize Database & Start Server
initDatabase();

server.listen(PORT, HOST, () => {
  console.log(`========================================================================`);
  console.log(`🚀 Sasi Portfolio Multi-Tier Application Server Running!`);
  console.log(`🌐 Public Website:     http://localhost:${PORT}/`);
  console.log(`🛡️ Super Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`👑 Owner Dashboard:    http://localhost:${PORT}/owner.html`);
  console.log(`========================================================================`);
  console.log(`Default Credentials:`);
  console.log(`  Owner:       owner@sasiportfolio.com  /  OwnerSecure2026!`);
  console.log(`  Super Admin: admin@sasiportfolio.com  /  AdminSecure2026!`);
  console.log(`  Editor:      editor@sasiportfolio.com /  EditorSecure2026!`);
  console.log(`  User:        user@example.com         /  UserSecure2026!`);
  console.log(`========================================================================`);
});
