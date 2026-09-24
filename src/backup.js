import { MAX_GROUPS, validateCustomNames } from './lottery.js?v=20260924-9';

export const BACKUP_FILENAME = 'NEXT-Group-data.txt';
const FORMAT = 'next-group-backup';
const VERSION = 1;
const MAX_BACKUP_LENGTH = 20_000_000;

export function createBackup(state, now = () => new Date()) {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    savedAt: now().toISOString(),
    projects: state.projects,
    activeId: state.activeId,
  }, null, 2);
}

export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_LENGTH) throw new Error('ファイルが大きすぎるか、読み込めません。');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('NEXT Groupの保存ファイルではありません。'); }
  if (data?.format !== FORMAT || data.version !== VERSION || !Array.isArray(data.projects) || data.projects.length > 1000) {
    throw new Error('対応していない保存ファイルです。');
  }
  if (typeof data.savedAt !== 'string' || !Number.isFinite(Date.parse(data.savedAt))) throw new Error('保存日時が正しくありません。');

  const ids = new Set();
  const projects = data.projects.map(project => {
    if (!project || typeof project.id !== 'string' || !project.id || ids.has(project.id) ||
        typeof project.course !== 'string' || !project.course.trim() || project.course.length > 60 ||
        !Number.isInteger(project.year) || project.year < 2000 || project.year > 2100 ||
        !Number.isInteger(project.groupCount) || project.groupCount < 1 || project.groupCount > MAX_GROUPS ||
        !['letters', 'numbers', 'numbered', 'custom'].includes(project.pattern) ||
        !Array.isArray(project.customNames) || project.customNames.some(name => typeof name !== 'string') ||
        !Number.isInteger(project.maxCalls) || project.maxCalls < 1 || project.maxCalls > 100 ||
        typeof project.roundRobin !== 'boolean' || !Array.isArray(project.history) || project.history.length > 100_000) {
      throw new Error('プロジェクトの内容が正しくありません。');
    }
    if (project.pattern === 'custom' && validateCustomNames(project.customNames, project.groupCount)) {
      throw new Error('班の名前が正しくありません。');
    }
    ids.add(project.id);
    const history = project.history.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id ||
          !Number.isInteger(entry.groupIndex) || entry.groupIndex < 0 || entry.groupIndex >= MAX_GROUPS ||
          typeof entry.groupName !== 'string' || !entry.groupName ||
          typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) {
        throw new Error('指名履歴の内容が正しくありません。');
      }
      return { id: entry.id, groupIndex: entry.groupIndex, groupName: entry.groupName, at: entry.at };
    });
    return {
      id: project.id, course: project.course, year: project.year,
      groupCount: project.groupCount, pattern: project.pattern,
      customNames: [...project.customNames], maxCalls: project.maxCalls,
      roundRobin: project.roundRobin, history,
    };
  });
  const activeId = projects.some(project => project.id === data.activeId) ? data.activeId : projects[0]?.id || null;
  return { state: { projects, activeId }, savedAt: data.savedAt, historyCount: projects.reduce((count, project) => count + project.history.length, 0) };
}
