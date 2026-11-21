// Keyboard + mouse input. Keys are tracked by their `code` (KeyW, ArrowUp, ...)
// so layouts do not matter. Mouse position is kept in canvas pixels and each
// click is queued once, so a single click never fires twice.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_HANDBRAKE = 'handbrake';
export const ACTION_MUTE = 'mute';
export const ACTION_NEWGAME = 'newgame';

const KEY_BINDINGS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: ACTION_INTERACT,
  Space: ACTION_HANDBRAKE,
  Enter: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
  KeyN: ACTION_NEWGAME,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, clicked: false, down: false };

  function onKeyDown(event) {
    const action = KEY_BINDINGS[event.code];
    if (action) {
      if (!held.has(action)) pressed.add(action);
      held.add(action);
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    const action = KEY_BINDINGS[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }
  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held,
    mouse,
    isDown(action) {
      return held.has(action);
    },
    // True once for the frame the key went down; callers consume it each frame.
    wasPressed(action) {
      return pressed.has(action);
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
