import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, drawGroup, drawState, groupNames, readStore, saveStore, validateCustomNames, withoutProject } from '../src/lottery.js';

test('名称パターンと自由入力を生成する', () => {
  const project = createProject('授業', 2026, 'p1');
  project.groupCount = 28;
  assert.equal(groupNames(project)[26], 'AA');
  assert.equal(groupNames(project)[27], 'AB');
  project.groupCount = 3;
  project.pattern = 'numbers';
  assert.deepEqual(groupNames(project), ['1', '2', '3']);
  project.pattern = 'numbered';
  assert.deepEqual(groupNames(project), ['第1班', '第2班', '第3班']);
  project.pattern = 'custom';
  project.customNames = ['青', '赤', '黄'];
  assert.deepEqual(groupNames(project), ['青', '赤', '黄']);
  assert.equal(validateCustomNames(['青', '青', '黄'], 3), '班の名前が重複しています。');
});

test('1巡するまで重複せず、上限で抽選を終える', () => {
  const project = createProject('授業', 2026, 'p1');
  project.groupCount = 3;
  project.maxCalls = 2;
  const picks = [];
  for (let i = 0; i < 6; i++) picks.push(drawGroup(project, () => 0, () => new Date('2026-09-24T01:00:00Z')).groupIndex);
  assert.deepEqual(picks, [0, 1, 2, 0, 1, 2]);
  assert.equal(drawGroup(project, () => 0), null);
  assert.deepEqual(drawState(project).counts, [2, 2, 2]);
});

test('重複を許可した場合は同じ班を再度選べる', () => {
  const project = createProject('授業', 2026, 'p1');
  project.groupCount = 2;
  project.maxCalls = 2;
  project.roundRobin = false;
  assert.equal(drawGroup(project, () => 0).groupIndex, 0);
  assert.equal(drawGroup(project, () => 0).groupIndex, 0);
  assert.deepEqual(drawState(project).candidates, [1]);
});

test('プロジェクト別の状態を保存・読み込みできる', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const first = createProject('国語', 2026, 'first');
  const second = createProject('数学', 2027, 'second');
  drawGroup(first, () => 0);
  saveStore({ projects: [first, second], activeId: second.id }, storage);
  const loaded = readStore(storage);
  assert.equal(loaded.activeId, 'second');
  assert.equal(loaded.projects[0].history.length, 1);
  assert.equal(loaded.projects[1].history.length, 0);
});

test('削除したプロジェクトの履歴だけを除き、次のプロジェクトを選ぶ', () => {
  const first = createProject('国語', 2026, 'first');
  const second = createProject('数学', 2026, 'second');
  drawGroup(first, () => 0);
  drawGroup(second, () => 0);
  const state = { projects: [first, second], activeId: 'first' };
  const afterFirst = withoutProject(state, 'first');
  assert.deepEqual(afterFirst.projects.map(project => project.id), ['second']);
  assert.equal(afterFirst.projects[0].history.length, 1);
  assert.equal(afterFirst.activeId, 'second');
  assert.deepEqual(withoutProject(afterFirst, 'second'), { projects: [], activeId: null });
});
