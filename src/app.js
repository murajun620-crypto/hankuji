import { createProject, drawGroup, drawState, groupNames, MAX_GROUPS, readStore, saveStore, validateCustomNames } from './lottery.js';

const $ = id => document.getElementById(id);
const state = readStore();
let dialogMode = 'new';
let toastTimer;
let lastDrawerFocus = null;
let presentationMode = false;
let spinning = false;
let spinTimer = null;
let spinGeneration = 0;
const dateTime = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function activeProject() { return state.projects.find(project => project.id === state.activeId) || null; }
function persist() {
  try { saveStore(state); $('save-indicator').textContent = '変更を保存しました'; return true; }
  catch { toast('保存できませんでした。ブラウザの保存設定をご確認ください。'); return false; }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function renderProjects() {
  const list = $('project-list');
  list.replaceChildren();
  for (const project of state.projects) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `project-item${project.id === state.activeId ? ' active' : ''}`;
    button.setAttribute('aria-current', project.id === state.activeId ? 'page' : 'false');
    const label = document.createElement('span');
    label.textContent = `${project.course} · ${project.year}`;
    button.append(label);
    button.addEventListener('click', () => {
      state.activeId = project.id;
      persist();
      render();
      $('sidebar').classList.remove('open');
    });
    list.append(button);
  }
}

function renderGroups(project, names, draw) {
  const grid = $('group-grid');
  grid.replaceChildren();
  $('groups-count').textContent = `${project.groupCount} 班`;
  names.forEach((name, index) => {
    const count = draw.counts[index];
    const card = document.createElement('div');
    card.className = `group-card${draw.candidates.includes(index) ? ' available' : ''}${count >= project.maxCalls ? ' complete' : ''}`;
    const top = document.createElement('div'); top.className = 'group-card-top';
    const title = document.createElement('span'); title.className = 'group-card-name'; title.textContent = name;
    const counter = document.createElement('span'); counter.className = 'group-card-count'; counter.textContent = `${count} / ${project.maxCalls} 回`;
    top.append(title, counter);
    const progress = document.createElement('div'); progress.className = 'group-progress';
    const bar = document.createElement('span'); bar.style.width = `${Math.min(100, count / project.maxCalls * 100)}%`; progress.append(bar);
    const status = document.createElement('div'); status.className = 'group-card-state';
    status.textContent = count >= project.maxCalls ? '指名上限に到達' : draw.candidates.includes(index) ? '今回の抽選対象' : '次の巡を待機中';
    card.append(top, progress, status);
    grid.append(card);
  });
}

function renderSettings(project) {
  $('group-count').value = project.groupCount;
  $('name-pattern').value = project.pattern;
  $('max-calls').value = project.maxCalls;
  $('round-robin').checked = project.roundRobin;
  $('custom-field').hidden = project.pattern !== 'custom';
  $('custom-names').value = project.customNames.join('\n');
  $('custom-error').textContent = '';
  $('save-indicator').textContent = '変更は自動保存されます';
}

function renderResult(project) {
  const last = project.history.at(-1);
  const draw = drawState(project);
  $('result-kicker').textContent = last ? 'SELECTED GROUP' : 'NEXT UP';
  $('result-name').textContent = last ? last.groupName : '？';
  $('result-name').classList.toggle('long', Boolean(last && last.groupName.length > 5));
  $('result-description').textContent = last ? presentationMode ? '発表をお願いします！' : `${dateTime.format(new Date(last.at))} に指名しました` : 'ボタンを押して発表班を決めましょう';
  $('draw-button').disabled = draw.candidates.length === 0;
  $('draw-button-label').textContent = draw.candidates.length ? '抽選する' : '抽選終了';
  $('draw-hint').textContent = draw.candidates.length ? `${draw.candidates.length} 班が抽選対象 · ${project.roundRobin ? '1巡するまで重複なし' : '重複あり'}` : 'すべての班が指名上限に達しました';
  renderGroups(project, groupNames(project), draw);
}

function cancelSpin() {
  spinGeneration++;
  clearTimeout(spinTimer);
  spinTimer = null;
  spinning = false;
  $('lottery-card').classList.remove('spinning');
  $('result-name').setAttribute('aria-live', 'polite');
  $('open-history').disabled = false;
}

function render() {
  cancelSpin();
  renderProjects();
  const project = activeProject();
  $('empty-state').hidden = Boolean(project);
  $('project-workspace').hidden = !project;
  if (!project) return;
  $('project-title').textContent = project.course;
  $('project-subtitle').textContent = `${project.year}年度 ・ ${project.groupCount}班 ・ 最大${project.maxCalls}回`;
  renderSettings(project);
  renderResult(project);
  if (!$('history-drawer').hidden) renderHistory();
}

