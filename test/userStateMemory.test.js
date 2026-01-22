import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_STATES } from '../config/states.js';
import { userStateServiceMemory } from '../services/userStateMemory.js';

test('userStateMemory: initial state is START', async () => {
  const userId = 999999;
  const state = await userStateServiceMemory.getState(userId);
  assert.equal(state, USER_STATES.START);
});

test('userStateMemory: setState and getState work correctly', async () => {
  const userId = 999998;
  await userStateServiceMemory.setState(userId, USER_STATES.SELECT_DOSAGE);
  const state = await userStateServiceMemory.getState(userId);
  assert.equal(state, USER_STATES.SELECT_DOSAGE);
});

test('userStateMemory: getUserData returns empty object initially', async () => {
  const userId = 999997;
  const data = await userStateServiceMemory.getUserData(userId);
  assert.deepEqual(data, {});
});

test('userStateMemory: updateUserData stores and retrieves data', async () => {
  const userId = 999996;
  await userStateServiceMemory.updateUserData(userId, { capsules: 2, timezone: 'UTC+3' });
  const data = await userStateServiceMemory.getUserData(userId);
  assert.equal(data.capsules, 2);
  assert.equal(data.timezone, 'UTC+3');
});

test('userStateMemory: updateUserData merges with existing data', async () => {
  const userId = 999995;
  await userStateServiceMemory.updateUserData(userId, { capsules: 1 });
  await userStateServiceMemory.updateUserData(userId, { timezone: 'UTC+5' });
  const data = await userStateServiceMemory.getUserData(userId);
  assert.equal(data.capsules, 1);
  assert.equal(data.timezone, 'UTC+5');
});

test('userStateMemory: reset clears all data', async () => {
  const userId = 999994;
  await userStateServiceMemory.setState(userId, USER_STATES.SELECT_TIMEZONE);
  await userStateServiceMemory.updateUserData(userId, { capsules: 2, time1: '08:00' });
  
  await userStateServiceMemory.reset(userId);
  
  const state = await userStateServiceMemory.getState(userId);
  const data = await userStateServiceMemory.getUserData(userId);
  assert.equal(state, USER_STATES.START);
  assert.deepEqual(data, {});
});
