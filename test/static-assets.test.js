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
