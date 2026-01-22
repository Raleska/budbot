import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboards } from '../utils/keyboards.js';

test('keyboards: dosageSelection returns inline keyboard', () => {
  const keyboard = keyboards.dosageSelection();
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: timezoneSelection returns inline keyboard', () => {
  const keyboard = keyboards.timezoneSelection();
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: timeSelection returns inline keyboard', () => {
  const keyboard = keyboards.timeSelection();
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: customTimeInput returns inline keyboard', () => {
  const keyboard = keyboards.customTimeInput();
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: confirmation returns inline keyboard', () => {
  const keyboard = keyboards.confirmation();
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: mainMenu returns inline keyboard without reminder', async () => {
  const keyboard = await keyboards.mainMenu(null);
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});

test('keyboards: mainMenu works with null userId', async () => {
  const keyboard = await keyboards.mainMenu(null);
  assert.ok(keyboard);
  assert.ok(keyboard.reply_markup);
});
