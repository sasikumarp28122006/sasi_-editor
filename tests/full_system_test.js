/**
 * ============================================================================
 * SASI PORTFOLIO — FULL SYSTEM AUTOMATED TEST SUITE
 * Validates Database, Security, RLS, Auth, RBAC, API, Storage & Uploads
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const BASE_URL = 'http://127.0.0.1:3000';
let serverProcess = null;

const testResults = [];
function recordTest(name, passed, details = '') {
  testResults.push({ name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${name} ${details ? `(${details})` : ''}`);
}

function request(method, route, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(route, BASE_URL);
    const reqHeaders = Object.assign({}, headers);
    let payload = null;

    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
      reqHeaders['Content-Length'] = body.length;
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: DATABASE FILES & MIGRATIONS INTEGRITY
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: DATABASE & MIGRATIONS ---');
  try {
    assert.ok(fs.existsSync('database.sqlite'), 'database.sqlite must exist');
    const db = new DatabaseSync('database.sqlite');
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const contentCount = db.prepare('SELECT COUNT(*) as c FROM content').get().c;
    assert.ok(userCount >= 3, `Expected at least 3 users, found ${userCount}`);
    assert.ok(contentCount >= 5, `Expected at least 5 projects, found ${contentCount}`);
    recordTest('SQLite Database Integrity & Records', true, `users: ${userCount}, content: ${contentCount}`);
  } catch (err) {
    recordTest('SQLite Database Integrity & Records', false, err.message);
  }

  try {
    assert.ok(fs.existsSync('migrations/001_initial_schema.sql'), '001_initial_schema.sql missing');
    assert.ok(fs.existsSync('migrations/002_security_rls.sql'), '002_security_rls.sql missing');
    assert.ok(fs.existsSync('migrations/003_seed_and_migrate_data.sql'), '003_seed_and_migrate_data.sql missing');
    assert.ok(fs.existsSync('supabase_schema.sql'), 'supabase_schema.sql missing');

    const masterSql = fs.readFileSync('supabase_schema.sql', 'utf-8');
    assert.ok(masterSql.includes('CREATE TABLE IF NOT EXISTS public.portfolio_projects'), 'Master SQL missing portfolio_projects');
    assert.ok(masterSql.includes('CREATE POLICY "contact_public_insert"'), 'Master SQL missing strict contact insert RLS');
    assert.ok(masterSql.includes('CREATE POLICY "contact_admin_read"'), 'Master SQL missing contact admin read restriction');
    assert.ok(masterSql.includes('protect_last_owner'), 'Master SQL missing protect_last_owner trigger');
    recordTest('Supabase PostgreSQL Master Schema & RLS Migrations', true, `Size: ${masterSql.length} bytes`);
  } catch (err) {
    recordTest('Supabase PostgreSQL Master Schema & RLS Migrations', false, err.message);
  }

  // --------------------------------------------------------------------------
  // START TEST SERVER INSTANCE
  // --------------------------------------------------------------------------
  console.log('\n--- STARTING APPLICATION SERVER FOR API TESTING ---');
  const nodeExe = process.execPath;
  serverProcess = spawn(nodeExe, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: 3000, HOST: '127.0.0.1' }),
    stdio: 'ignore'
  });

  // Wait 1.5 seconds for server to bind
  await new Promise(r => setTimeout(r, 1500));

  // --------------------------------------------------------------------------
  // TEST GROUP 2: PUBLIC APIS & DATA RETRIEVAL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: PUBLIC APIS ---');
  try {
    const res = await request('GET', '/api/public/settings');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.site_name, 'Site name must be present');
    recordTest('GET /api/public/settings (Public Settings)', true, `site: ${res.body.data.site_name}`);
  } catch (err) {
    recordTest('GET /api/public/settings (Public Settings)', false, err.message);
  }

  try {
    const res = await request('GET', '/api/public/content');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data) && res.body.data.length > 0);
    recordTest('GET /api/public/content (Published Portfolio Projects)', true, `Count: ${res.body.data.length}`);
  } catch (err) {
    recordTest('GET /api/public/content (Published Portfolio Projects)', false, err.message);
  }

  try {
    const res = await request('GET', '/api/public/theme');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.primary_color, 'Theme primary color missing');
    recordTest('GET /api/public/theme (Published Theme)', true, `Primary: ${res.body.data.primary_color}`);
  } catch (err) {
    recordTest('GET /api/public/theme (Published Theme)', false, err.message);
  }

  try {
    const res = await request('GET', '/api/public/sections');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data) && res.body.data.length > 0);
    recordTest('GET /api/public/sections (Visible Sections)', true, `Count: ${res.body.data.length}`);
  } catch (err) {
    recordTest('GET /api/public/sections (Visible Sections)', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: SECURITY, AUTHENTICATION & DEMO TOKEN BLOCKING
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: AUTHENTICATION & ACCESS CONTROL ---');
  try {
    // Unauthenticated access to /api/owner/admins must be rejected with 401 or 403
    const res = await request('GET', '/api/owner/admins');
    assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
    recordTest('Rejection of Unauthenticated Owner API Access', true, `Status ${res.status}`);
  } catch (err) {
    recordTest('Rejection of Unauthenticated Owner API Access', false, err.message);
  }

  try {
    // Backdoor token demo_token_owner must be REJECTED with 401 or 403
    const res = await request('GET', '/api/owner/admins', null, {
      'Authorization': 'Bearer demo_token_owner'
    });
    assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
    recordTest('Rejection of Hardcoded Backdoor demo_token_owner', true, `Access Denied with HTTP ${res.status}`);
  } catch (err) {
    recordTest('Rejection of Hardcoded Backdoor demo_token_owner', false, err.message);
  }

  try {
    // Header spoofing X-Role: owner without credentials must be REJECTED with 401 or 403
    const res = await request('GET', '/api/owner/admins', null, {
      'X-Role': 'owner'
    });
    assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
    recordTest('Rejection of Spoofed X-Role Header', true, `Access Denied with HTTP ${res.status}`);
  } catch (err) {
    recordTest('Rejection of Spoofed X-Role Header', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: SECURE LOGIN & SESSION PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: CREDENTIAL LOGIN & SESSIONS ---');
  let ownerToken = null;
  try {
    // Attempt login with invalid credentials
    const badRes = await request('POST', '/api/auth/login', {
      login: 'owner@sasiportfolio.com',
      password: 'WrongPassword123!'
    });
    assert.strictEqual(badRes.status, 401);
    recordTest('Rejection of Invalid Login Credentials', true, 'HTTP 401 returned');

    // Attempt login with legitimate credentials
    const goodRes = await request('POST', '/api/auth/login', {
      login: 'owner@sasiportfolio.com',
      password: 'OwnerSecure2026!'
    });
    assert.strictEqual(goodRes.status, 200);
    assert.ok(goodRes.body.token, 'Token must be issued');
    assert.strictEqual(goodRes.body.user.role, 'owner');
    ownerToken = goodRes.body.token;
    recordTest('Legitimate Owner Authentication & Session Token Issuance', true, `Token: ${ownerToken.substring(0, 10)}...`);
  } catch (err) {
    recordTest('Legitimate Owner Authentication & Session Token Issuance', false, err.message);
  }

  try {
    // Verify session with the issued token
    assert.ok(ownerToken, 'Valid token required for test');
    const meRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.role, 'owner');
    recordTest('Verification of Session Profile via /api/auth/me', true, `User: ${meRes.body.user.username}`);
  } catch (err) {
    recordTest('Verification of Session Profile via /api/auth/me', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: OWNER SAFEGUARD (PREVENT DEMOTION/DELETION)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: OWNER SAFEGUARD TESTS ---');
  try {
    assert.ok(ownerToken, 'Valid token required for test');
    // Attempt to delete owner account ID 1
    const delRes = await request('DELETE', '/api/owner/admins/1', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    assert.strictEqual(delRes.status, 403);
    assert.ok(delRes.body.message.includes('Owner'), 'Must block owner deletion');
    recordTest('Security Protection: Cannot Delete Website Owner Account', true, `Blocked: ${delRes.body.message}`);
  } catch (err) {
    recordTest('Security Protection: Cannot Delete Website Owner Account', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: CONTACT FORM VALIDATION & PRIVACY
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: CONTACT FORM & PRIVACY ---');
  try {
    // Valid submission
    const res = await request('POST', '/api/public/contact', {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      subject: 'Commercial Video Inquiry',
      message: 'Hello Sasi, looking to collaborate on a cinematic brand video.'
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    recordTest('Public Contact Form Submission (Valid Data)', true, `HTTP ${res.status} OK`);
  } catch (err) {
    recordTest('Public Contact Form Submission (Valid Data)', false, err.message);
  }

  try {
    // Invalid submission (empty message or invalid email)
    const badRes = await request('POST', '/api/public/contact', {
      name: 'A',
      email: 'invalid-email',
      message: 'Hi'
    });
    assert.strictEqual(badRes.status, 400);
    recordTest('Rejection of Malformed Contact Form Data', true, 'HTTP 400 Validation Error');
  } catch (err) {
    recordTest('Rejection of Malformed Contact Form Data', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: FILE UPLOAD SECURITY & MAGIC BYTES
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: FILE UPLOAD SECURITY ---');
  try {
    // Unauthenticated upload must be rejected
    const unauthUpload = await request('POST', '/api/upload', Buffer.from('dummy'), {
      'Content-Type': 'multipart/form-data; boundary=---boundary'
    });
    assert.strictEqual(unauthUpload.status, 403);
    recordTest('Rejection of Unauthenticated File Upload', true, 'HTTP 403 Forbidden');
  } catch (err) {
    recordTest('Rejection of Unauthenticated File Upload', false, err.message);
  }

  try {
    // Upload with mismatched magic bytes (text disguised as .jpg)
    const boundary = '----WebKitFormBoundaryTest1234';
    const fakeJpg = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="malicious.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      Buffer.from('THIS IS PLAIN TEXT NOT A JPEG'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const fakeRes = await request('POST', '/api/upload', fakeJpg, {
      'Authorization': `Bearer ${ownerToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    });
    assert.ok(fakeRes.status === 400 || fakeRes.status === 500, `Expected 400 or 500, got ${fakeRes.status}`);
    assert.ok(fakeRes.body.message.includes('signature') || fakeRes.body.message.includes('format'));
    recordTest('Magic Byte Verification: Rejection of Spoofed Binary Files', true, `Blocked: ${fakeRes.body.message}`);
  } catch (err) {
    recordTest('Magic Byte Verification: Rejection of Spoofed Binary Files', false, err.message);
  }

  try {
    // Upload with valid PNG magic bytes: 0x89 0x50 0x4E 0x47
    const boundary = '----WebKitFormBoundaryTestPNG';
    const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const validPng = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_valid.png"\r\nContent-Type: image/png\r\n\r\n`),
      pngBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const validRes = await request('POST', '/api/upload', validPng, {
      'Authorization': `Bearer ${ownerToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    });
    assert.ok(validRes.status === 200 || validRes.status === 201, `Expected 200 or 201, got ${validRes.status}`);
    assert.strictEqual(validRes.body.success, true);
    recordTest('Valid Image Upload with Binary Signature Verification', true, `Saved: ${validRes.body.files[0].savedName}`);
  } catch (err) {
    recordTest('Valid Image Upload with Binary Signature Verification', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 AUTOMATED TEST SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;

  console.log(`Total Assertions Checked: ${total}`);
  console.log(`Assertions Passed:        ${passed}`);
  console.log(`Assertions Failed:        ${failed}`);
  console.log(`Success Rate:             ${Math.round((passed / total) * 100)}%`);
  console.log('================================================================\n');

  if (serverProcess) {
    serverProcess.kill();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[UNCAUGHT EXCEPTION IN TEST RUNNER]', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
