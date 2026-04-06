#!/usr/bin/env node

// Simple safety check to ensure Prisma Client artifacts exist before Next build.
// Does NOT touch the database – only checks for generated files.

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const candidates = [
  // Generated Prisma client (Prisma 7, TS output)
  path.join(projectRoot, 'src', 'generated', 'prisma', 'client.ts'),
];

const exists = candidates.some((p) => fs.existsSync(p));

if (!exists) {
  // Make it very explicit in CI / Vercel logs what went wrong.
  console.error('❌ Prisma Client artifacts not found after `prisma generate`.');
  console.error('   Expected one of:');
  for (const c of candidates) {
    console.error(`   - ${c}`);
  }
  console.error('');
  console.error('   Make sure `prisma generate` runs successfully before `next build`.');
  process.exit(1);
}

console.log('✅ Prisma Client artifacts detected.');

