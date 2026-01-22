import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXTS, BUTTONS } from '../config/texts.js';

test('texts: TEXTS object exists and has required keys', () => {
  assert.ok(TEXTS.WELCOME);
  assert.ok(TEXTS.SELECT_DOSAGE);
  assert.ok(TEXTS.SELECT_TIMEZONE);
  assert.ok(TEXTS.SELECT_TIME_SINGLE);
  assert.ok(TEXTS.REMINDER_MESSAGE);
});

test('texts: BUTTONS object exists and has required keys', () => {
  assert.ok(BUTTONS.START_VITAMINS);
  assert.ok(BUTTONS.ABOUT_COMPANY);
  assert.ok(BUTTONS.ONE_CAPSULE);
  assert.ok(BUTTONS.TWO_CAPSULES);
  assert.ok(BUTTONS.BACK);
});

test('texts: REMINDER_DETAILS function works for single time', () => {
  const result = TEXTS.REMINDER_DETAILS(1, '08:00');
  assert.ok(result.includes('08:00'));
  assert.ok(result.includes('Один раз в день') || result.includes('один раз'));
});

test('texts: REMINDER_DETAILS function works for two times', () => {
  const result = TEXTS.REMINDER_DETAILS(2, '08:00', '12:00');
  assert.ok(result.includes('08:00'));
  assert.ok(result.includes('12:00'));
  assert.ok(result.includes('Два раза в день') || result.includes('два раза'));
});

test('texts: REMINDER_SET_SINGLE function replaces placeholders', () => {
  const result = TEXTS.REMINDER_SET_SINGLE(1, '08:00', 'UTC+3');
  assert.ok(result.includes('08:00'));
  assert.ok(result.includes('UTC+3'));
});

test('texts: REMINDER_SET_DOUBLE function replaces placeholders', () => {
  const result = TEXTS.REMINDER_SET_DOUBLE(2, '08:00', '12:00', 'UTC+3');
  assert.ok(result.includes('08:00'));
  assert.ok(result.includes('12:00'));
  assert.ok(result.includes('UTC+3'));
});

test('texts: CONFIRM_TIME_SINGLE function replaces time placeholder', () => {
  const result = TEXTS.CONFIRM_TIME_SINGLE('08:00');
  assert.ok(result.includes('08:00'));
});