function setPresentationMode(enabled) {
  presentationMode = enabled;
  if (enabled && !$('history-drawer').hidden) closeHistory();
  document.body.classList.toggle('presentation-mode', enabled);
  $('student-view').setAttribute('aria-pressed', String(enabled));
  $('exit-student-view').hidden = !enabled;
  $('board-label').textContent = enabled ? `${activeProject()?.course || ''} · ${activeProject()?.year || ''}年度` : '抽選ボード';
  if (!spinning && activeProject()) renderResult(activeProject());
  if (enabled) $('draw-button').focus();
  else $('student-view').focus();
}

function startSpin(project) {
  if (spinning) return;
  const candidates = drawState(project).candidates.map(index => groupNames(project)[index]);
  if (!candidates.length) return;
  const entry = drawGroup(project);
  if (!entry) return;
  persist();
  spinning = true;
  const generation = ++spinGeneration;
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 650 : 2500;
  const started = performance.now();
  const offset = Math.floor(Math.random() * candidates.length);
  let step = 0;
  $('lottery-card').classList.add('spinning');
  $('result-name').classList.remove('reveal');
  $('result-name').setAttribute('aria-live', 'off');
  $('result-name').textContent = '？';
  $('result-kicker').textContent = 'ROULETTE';
  $('result-description').textContent = 'どの班になるでしょう？';
  $('draw-button').disabled = true;
  $('draw-button-label').textContent = '抽選中…';
  $('open-history').disabled = true;
  $('draw-hint').textContent = '抽選中です。結果をお待ちください';

  function tick() {
    if (generation !== spinGeneration || state.activeId !== project.id) return;
    const progress = (performance.now() - started) / duration;
    if (progress >= 1) {
      spinning = false;
      spinTimer = null;
      $('lottery-card').classList.remove('spinning');
      $('result-name').setAttribute('aria-live', 'polite');
      $('open-history').disabled = false;
      renderResult(project);
      $('result-name').classList.remove('reveal');
      void $('result-name').offsetWidth;
      $('result-name').classList.add('reveal');
      return;
    }
    const label = candidates.length === 1 && step % 2 ? '？' : candidates[(offset + step) % candidates.length];
    $('result-name').textContent = label;
    $('result-name').classList.toggle('long', label.length > 5);
    step++;
    spinTimer = setTimeout(tick, 65 + Math.pow(progress, 2) * 300);
  }
  spinTimer = setTimeout(tick, 130);
}

function updateProject(mutate, rerender = true) {
  const project = activeProject();
  if (!project) return;
  mutate(project);
  persist();
  if (rerender) render();
}
function setNumber(id, min, max, property, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    toast(`${min}〜${max}の整数を入力してください。`);
    $(id).value = activeProject()[property];
    return;
  }
  updateProject(project => {
    project[property] = parsed;
    if (property === 'groupCount' && project.pattern === 'custom') {
      const names = project.customNames.slice(0, parsed);
      while (names.length < parsed) {
        let candidate = `班${names.length + 1}`;
        while (names.includes(candidate)) candidate += '・';
        names.push(candidate);
      }
      project.customNames = names;
    }
  });
}
function stepNumber(id, min, max, property, delta) {
  const current = Number($(id).value) || activeProject()[property];
  setNumber(id, min, max, property, Math.min(max, Math.max(min, current + delta)));
}

