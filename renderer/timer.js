// Panel timer + settings.

const timeEl = document.getElementById('time');
const phaseEl = document.getElementById('phase');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const tabs = document.querySelectorAll('.tab');
const panels = {
  pomodoro:  document.querySelector('.settings-pomodoro'),
  countdown: document.querySelector('.settings-countdown'),
  stopwatch: document.querySelector('.settings-stopwatch'),
};

const state = {
  mode: 'pomodoro',
  running: false,
  startTime: 0,
  elapsedBefore: 0,
  phase: 'work',
  cycle: 1,
  rafId: null,
  lastMood: null,
};

function fmt(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const getPomoWorkMs  = () => Math.max(1, parseInt(document.getElementById('pomo-work').value)  || 25) * 60000;
const getPomoBreakMs = () => Math.max(1, parseInt(document.getElementById('pomo-break').value) || 5)  * 60000;
const getCountdownMs = () => {
  const h = Math.max(0, Math.min(23, parseInt(document.getElementById('cd-hour').value) || 0));
  const m = Math.max(0, Math.min(59, parseInt(document.getElementById('cd-min').value)  || 0));
  return Math.max(60000, (h * 60 + m) * 60000);
};

function currentElapsed() {
  if (!state.running) return state.elapsedBefore;
  return state.elapsedBefore + (Date.now() - state.startTime);
}

function setMood(mood) {
  if (state.lastMood === mood) return;
  state.lastMood = mood;
  if (window.studyCat) window.studyCat.setMood(mood);
}

function render() {
  const elapsed = currentElapsed();
  let display = 0;
  let phaseText = '';

  if (state.mode === 'pomodoro') {
    const total = state.phase === 'work' ? getPomoWorkMs() : getPomoBreakMs();
    display = total - elapsed;
    phaseText = state.running ? (state.phase === 'work' ? '공부 중' : '휴식 중') : '';
    if (display <= 0 && state.running) { transitionPomodoro(); return; }
  } else if (state.mode === 'countdown') {
    display = getCountdownMs() - elapsed;
    phaseText = state.running ? '카운트다운' : '';
    if (display <= 0 && state.running) { finishCountdown(); return; }
  } else if (state.mode === 'stopwatch') {
    display = elapsed;
    phaseText = state.running ? '측정 중' : '';
  }

  timeEl.textContent = fmt(display);
  phaseEl.textContent = phaseText;

  if (state.running) state.rafId = requestAnimationFrame(render);
}

function transitionPomodoro() {
  state.elapsedBefore = 0;
  state.startTime = Date.now();
  if (state.phase === 'work') {
    state.phase = 'break';
    setMood('rest');
    if (window.studyCat) window.studyCat.celebrate();
    window.studyCat.notify('휴식 시간', `${state.cycle}회차 끝! 잠깐 쉬어요`);
  } else {
    state.phase = 'work';
    state.cycle += 1;
    setMood('study');
    window.studyCat.notify('공부 시작', `${state.cycle}회차 시작`);
  }
  render();
}

function finishCountdown() {
  state.running = false;
  state.elapsedBefore = 0;
  cancelAnimationFrame(state.rafId);
  setMood('rest');
  if (window.studyCat) {
    window.studyCat.celebrate();
    window.studyCat.notify('완료', '카운트다운 끝났어요');
  }
  timeEl.textContent = fmt(0);
  phaseEl.textContent = '완료!';
  btnStart.disabled = false;
  btnStart.textContent = '시작';
  btnPause.disabled = true;
}

function start() {
  if (state.running) return;
  state.running = true;
  state.startTime = Date.now();
  if (state.mode === 'pomodoro')      setMood(state.phase === 'work' ? 'study' : 'rest');
  else                                setMood('study');
  btnStart.disabled = true;
  btnPause.disabled = false;
  btnStart.textContent = '시작';
  render();
}

function pause() {
  if (!state.running) return;
  state.elapsedBefore = currentElapsed();
  state.running = false;
  cancelAnimationFrame(state.rafId);
  setMood('rest');
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnStart.textContent = '재개';
  render();
}

function reset() {
  state.running = false;
  state.elapsedBefore = 0;
  state.startTime = 0;
  state.phase = 'work';
  state.cycle = 1;
  cancelAnimationFrame(state.rafId);
  setMood('idle');
  btnStart.disabled = false;
  btnStart.textContent = '시작';
  btnPause.disabled = true;
  render();
}

function setMode(mode) {
  reset();
  state.mode = mode;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === mode));
  window.studyCat.setSetting('mode', mode);
  render();
}

