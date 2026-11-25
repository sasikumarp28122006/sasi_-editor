const fs = require('fs');
const path = require('path');

const f1 = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_initial_schema.sql'), 'utf-8');
const f2 = fs.readFileSync(path.join(__dirname, '..', 'migrations', '002_security_rls.sql'), 'utf-8');
const f3 = fs.readFileSync(path.join(__dirname, '..', 'migrations', '003_seed_and_migrate_data.sql'), 'utf-8');

const combined = `-- ============================================================================
-- SASI PORTFOLIO — MASTER PRODUCTION SUPABASE POSTGRESQL SCHEMA & MIGRATION
-- Generated: ${new Date().toISOString()}
-- Contains: Complete Normalized Schema, Strict RLS Security, and Migrated SQLite Data
-- Instructions: Run in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

${f1}

${f2}

${f3}
`;

fs.writeFileSync(path.join(__dirname, '..', 'supabase_schema.sql'), combined, 'utf-8');
console.log('Combined master supabase_schema.sql generated successfully. Size:', combined.length, 'bytes');