function renderHistory() {
  const project = activeProject();
  if (!project) return;
  $('drawer-project').textContent = `${project.course} ・ ${project.year}年度`;
  const content = $('history-content');
  content.replaceChildren();
  if (!project.history.length) {
    const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = 'まだ指名履歴はありません。\n最初の抽選をしてみましょう。'; empty.style.whiteSpace = 'pre-line'; content.append(empty);
  } else {
    [...project.history].reverse().forEach((entry, reverseIndex) => {
      const row = document.createElement('div'); row.className = 'history-item';
      const number = document.createElement('span'); number.className = 'history-number'; number.textContent = String(project.history.length - reverseIndex).padStart(2, '0');
      const badge = document.createElement('span'); badge.className = 'history-badge'; badge.textContent = entry.groupName;
      const meta = document.createElement('div'); meta.className = 'history-meta';
      const title = document.createElement('strong'); title.textContent = `${entry.groupName}を指名`;
      const time = document.createElement('span'); time.textContent = dateTime.format(new Date(entry.at));
      meta.append(title, time); row.append(number, badge, meta); content.append(row);
    });
  }
  $('export-history').disabled = !project.history.length;
  $('clear-history').disabled = !project.history.length;
}
function openHistory() {
  lastDrawerFocus = document.activeElement;
  renderHistory();
  $('scrim').hidden = false;
  $('history-drawer').hidden = false;
  $('close-history').focus();
}
function closeHistory() {
  $('history-drawer').hidden = true;
  $('scrim').hidden = true;
  lastDrawerFocus?.focus();
}
function csvValue(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function exportHistory() {
  const project = activeProject();
  if (!project?.history.length) return;
  const rows = [['回数', '日時', '班'], ...project.history.map((entry, index) => [index + 1, dateTime.format(new Date(entry.at)), entry.groupName])];
  const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvValue).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `班くじ_${project.course.replace(/[\\/:*?"<>|]/g, '_')}_${project.year}.csv`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openProjectDialog(mode) {
  dialogMode = mode;
  const project = activeProject();
  $('dialog-title').textContent = mode === 'edit' ? 'プロジェクトを編集' : 'プロジェクトを作成';
  $('course-name').value = mode === 'edit' ? project.course : '';
  $('course-year').value = mode === 'edit' ? project.year : new Date().getFullYear();
  $('project-error').textContent = '';
  $('delete-project').hidden = mode !== 'edit';
  $('project-dialog').showModal();
  $('course-name').focus();
}
function closeProjectDialog() { $('project-dialog').close(); }

$('new-project').addEventListener('click', () => openProjectDialog('new'));
$('empty-create').addEventListener('click', () => openProjectDialog('new'));
$('edit-project').addEventListener('click', () => openProjectDialog('edit'));
$('close-project-dialog').addEventListener('click', closeProjectDialog);
$('project-form').addEventListener('submit', event => {
  event.preventDefault();
  const course = $('course-name').value.trim();
  const year = Number($('course-year').value);
  if (!course || !Number.isInteger(year) || year < 2000 || year > 2100) { $('project-error').textContent = '授業名と2000〜2100の年度を入力してください。'; return; }
  if (state.projects.some(project => project.course === course && project.year === year && (dialogMode !== 'edit' || project.id !== state.activeId))) {
    $('project-error').textContent = '同じ授業名・年度のプロジェクトが既にあります。'; return;
  }
  if (dialogMode === 'edit') { const project = activeProject(); project.course = course; project.year = year; }
  else { const project = createProject(course, year); state.projects.push(project); state.activeId = project.id; }
  persist(); closeProjectDialog(); render(); $('sidebar').classList.remove('open');
});
$('delete-project').addEventListener('click', () => {
  const project = activeProject();
  if (!project || !confirm(`「${project.course}・${project.year}年度」を削除しますか？\n設定と指名履歴も削除されます。`)) return;
  state.projects = state.projects.filter(item => item.id !== project.id);
  state.activeId = state.projects[0]?.id || null;
  persist(); closeProjectDialog(); closeHistory(); render(); toast('プロジェクトを削除しました');
});
$('group-count').addEventListener('change', event => setNumber('group-count', 1, MAX_GROUPS, 'groupCount', event.target.value));
$('count-decrease').addEventListener('click', () => stepNumber('group-count', 1, MAX_GROUPS, 'groupCount', -1));
$('count-increase').addEventListener('click', () => stepNumber('group-count', 1, MAX_GROUPS, 'groupCount', 1));
$('max-calls').addEventListener('change', event => setNumber('max-calls', 1, 100, 'maxCalls', event.target.value));
$('max-decrease').addEventListener('click', () => stepNumber('max-calls', 1, 100, 'maxCalls', -1));
$('max-increase').addEventListener('click', () => stepNumber('max-calls', 1, 100, 'maxCalls', 1));
$('name-pattern').addEventListener('change', event => {
  const value = event.target.value;
  updateProject(project => {
    if (value === 'custom' && project.pattern !== 'custom') project.customNames = groupNames(project);
    project.pattern = value;
  });
});
$('custom-names').addEventListener('input', event => {
  if (spinning) cancelSpin();
  const project = activeProject();
  const names = event.target.value.split(/\r?\n/).map(name => name.trim());
  const error = validateCustomNames(names, project.groupCount);
  $('custom-error').textContent = error;
  if (error) { $('save-indicator').textContent = '名前を修正すると保存されます'; return; }
  project.customNames = names;
  persist();
  renderResult(project);
});
$('round-robin').addEventListener('change', event => updateProject(project => { project.roundRobin = event.target.checked; }));
$('student-view').addEventListener('click', () => setPresentationMode(true));
$('exit-student-view').addEventListener('click', () => setPresentationMode(false));
$('draw-button').addEventListener('click', () => {
  const project = activeProject();
  if (project) startSpin(project);
});
$('open-history').addEventListener('click', openHistory);
$('close-history').addEventListener('click', closeHistory);
$('scrim').addEventListener('click', closeHistory);
$('export-history').addEventListener('click', exportHistory);
$('clear-history').addEventListener('click', () => {
  const project = activeProject();
  if (!project?.history.length || !confirm('このプロジェクトの指名履歴をすべて削除しますか？')) return;
  project.history = []; persist(); renderResult(project); renderHistory(); toast('指名履歴を削除しました');
});
$('mobile-projects').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!$('history-drawer').hidden) closeHistory();
  else if (presentationMode) setPresentationMode(false);
});
render();
