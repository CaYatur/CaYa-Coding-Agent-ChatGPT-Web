#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.join(root, 'openapi', 'action.yaml');
const output = path.join(root, 'openapi', 'action.generated.yaml');

const rawUrl = process.argv[2];
if (!rawUrl) {
  console.error('Usage: node tools/prepare-action-schema.mjs https://agent.example.com[/optional-base-path]');
  process.exit(2);
}

let publicUrl;
try {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') throw new Error('URL must use https://');
  if (parsed.username || parsed.password) throw new Error('Do not place credentials in the URL.');
  publicUrl = parsed.toString().replace(/\/$/, '');
} catch (error) {
  console.error(`Invalid public Bridge URL: ${error.message}`);
  process.exit(2);
}

const sourceText = fs.readFileSync(source, 'utf8');
const placeholder = 'https://bridge.example.com';
if (!sourceText.includes(placeholder)) {
  console.error(`Could not find ${placeholder} in ${source}`);
  process.exit(1);
}

const generated = sourceText.replace(placeholder, publicUrl);
fs.writeFileSync(output, generated, 'utf8');
console.log(`Generated: ${output}`);
console.log(`Server URL: ${publicUrl}`);
