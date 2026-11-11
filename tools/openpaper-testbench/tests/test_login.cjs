const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../api/static/login.js'), 'utf8');
const origin = 'https://testbench.example';

async function submitLogin(next) {
  const form = { hidden: true };
  const nodes = {
    '#login-form': form,
    '#error': { textContent: '' },
    '#password': { value: 'test-password' },
    '#remember': { checked: false },
  };
  let destination;
  vm.runInNewContext(script, {
    URL,
    URLSearchParams,
    location: {
      origin,
      hostname: 'testbench.example',
      protocol: 'https:',
      search: next === undefined ? '' : '?' + new URLSearchParams({ next }),
      replace: value => { destination = new URL(value, origin).href; },
    },
    document: { querySelector: selector => nodes[selector] },
    fetch: async () => ({ ok: true }),
  });
  await form.onsubmit({
    preventDefault() {},
    currentTarget: { querySelector: () => ({ disabled: false }) },
  });
  return destination;
}

test('login preserves local destinations, queries and fragments', async () => {
  assert.equal(await submitLogin(), origin + '/');
  assert.equal(await submitLogin('/cameras/frame-2?view=display#photo'), origin + '/cameras/frame-2?view=display#photo');
  assert.equal(await submitLogin(origin + '/settings'), origin + '/settings');
});

for (const next of [
  'https://attacker.example/phishing',
  '//attacker.example/phishing',
  '/\\attacker.example/phishing',
  'javascript:alert(1)',
  'data:text/html,untrusted',
]) {
  test(`login rejects an external destination: ${next}`, async () => {
    assert.equal(await submitLogin(next), origin + '/');
  });
}

test('login does not reinterpret a same-origin double-slash path as another host', async () => {
  const next = origin + '//attacker.example/phishing?source=login#continue';
  assert.equal(await submitLogin(next), next);
});
