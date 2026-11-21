import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import handler from '../api/content.js';

const originalDirectory = process.cwd();
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'aizgz-content-api-'));

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }
  };
}

async function request(method = 'GET', collection = '') {
  const req = { method, query: collection ? { collection } : {}, headers: {} };
  const res = createResponse();
  await handler(req, res);
  return res;
}

try {
  process.chdir(temporaryDirectory);

  for (const collection of ['products', 'cases']) {
    await mkdir(path.join('content', collection), { recursive: true });
    await writeFile(path.join('content', collection, 'zeta.md'), '# Zeta\n');
    await writeFile(path.join('content', collection, 'Alpha.MD'), '# Alpha\n');
    await writeFile(path.join('content', collection, 'notes.txt'), 'not markdown');
  }

  await mkdir(path.join('content', 'settings'), { recursive: true });
  await writeFile(path.join('content', 'settings', 'general.json'),
    JSON.stringify({ brand_name: 'AIZGZ', contact_email: 'aimr@qq.com' }));

  const products = await request('GET', 'products');
  assert.equal(products.statusCode, 200);
  assert.deepEqual(products.body.files.map((file) => file.name), ['Alpha.MD', 'zeta.md']);
  assert.equal(products.body.files[0].content, '# Alpha\n');
  assert.equal(products.headers['cache-control'], 'public, max-age=60, stale-while-revalidate=300');
  assert.equal(products.headers['x-content-type-options'], 'nosniff');

  const cases = await request('GET', 'cases');
  assert.equal(cases.statusCode, 200);
  assert.equal(cases.body.files.length, 2);

  const missingDirectory = await request('GET', 'videos');
  assert.equal(missingDirectory.statusCode, 200);
  assert.deepEqual(missingDirectory.body, { files: [] });

  const settings = await request('GET', 'settings');
  assert.equal(settings.statusCode, 200);
  assert.deepEqual(settings.body.settings, { brand_name: 'AIZGZ', contact_email: 'aimr@qq.com' });

  const unsupported = await request('GET', '../settings');
  assert.equal(unsupported.statusCode, 400);
  assert.deepEqual(unsupported.body, { error: 'Unsupported content collection' });

  const wrongMethod = await request('POST', 'products');
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.allow, 'GET');
  assert.deepEqual(wrongMethod.body, { error: 'Method not allowed' });

  await writeFile(path.join('content', 'settings', 'general.json'), '{ invalid json');
  const invalidSettings = await request('GET', 'settings');
  assert.equal(invalidSettings.statusCode, 500);
  assert.deepEqual(invalidSettings.body, { error: 'Site settings are unavailable' });
  assert.equal(JSON.stringify(invalidSettings.body).includes(temporaryDirectory), false);

  console.log('Content API regression checks passed: allowed collections, sorting/filtering, settings, missing directories, unsupported collections, methods, headers, and error handling. No network requests were made.');
} finally {
  process.chdir(originalDirectory);
  await rm(temporaryDirectory, { recursive: true, force: true });
}
