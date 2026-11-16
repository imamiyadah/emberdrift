// Keyboard and mouse input: one small state object the whole game reads.
// Coordinates are always reported in field space (1280x720), never in pixels
// of the window, so the simulation does not care how the canvas is scaled.

import { FIELD } from './config.js';

/** Create the input state and attach its listeners to the canvas and window. */
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: FIELD.width / 2,
    mouseY: FIELD.height / 2,
    mouseDown: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
  };

  const toField = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toField(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
    input.mouseDown = true;
    input.clicked = true;
    input.clickX = point.x;
    input.clickY = point.y;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const point = toField(touch);
    input.mouseX = point.x;
    input.mouseY = point.y;
    input.mouseDown = true;
    input.clicked = true;
    input.clickX = point.x;
    input.clickY = point.y;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const point = toField(touch);
    input.mouseX = point.x;
    input.mouseY = point.y;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    input.mouseDown = false;
  });

  return input;
}

/** True while any of the given key codes is held down. */
export function held(input, ...codes) {
  return codes.some((code) => input.keys.has(code));
}

/** True once per physical press of the code; reading it consumes the press. */
export function pressed(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

/** End-of-frame housekeeping: presses and clicks live for exactly one frame. */
export function endFrame(input) {
  input.pressed.clear();
  input.clicked = false;
}

/**
 * The movement/aim/fire controls for one simulation step, read from live input:
 * WASD or arrows to drift, the mouse to aim, mouse hold or Space to fire.
 */
export function readControls(input) {
  let mx = 0;
  let my = 0;
  if (held(input, 'KeyA', 'ArrowLeft')) mx -= 1;
  if (held(input, 'KeyD', 'ArrowRight')) mx += 1;
  if (held(input, 'KeyW', 'ArrowUp')) my -= 1;
  if (held(input, 'KeyS', 'ArrowDown')) my += 1;
  const length = Math.sqrt(mx * mx + my * my);
  if (length > 0) {
    mx /= length;
    my /= length;
  }
  return {
    mx,
    my,
    aimX: input.mouseX,
    aimY: input.mouseY,
    firing: input.mouseDown || held(input, 'Space'),
  };
}
