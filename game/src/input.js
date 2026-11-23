// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (confirm, pause, interact, exit car, menus, number keys) are queued as flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_EXIT_CAR = 8;
export const ACTION_GARAGE = 16;
export const ACTION_CREW = 32;
export const ACTION_CANCEL = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP']);
const INTERACT = new Set(['KeyE']);
const EXIT_CAR = new Set(['KeyF']);
const GARAGE = new Set(['KeyG']);
const CREW = new Set(['KeyC']);
const CANCEL = new Set(['Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let numbers = 0; // bit per number key 1..9 pressed since last take

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (EXIT_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_EXIT_CAR;
    } else if (GARAGE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GARAGE;
    } else if (CREW.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CREW;
    } else if (CANCEL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CANCEL;
    } else if (/^Digit[1-9]$/.test(event.code)) {
      if (!event.repeat) numbers |= 1 << (Number(event.code.slice(5)) - 1);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Steering: { x: -1..1, y: -1..1 } from the held keys. */
    move() {
      return {
        x: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        y: (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Number keys 1..9 pressed since the last call, as a bit per key. */
    takeNumbers() {
      const taken = numbers;
      numbers = 0;
      return taken;
    },
  };
}