btnStart.addEventListener('click', start);
btnPause.addEventListener('click', pause);
btnReset.addEventListener('click', reset);
tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));

// Persisting timer settings on change
function persistInputSetting(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    if (!state.running) render();
    window.studyCat.setSetting(key, el.value);
  });
}
persistInputSetting('pomo-work', 'pomoWork');
persistInputSetting('pomo-break', 'pomoBreak');
persistInputSetting('cd-hour', 'cdHour');
persistInputSetting('cd-min', 'cdMin');

// === Window control buttons ===
document.getElementById('btn-quit').addEventListener('click', () => window.studyCat.hide());
document.getElementById('btn-hide').addEventListener('click', () => window.studyCat.minimize());

const btnPin = document.getElementById('btn-pin');
let pinned = true;
btnPin.addEventListener('click', () => {
  pinned = !pinned;
  window.studyCat.setAlwaysOnTop(pinned);
  btnPin.classList.toggle('active', pinned);
  window.studyCat.setSetting('pinned', pinned);
});

const btnCT = document.getElementById('btn-clickthrough');
btnCT.addEventListener('click', () => window.studyCat.toggleClickThrough());
window.studyCat.onClickThroughChanged((on) => btnCT.classList.toggle('active', on));

const btnCatToggle = document.getElementById('btn-cat-toggle');
let catVisible = true;
btnCatToggle.addEventListener('click', () => {
  catVisible = !catVisible;
  window.studyCat.toggleCat();
  btnCatToggle.classList.toggle('active', catVisible);
  btnCatToggle.title = catVisible ? '고양이 숨기기 (Alt+K)' : '고양이 보이기 (Alt+K)';
});

// Cat size slider
const sizeSlider = document.getElementById('cat-size');
const sizeVal = document.getElementById('cat-size-val');
sizeSlider.addEventListener('input', () => {
  sizeVal.textContent = sizeSlider.value;
  window.studyCat.setSetting('catSize', parseInt(sizeSlider.value));
});

// Hot-zone for click-through escape
const titlebar = document.getElementById('titlebar');
if (titlebar) {
  titlebar.addEventListener('mouseenter', () => window.studyCat.setHotZone(true));
  titlebar.addEventListener('mouseleave', () => window.studyCat.setHotZone(false));
}

// === Restore settings on startup ===
async function restoreSettings() {
  const s = await window.studyCat.getSettings();
  if (s.pomoWork)  document.getElementById('pomo-work').value  = s.pomoWork;
  if (s.pomoBreak) document.getElementById('pomo-break').value = s.pomoBreak;
  if (s.cdHour !== undefined) document.getElementById('cd-hour').value = s.cdHour;
  if (s.cdMin !== undefined)  document.getElementById('cd-min').value  = s.cdMin;
  if (s.catSize) {
    sizeSlider.value = s.catSize;
    sizeVal.textContent = s.catSize;
  }
  if (s.mode && panels[s.mode]) {
    state.mode = s.mode;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === s.mode));
    Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === s.mode));
  }
  if (s.pinned === false) {
    pinned = false;
    window.studyCat.setAlwaysOnTop(false);
    btnPin.classList.remove('active');
  }
  if (s.catVisible === false) {
    catVisible = false;
    btnCatToggle.classList.remove('active');
  }
  setMood('idle');
  render();
}
restoreSettings();
