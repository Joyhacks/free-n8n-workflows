// Structural checks on every generated workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../workflows/', import.meta.url);
const slugs = readdirSync(root).filter((d) => !d.startsWith('.'));
const STICKY = 'n8n-nodes-base.stickyNote';
// Every (type, version) below was confirmed in working community workflows.
const KNOWN = new Set([
  'n8n-nodes-base.webhook@2', 'n8n-nodes-base.set@3.4', 'n8n-nodes-base.code@2', 'n8n-nodes-base.if@2.2',
  'n8n-nodes-base.respondToWebhook@1.1', 'n8n-nodes-base.scheduleTrigger@1.2', 'n8n-nodes-base.httpRequest@4.2',
  'n8n-nodes-base.googleSheets@4.5', 'n8n-nodes-base.rssFeedRead@1.1', 'n8n-nodes-base.gmail@2.1',
  'n8n-nodes-base.slack@2.2', 'n8n-nodes-base.errorTrigger@1', '@n8n/n8n-nodes-langchain.chainLlm@1.5',
  '@n8n/n8n-nodes-langchain.lmChatOpenAi@1.2', `${STICKY}@1`,
]);
const SUB = new Set(['@n8n/n8n-nodes-langchain.lmChatOpenAi']);

test('there are five workflows', () => assert.equal(slugs.length, 5));

for (const slug of slugs) {
  const wf = JSON.parse(readFileSync(new URL(`${slug}/workflow.json`, root), 'utf8'));
  const by = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const real = wf.nodes.filter((n) => n.type !== STICKY);

  test(`${slug}: README exists`, () => assert.ok(readFileSync(new URL(`${slug}/README.md`, root), 'utf8').length > 200));

  test(`${slug}: known node types, unique names`, () => {
    assert.equal(Object.keys(by).length, wf.nodes.length);
    for (const n of wf.nodes) assert.ok(KNOWN.has(`${n.type}@${n.typeVersion}`), `${n.name}: ${n.type}@${n.typeVersion}`);
  });

  test(`${slug}: connections valid, everything reachable`, () => {
    for (const [s, kinds] of Object.entries(wf.connections)) {
      assert.ok(by[s], s);
      for (const [kind, outs] of Object.entries(kinds)) {
        if (kind !== 'main') assert.ok(SUB.has(by[s].type), `${s} emits ${kind}`);
        for (const o of outs) for (const c of o) assert.ok(by[c.node], `${s} -> ${c.node}`);
      }
    }
    const start = real.find((n) => /Trigger$|webhook$/.test(n.type));
    const seen = new Set([start.name]);
    const q = [start.name];
    while (q.length) for (const outs of Object.values(wf.connections[q.shift()] || {})) for (const o of outs) for (const c of o) if (!seen.has(c.node)) { seen.add(c.node); q.push(c.node); }
    for (const n of real) assert.ok(SUB.has(n.type) ? wf.connections[n.name] : seen.has(n.name), `${n.name} unreachable`);
  });

  test(`${slug}: error outputs wired`, () => {
    for (const n of real) {
      const outs = (wf.connections[n.name] || {}).main || [];
      if (n.onError === 'continueErrorOutput') assert.ok(outs[1] && outs[1].length, `${n.name}: error output unwired`);
      else if (n.type !== 'n8n-nodes-base.if') assert.ok(!outs[1] || !outs[1].length, `${n.name}: stray second output`);
    }
  });

  test(`${slug}: references and config fields resolve`, () => {
    const raw = JSON.stringify(wf.nodes);
    for (const [, name] of raw.matchAll(/\$\(\\?['"]([^'"\\]+)\\?['"]\)/g)) assert.ok(by[name], `missing node "${name}"`);
    const cfgNode = by.Config;
    const fields = new Set((cfgNode ? cfgNode.parameters.assignments.assignments : []).map((a) => a.name));
    const used = [...raw.matchAll(/cfg\.(\w+)|\$\(\\?'Config\\?'\)\.first\(\)\.json\.(\w+)/g)].map((m) => m[1] || m[2]);
    for (const f of used) assert.ok(fields.has(f), `Config.${f} not defined`);
  });

  test(`${slug}: code nodes match tested sources`, () => {
    let files = [];
    try { files = readdirSync(new URL(`${slug}/src/`, root)); } catch { /* none */ }
    const embedded = real.filter((n) => n.type === 'n8n-nodes-base.code').map((n) => n.parameters.jsCode);
    for (const f of files) assert.ok(embedded.includes(readFileSync(new URL(`${slug}/src/${f}`, root), 'utf8')), `${f} not embedded verbatim`);
  });

  test(`${slug}: clean of credentials, pinned data and em dashes`, () => {
    const raw = JSON.stringify(wf);
    assert.ok(!real.some((n) => n.credentials) && !wf.pinData);
    assert.ok(!raw.includes('\u2014') && !raw.includes('\\u2014'));
  });
}

test('rss digest: AI success and failure both reach the formatter', () => {
  const wf = JSON.parse(readFileSync(new URL('rss-ai-digest/workflow.json', root), 'utf8'));
  const outs = wf.connections['AI: write digest'].main;
  assert.equal(outs[0][0].node, 'Format message');
  assert.equal(outs[1][0].node, 'Format message');
});
