/**
 * ============================================================================
 * SQLITE TO SUPABASE POSTGRESQL DATA EXPORT & MIGRATION GENERATOR
 * Safely preserves and migrates all existing records from database.sqlite
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', 'database.sqlite');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(MIGRATIONS_DIR)) fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });

if (!fs.existsSync(DB_FILE)) {
  console.error('[ERROR] database.sqlite does not exist at:', DB_FILE);
  process.exit(1);
}

const db = new DatabaseSync(DB_FILE);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

console.log('--- Inspecting SQLite Database ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
const backupData = {};
const counts = {};

for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM ${t.name}`).all();
  backupData[t.name] = rows;
  counts[t.name] = rows.length;
  console.log(`Table ${t.name}: ${rows.length} rows`);
}

// 1. Save Full JSON Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUPS_DIR, `sqlite_backup_${timestamp}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
console.log(`[BACKUP] Full SQLite JSON snapshot saved to: ${backupPath}`);

// 2. Generate Migrations File 003_seed_and_migrate_data.sql
let sql = `-- ============================================================================
-- 003_seed_and_migrate_data.sql
-- Idempotent PostgreSQL Data Migration from Sasi Portfolio database.sqlite
-- Preserves all existing users, projects, media, settings, sections & themes
-- Generated: ${new Date().toISOString()}
-- ============================================================================

-- 1. Migrate User Profiles
`;

if (backupData.users && backupData.users.length > 0) {
  sql += `INSERT INTO public.user_profiles (id, username, email, role, permissions, avatar_url, status, created_at, last_login)\nVALUES\n`;
  const userRows = backupData.users.map(u => {
    let perms = u.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.stringify(JSON.parse(perms)); } catch(e) { perms = '{}'; }
    } else {
      perms = JSON.stringify(perms || {});
    }
    return `  (${u.id}, ${escapeSql(u.username)}, ${escapeSql(u.email)}, ${escapeSql(u.role)}, ${escapeSql(perms)}::jsonb, ${escapeSql(u.avatar || 'sasi_profile.jpg')}, ${escapeSql(u.status || 'active')}, ${escapeSql(u.created_at || new Date().toISOString())}::timestamptz, ${u.last_login ? `${escapeSql(u.last_login)}::timestamptz` : 'NULL'})`;
  });
  sql += userRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  username = EXCLUDED.username,\n  email = EXCLUDED.email,\n  role = EXCLUDED.role,\n  permissions = EXCLUDED.permissions,\n  avatar_url = EXCLUDED.avatar_url,\n  status = EXCLUDED.status,\n  last_login = EXCLUDED.last_login;\n\n`;
}

// 2. Migrate Portfolio Settings
if (backupData.settings && backupData.settings.length > 0) {
  sql += `-- 2. Migrate Portfolio Settings\nINSERT INTO public.portfolio_settings (key, value, category, is_public, updated_at)\nVALUES\n`;
  const settingRows = backupData.settings.map(s => {
    return `  (${escapeSql(s.key)}, ${escapeSql(s.value)}, ${escapeSql(s.category || 'general')}, ${s.is_public ? 'TRUE' : 'FALSE'}, ${escapeSql(s.updated_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += settingRows.join(',\n') + `\nON CONFLICT (key) DO UPDATE SET\n  value = EXCLUDED.value,\n  category = EXCLUDED.category,\n  is_public = EXCLUDED.is_public,\n  updated_at = EXCLUDED.updated_at;\n\n`;
}

// 3. Migrate Themes
if (backupData.theme_settings && backupData.theme_settings.length > 0) {
  sql += `-- 3. Migrate Themes\nINSERT INTO public.themes (id, name, is_draft, primary_color, secondary_color, accent_color, bg_dark, bg_card, text_main, text_muted, font_family, font_size_base, border_radius, button_radius, hero_overlay_opacity, hero_overlay_blur, animation_speed, theme_mode, custom_css, updated_at)\nVALUES\n`;
  const themeRows = backupData.theme_settings.map(t => {
    return `  (${t.id}, ${escapeSql(t.name)}, ${t.is_draft ? 'TRUE' : 'FALSE'}, ${escapeSql(t.primary_color)}, ${escapeSql(t.secondary_color)}, ${escapeSql(t.accent_color)}, ${escapeSql(t.bg_dark)}, ${escapeSql(t.bg_card)}, ${escapeSql(t.text_main)}, ${escapeSql(t.text_muted)}, ${escapeSql(t.font_family)}, ${escapeSql(t.font_size_base)}, ${escapeSql(t.border_radius)}, ${escapeSql(t.button_radius)}, ${t.hero_overlay_opacity || 0.72}, ${t.hero_overlay_blur || 2}, ${escapeSql(t.animation_speed || 'normal')}, ${escapeSql(t.theme_mode || 'dark')}, ${escapeSql(t.custom_css || '')}, ${escapeSql(t.updated_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += themeRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  is_draft = EXCLUDED.is_draft,\n  primary_color = EXCLUDED.primary_color,\n  secondary_color = EXCLUDED.secondary_color,\n  accent_color = EXCLUDED.accent_color,\n  bg_dark = EXCLUDED.bg_dark,\n  bg_card = EXCLUDED.bg_card,\n  text_main = EXCLUDED.text_main,\n  text_muted = EXCLUDED.text_muted,\n  font_family = EXCLUDED.font_family,\n  border_radius = EXCLUDED.border_radius,\n  updated_at = EXCLUDED.updated_at;\n\n`;
}

// 4. Migrate Sections
if (backupData.sections && backupData.sections.length > 0) {
  sql += `-- 4. Migrate Sections\nINSERT INTO public.sections (id, section_id, title, title_ta, subtitle, subtitle_ta, content_json, is_visible, sort_order, background_type, background_value, custom_css, updated_at)\nVALUES\n`;
  const sectionRows = backupData.sections.map(s => {
    let cJson = s.content_json;
    if (typeof cJson === 'string') {
      try { cJson = JSON.stringify(JSON.parse(cJson)); } catch(e) { cJson = '{}'; }
    } else {
      cJson = JSON.stringify(cJson || {});
    }
    return `  (${s.id}, ${escapeSql(s.section_id)}, ${escapeSql(s.title)}, ${escapeSql(s.title_ta || '')}, ${escapeSql(s.subtitle || '')}, ${escapeSql(s.subtitle_ta || '')}, ${escapeSql(cJson)}::jsonb, ${s.is_visible ? 'TRUE' : 'FALSE'}, ${s.sort_order || 0}, ${escapeSql(s.background_type || 'color')}, ${escapeSql(s.background_value || '#07090E')}, ${escapeSql(s.custom_css || '')}, ${escapeSql(s.updated_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += sectionRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  section_id = EXCLUDED.section_id,\n  title = EXCLUDED.title,\n  title_ta = EXCLUDED.title_ta,\n  subtitle = EXCLUDED.subtitle,\n  subtitle_ta = EXCLUDED.subtitle_ta,\n  content_json = EXCLUDED.content_json,\n  is_visible = EXCLUDED.is_visible,\n  sort_order = EXCLUDED.sort_order,\n  background_type = EXCLUDED.background_type,\n  background_value = EXCLUDED.background_value,\n  custom_css = EXCLUDED.custom_css,\n  updated_at = EXCLUDED.updated_at;\n\n`;
}

// 5. Migrate Projects / Content
if (backupData.content && backupData.content.length > 0) {
  sql += `-- 5. Migrate Portfolio Projects\nINSERT INTO public.portfolio_projects (id, title, title_ta, slug, excerpt, excerpt_ta, content, content_ta, category, tags, media_url, media_type, thumbnail_url, status, views, author_id, author_name, sort_order, created_at, updated_at)\nVALUES\n`;
  const contentRows = backupData.content.map(c => {
    return `  (${c.id}, ${escapeSql(c.title)}, ${escapeSql(c.title_ta || '')}, ${escapeSql(c.slug)}, ${escapeSql(c.excerpt || '')}, ${escapeSql(c.excerpt_ta || '')}, ${escapeSql(c.content || '')}, ${escapeSql(c.content_ta || '')}, ${escapeSql(c.category || 'General')}, ${escapeSql(c.tags || '')}, ${escapeSql(c.media_url || '')}, ${escapeSql(c.media_type || 'video')}, ${escapeSql(c.thumbnail_url || '')}, ${escapeSql(c.status || 'published')}, ${c.views || 0}, ${c.author_id ? c.author_id : 'NULL'}, ${escapeSql(c.author_name || 'Sasikumar')}, ${c.sort_order || 0}, ${escapeSql(c.created_at || new Date().toISOString())}::timestamptz, ${escapeSql(c.updated_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += contentRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  title = EXCLUDED.title,\n  title_ta = EXCLUDED.title_ta,\n  slug = EXCLUDED.slug,\n  excerpt = EXCLUDED.excerpt,\n  excerpt_ta = EXCLUDED.excerpt_ta,\n  content = EXCLUDED.content,\n  content_ta = EXCLUDED.content_ta,\n  category = EXCLUDED.category,\n  tags = EXCLUDED.tags,\n  media_url = EXCLUDED.media_url,\n  media_type = EXCLUDED.media_type,\n  thumbnail_url = EXCLUDED.thumbnail_url,\n  status = EXCLUDED.status,\n  views = EXCLUDED.views,\n  sort_order = EXCLUDED.sort_order,\n  updated_at = EXCLUDED.updated_at;\n\n`;
}

// 6. Migrate Media Library
if (backupData.media && backupData.media.length > 0) {
  sql += `-- 6. Migrate Media Assets\nINSERT INTO public.media_library (id, name, original_name, file_path, file_url, media_type, mime_type, file_size, category, tags, uploaded_by, created_at)\nVALUES\n`;
  const mediaRows = backupData.media.map(m => {
    return `  (${m.id}, ${escapeSql(m.name)}, ${escapeSql(m.original_name || m.name)}, ${escapeSql(m.file_path || m.file_url)}, ${escapeSql(m.file_url)}, ${escapeSql(m.media_type || 'image')}, ${escapeSql(m.mime_type || 'image/jpeg')}, ${m.file_size || 1048576}, ${escapeSql(m.category || 'General')}, ${escapeSql(m.tags || '')}, ${escapeSql(m.uploaded_by || 'owner')}, ${escapeSql(m.created_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += mediaRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  file_url = EXCLUDED.file_url,\n  media_type = EXCLUDED.media_type,\n  category = EXCLUDED.category;\n\n`;
}

// 7. Migrate Contact Messages
if (backupData.contact_messages && backupData.contact_messages.length > 0) {
  sql += `-- 7. Migrate Contact Inquiries\nINSERT INTO public.contact_inquiries (id, name, email, phone, subject, message, status, created_at)\nVALUES\n`;
  const contactRows = backupData.contact_messages.map(c => {
    return `  (${c.id}, ${escapeSql(c.name)}, ${escapeSql(c.email)}, ${escapeSql(c.phone || '')}, ${escapeSql(c.subject || '')}, ${escapeSql(c.message)}, ${escapeSql(c.status || 'unread')}, ${escapeSql(c.created_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += contactRows.join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  status = EXCLUDED.status;\n\n`;
}

// 8. Migrate Activity Logs
if (backupData.activity_logs && backupData.activity_logs.length > 0) {
  sql += `-- 8. Migrate Activity Logs\nINSERT INTO public.activity_logs (id, user_id, username, role, action, details, ip, created_at)\nVALUES\n`;
  const logRows = backupData.activity_logs.map(l => {
    return `  (${l.id}, ${l.user_id ? l.user_id : 'NULL'}, ${escapeSql(l.username || 'system')}, ${escapeSql(l.role || 'system')}, ${escapeSql(l.action || 'LOG')}, ${escapeSql(l.details || '')}, ${escapeSql(l.ip || '127.0.0.1')}, ${escapeSql(l.created_at || new Date().toISOString())}::timestamptz)`;
  });
  sql += logRows.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;
}

// Sync sequences for auto-incrementing tables
sql += `-- ============================================================================
-- RESET SEQUENCES TO CURRENT MAX IDS
-- ============================================================================
SELECT setval(pg_get_serial_sequence('public.user_profiles', 'id'), COALESCE(MAX(id), 1)) FROM public.user_profiles;
SELECT setval(pg_get_serial_sequence('public.themes', 'id'), COALESCE(MAX(id), 1)) FROM public.themes;
SELECT setval(pg_get_serial_sequence('public.sections', 'id'), COALESCE(MAX(id), 1)) FROM public.sections;
SELECT setval(pg_get_serial_sequence('public.portfolio_projects', 'id'), COALESCE(MAX(id), 1)) FROM public.portfolio_projects;
SELECT setval(pg_get_serial_sequence('public.media_library', 'id'), COALESCE(MAX(id), 1)) FROM public.media_library;
SELECT setval(pg_get_serial_sequence('public.contact_inquiries', 'id'), COALESCE(MAX(id), 1)) FROM public.contact_inquiries;
SELECT setval(pg_get_serial_sequence('public.activity_logs', 'id'), COALESCE(MAX(id), 1)) FROM public.activity_logs;
`;

const migrationPath = path.join(MIGRATIONS_DIR, '003_seed_and_migrate_data.sql');
fs.writeFileSync(migrationPath, sql, 'utf-8');
console.log(`[MIGRATION GENERATED] 003_seed_and_migrate_data.sql generated at: ${migrationPath}`);
console.log('Migration generated successfully!');
