import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup } from '../src/backup.js';
import { createProject, drawGroup } from '../src/lottery.js';

test('全プロジェクトと指名履歴を保存して読み戻せる', () => {
  const first = createProject('機械創成工学入門Ⅱ', 2026, 'first');
  const second = createProject('ゼミナール', 2027, 'second');
  drawGroup(first, () => 0, () => new Date('2026-09-24T01:00:00Z'));
  const state = { projects: [first, second], activeId: 'second' };
  const backup = createBackup(state, () => new Date('2026-09-24T02:00:00Z'));
  const loaded = parseBackup(backup);
  assert.deepEqual(loaded.state, state);
  assert.equal(loaded.historyCount, 1);
  assert.equal(loaded.savedAt, '2026-09-24T02:00:00.000Z');
});

test('不正なファイルでは保存済みデータを置き換えない', () => {
  assert.throws(() => parseBackup('not json'), /保存ファイル/);
  const project = createProject('授業', 2026, 'first');
  const backup = JSON.parse(createBackup({ projects: [project], activeId: 'first' }));
  backup.projects[0].history = [{ id: 'pick', groupIndex: -1, groupName: 'A', at: '2026-09-24T01:00:00Z' }];
  assert.throws(() => parseBackup(JSON.stringify(backup)), /指名履歴/);
});
