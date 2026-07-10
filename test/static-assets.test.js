const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('index uses relative asset paths so styles load outside server root', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');

  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(html, /<script src="app\.js"><\/script>/);
});

test('browser app has localhost API fallback for file protocol', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');

  assert.match(js, /location\.protocol === 'file:'/);
  assert.match(js, /http:\/\/127\.0\.0\.1:3000/);
});

test('request form layout leaves enough room for employee selects', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public', 'styles.css'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');

  assert.match(css, /grid-template-columns:\s*minmax\(400px,\s*420px\)\s*1fr/);
  assert.match(js, /option\.textContent = employee\.fullName/);
  assert.match(js, /option\.title = `\$\{employee\.fullName\} - \$\{employee\.departmentName\}`/);
});

test('request table keeps compact columns from wrapping awkwardly', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'public', 'styles.css'), 'utf8');

  assert.match(html, /<th class="col-number">Номер<\/th>/);
  assert.match(css, /\.col-number,[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.status\s*{[\s\S]*?min-width:\s*76px/);
  assert.match(css, /\.row-actions\s*{[\s\S]*?width:\s*210px/);
});

test('vercel deployment has serverless API entrypoint and Node 22 runtime', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const apiEntry = fs.readFileSync(path.join(process.cwd(), 'api', '[...path].js'), 'utf8');
  const serverEntry = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
  const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));

  assert.equal(packageJson.engines.node, '22.x');
  assert.doesNotMatch(apiEntry, /node:sqlite/);
  assert.match(apiEntry, /createDemoState/);
  assert.match(apiEntry, /serveStatic/);
  assert.match(serverEntry, /process\.env\.VERCEL/);
  assert.match(serverEntry, /require\('\.\/api\/\[\.\.\.path\]\.js'\)/);
  assert.deepEqual(vercelJson.builds.map((build) => build.use), ['@vercel/node', '@vercel/static']);
  assert.deepEqual(vercelJson.routes[0], { src: '/api/(.*)', dest: '/api/[...path].js' });
  assert.deepEqual(vercelJson.routes.at(-1), { src: '/', dest: '/public/index.html' });
});
