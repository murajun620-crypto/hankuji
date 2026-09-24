export const STORAGE_KEY = 'hankuji.projects.v1';
export const MAX_GROUPS = 52;

export function createProject(course, year, id = crypto.randomUUID()) {
  return { id, course: course.trim(), year: Number(year), groupCount: 6, pattern: 'letters', customNames: [], maxCalls: 3, roundRobin: true, history: [] };
}

export function groupNames(project) {
  const count = Number(project.groupCount);
  return Array.from({ length: count }, (_, index) => {
    if (project.pattern === 'numbers') return String(index + 1);
    if (project.pattern === 'numbered') return `第${index + 1}班`;
    if (project.pattern === 'custom') return project.customNames[index] || '';
    let number = index + 1;
    let label = '';
    while (number > 0) { number--; label = String.fromCharCode(65 + number % 26) + label; number = Math.floor(number / 26); }
    return label;
  });
}

export function validateCustomNames(names, count) {
  const normalized = names.map(name => name.trim());
  if (normalized.length !== count || normalized.some(name => !name)) return `${count}班分の名前を、1行に1つずつ入力してください。`;
  if (new Set(normalized).size !== normalized.length) return '班の名前が重複しています。';
  return '';
}

export function drawState(project) {
  const counts = Array.from({ length: project.groupCount }, () => 0);
  for (const entry of project.history) {
    if (Number.isInteger(entry.groupIndex) && entry.groupIndex >= 0 && entry.groupIndex < counts.length) counts[entry.groupIndex]++;
  }
  const eligible = counts.map((count, index) => count < project.maxCalls ? index : -1).filter(index => index >= 0);
  const minimum = eligible.length ? Math.min(...eligible.map(index => counts[index])) : null;
  const candidates = project.roundRobin ? eligible.filter(index => counts[index] === minimum) : eligible;
  return { counts, eligible, candidates, minimum };
}

export function drawGroup(project, random = Math.random, now = () => new Date()) {
  const { candidates } = drawState(project);
  if (!candidates.length) return null;
  const value = random();
  const groupIndex = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(value * candidates.length)))];
  const entry = { id: crypto.randomUUID(), groupIndex, groupName: groupNames(project)[groupIndex], at: now().toISOString() };
  project.history.push(entry);
  return entry;
}

export function readStore(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.projects)) return { projects: [], activeId: null };
    const projects = parsed.projects.filter(project =>
      project && typeof project.id === 'string' && typeof project.course === 'string' &&
      Number.isInteger(project.year) && Number.isInteger(project.groupCount) && project.groupCount >= 1 && project.groupCount <= MAX_GROUPS &&
      Number.isInteger(project.maxCalls) && project.maxCalls >= 1 && project.maxCalls <= 100 &&
      ['letters', 'numbers', 'numbered', 'custom'].includes(project.pattern) && Array.isArray(project.history) && Array.isArray(project.customNames)
    );
    return { projects, activeId: projects.some(project => project.id === parsed.activeId) ? parsed.activeId : projects[0]?.id || null };
  } catch { return { projects: [], activeId: null }; }
}

export function saveStore(state, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
