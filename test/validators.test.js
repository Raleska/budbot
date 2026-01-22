import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime, isValidTime } from '../utils/validators.js';

test('normalizeTime: formats single digit hours correctly', () => {
  assert.equal(normalizeTime('8:00'), '08:00');
  assert.equal(normalizeTime('8:5'), '08:05');
  assert.equal(normalizeTime('9:30'), '09:30');
});

test('normalizeTime: keeps double digit hours unchanged', () => {
  assert.equal(normalizeTime('12:00'), '12:00');
  assert.equal(normalizeTime('23:59'), '23:59');
});

test('normalizeTime: handles edge cases', () => {
  assert.equal(normalizeTime('00:00'), '00:00');
  assert.equal(normalizeTime('0:0'), '00:00');
  assert.equal(normalizeTime('24:00'), '24:00');
});

test('isValidTime: accepts valid time formats', () => {
  assert.equal(isValidTime('08:00'), true);
  assert.equal(isValidTime('12:30'), true);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('00:00'), true);
});

test('isValidTime: rejects invalid formats', () => {
  assert.equal(isValidTime('25:00'), false);
  assert.equal(isValidTime('12:60'), false);
  assert.equal(isValidTime('abc'), false);
  assert.equal(isValidTime('12'), false);
  assert.equal(isValidTime('12:'), false);
  assert.equal(isValidTime(':30'), false);
  assert.equal(isValidTime('24:00'), false);
});
