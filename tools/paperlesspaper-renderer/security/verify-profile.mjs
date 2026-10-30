import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const profile = JSON.parse(fs.readFileSync(new URL('./seccomp.chromium.json', import.meta.url)));
const provenance = JSON.parse(fs.readFileSync(new URL('./provenance.json', import.meta.url)));
assert.equal(profile.defaultAction, 'SCMP_ACT_ERRNO');
const probes = profile.syscalls.filter(rule => rule.comment?.startsWith('paperlesspaper:'));
assert.equal(probes.length, 7);
assert.deepEqual(probes.map(rule => rule.args[0].value).sort((a,b)=>a-b), [0x10000000,0x20000000,0x30000000,0x40000000,0x50000000,0x60000000,0x70000000]);
for (const rule of probes) {
  assert.deepEqual(rule.names, ['unshare']);
  assert.equal(rule.action, 'SCMP_ACT_ALLOW');
  assert.equal(rule.args.length, 1);
  assert.equal(rule.args[0].index, 0);
  assert.equal(rule.args[0].op, 'SCMP_CMP_EQ');
}
const cloneRules = profile.syscalls.filter(rule => rule.names.length === 1 && rule.names[0] === 'clone' && rule.args);
assert.equal(cloneRules.length, 2);
for (const rule of cloneRules) {
  const mask = rule.args[0].value;
  assert.equal(mask, 0x0e020000);
  assert.equal(rule.args[0].op, 'SCMP_CMP_MASKED_EQ');
  for (const flag of [0x10000000,0x20000000,0x40000000]) assert.equal(flag & mask, 0);
  for (const flag of [0x00020000,0x02000000,0x04000000,0x08000000]) assert.notEqual(flag & mask, 0);
  // Restore the original rule and compare the entire remaining policy to upstream.
  rule.args[0].value = 0x7e020000;
}
profile.syscalls = profile.syscalls.filter(rule => !rule.comment?.startsWith('paperlesspaper:'));
assert.equal(createHash('sha256').update(JSON.stringify(profile)).digest('hex'), provenance.canonicalSha256);
console.log('Verified: only the documented user/PID/network namespace rules differ from pinned Docker policy.');
