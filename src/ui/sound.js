// Sound effect playback for the lever pull and reel spin sequence — checklist §5.2/§10.
// Updated: 2026-08-05 — sequenced cash register → money counter → ticker ticks → finish bell.

const LEVER_PULL_SOUND_SRC = 'src/assets/Sounds/cash-register-purchase.mp3';
const SPIN_SELECT_SOUND_SRC = 'src/assets/Sounds/money-counting-machine-sfx.mp3';
const TICKER_SOUND_SRC = 'src/assets/Sounds/app-ticker.mp3';
const FINISH_BELL_SOUND_SRC = 'src/assets/Sounds/finish-bell.mp3';

/** Total reel spin sequence length in milliseconds. */
export const SPIN_SEQUENCE_MS = 2600;

/** Cash register plays first; money counter and tickers begin after this delay. */
export const CASH_REGISTER_LEAD_MS = 1000;

/** Interval between reel tick sounds during the selecting phase. */
export const TICK_INTERVAL_MS = 130;

/** @type {HTMLAudioElement | null} */
let leverPullAudio = null;

/** @type {HTMLAudioElement | null} */
let spinSelectAudio = null;

/** @type {HTMLAudioElement | null} */
let tickerAudio = null;

/** @type {HTMLAudioElement | null} */
let finishBellAudio = null;

/** @type {{ moneyCounterTimeout: ReturnType<typeof setTimeout> | null, tickInterval: ReturnType<typeof setInterval> | null } | null} */
let activeSpinSound = null;

function getLeverPullAudio() {
  if (!leverPullAudio) {
    leverPullAudio = new Audio(LEVER_PULL_SOUND_SRC);
    leverPullAudio.preload = 'auto';
  }
  return leverPullAudio;
}

function getSpinSelectAudio() {
  if (!spinSelectAudio) {
    spinSelectAudio = new Audio(SPIN_SELECT_SOUND_SRC);
    spinSelectAudio.preload = 'auto';
    spinSelectAudio.loop = true;
  }
  return spinSelectAudio;
}

function getTickerAudio() {
  if (!tickerAudio) {
    tickerAudio = new Audio(TICKER_SOUND_SRC);
    tickerAudio.preload = 'auto';
  }
  return tickerAudio;
}

function getFinishBellAudio() {
  if (!finishBellAudio) {
    finishBellAudio = new Audio(FINISH_BELL_SOUND_SRC);
    finishBellAudio.preload = 'auto';
  }
  return finishBellAudio;
}

/** Plays the cash-register chime once — cue for the lever pull. */
export function playLeverPullSound() {
  try {
    const audio = getLeverPullAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] lever pull playback failed:', error);
  }
}

/** Loops the money-counting sfx during the selecting phase. */
export function playSpinSelectSound() {
  try {
    const audio = getSpinSelectAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] spin select playback failed:', error);
  }
}

/** Stops the reel-spin loop. */
export function stopSpinSelectSound() {
  if (!spinSelectAudio) {
    return;
  }
  spinSelectAudio.pause();
  spinSelectAudio.currentTime = 0;
}

/** Short tick for each reel step during selection. */
export function playTickerSound() {
  try {
    const audio = getTickerAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] ticker playback failed:', error);
  }
}

/** Plays once when all reels have settled. */
export function playFinishBellSound() {
  try {
    const audio = getFinishBellAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] finish bell playback failed:', error);
  }
}

/** Clears any in-flight spin sound timers without playing the finish bell. */
export function cancelSpinSoundSequence() {
  if (!activeSpinSound) {
    stopSpinSelectSound();
    return;
  }

  if (activeSpinSound.moneyCounterTimeout) {
    clearTimeout(activeSpinSound.moneyCounterTimeout);
  }
  if (activeSpinSound.tickInterval) {
    clearInterval(activeSpinSound.tickInterval);
  }
  activeSpinSound = null;
  stopSpinSelectSound();
}

/**
 * Begins the full spin sound sequence:
 * cash register immediately, money counter + tickers after 1s.
 */
export function startSpinSoundSequence() {
  cancelSpinSoundSequence();
  playLeverPullSound();

  const moneyCounterTimeout = setTimeout(() => {
    if (!activeSpinSound) {
      return;
    }
    playSpinSelectSound();
    activeSpinSound.tickInterval = setInterval(() => {
      playTickerSound();
    }, TICK_INTERVAL_MS);
  }, CASH_REGISTER_LEAD_MS);

  activeSpinSound = { moneyCounterTimeout, tickInterval: null };
}

/** Ends the spin sound sequence and plays the finish bell. */
export function stopSpinSoundSequence() {
  cancelSpinSoundSequence();
  playFinishBellSound();
}
