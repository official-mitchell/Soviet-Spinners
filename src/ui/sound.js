// Sound effect playback for the lever pull and reel spin sequence — checklist §5.2/§10.
// Created: 2026-08-05.

const LEVER_PULL_SOUND_SRC = 'src/assets/Sounds/cash-register-purchase.mp3';
const SPIN_SELECT_SOUND_SRC = 'src/assets/Sounds/money-counting-machine-sfx.mp3';

/** @type {HTMLAudioElement | null} */
let leverPullAudio = null;

/** @type {HTMLAudioElement | null} */
let spinSelectAudio = null;

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

/** Plays the cash-register chime once, from the start — cue for the lever pull. */
export function playLeverPullSound() {
  try {
    const audio = getLeverPullAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] lever pull playback failed:', error);
  }
}

/** Loops the money-counting sfx for as long as the reels are spinning/selecting. */
export function playSpinSelectSound() {
  try {
    const audio = getSpinSelectAudio();
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch (error) {
    console.debug('[sound] spin select playback failed:', error);
  }
}

/** Stops the reel-spin loop once results have settled. */
export function stopSpinSelectSound() {
  if (!spinSelectAudio) {
    return;
  }
  spinSelectAudio.pause();
  spinSelectAudio.currentTime = 0;
}
