import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trackInteraction,
  trackReminderSetup,
  trackReminderChange,
  getUserData,
} from '../services/userAnalyticsMemory.js';

test('userAnalyticsMemory: trackInteraction creates user record', async () => {
  const userId = 888888;
  const user = { id: userId, first_name: 'Test', username: 'testuser' };

  await trackInteraction(userId, user);

  const data = await getUserData(userId);
  assert.ok(data);
  assert.equal(data.userId, userId);
  assert.equal(data.interactionCount, 1);
});

test('userAnalyticsMemory: trackInteraction increments count', async () => {
  const userId = 888887;
  const user = { id: userId, first_name: 'Test' };

  await trackInteraction(userId, user);
  await trackInteraction(userId, user);
  await trackInteraction(userId, user);

  const data = await getUserData(userId);
  assert.equal(data.interactionCount, 3);
});

test('userAnalyticsMemory: trackReminderSetup increments reminderSetups', async () => {
  const userId = 888886;
  const user = { id: userId };
  await trackInteraction(userId, user);

  await trackReminderSetup(userId, { capsules: 1, time1: '08:00' });

  const data = await getUserData(userId);
  assert.equal(data.reminderSetups, 1);
});

test('userAnalyticsMemory: trackReminderChange increments reminderChanges', async () => {
  const userId = 888885;
  const user = { id: userId };
  await trackInteraction(userId, user);

  await trackReminderChange(userId);

  const data = await getUserData(userId);
  assert.equal(data.reminderChanges, 1);
});
