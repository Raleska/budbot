import test from 'node:test';
import assert from 'node:assert/strict';
import { userAnalyticsServiceMemory } from '../services/userAnalyticsMemory.js';

test('userAnalyticsMemory: trackInteraction creates user record', async () => {
  const userId = 888888;
  const user = { id: userId, first_name: 'Test', username: 'testuser' };
  
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  
  const data = await userAnalyticsServiceMemory.getUserAnalytics(userId);
  assert.ok(data);
  assert.equal(data.user_id, userId);
  assert.equal(data.interaction_count, 1);
});

test('userAnalyticsMemory: trackInteraction increments count', async () => {
  const userId = 888887;
  const user = { id: userId, first_name: 'Test' };
  
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  
  const data = await userAnalyticsServiceMemory.getUserAnalytics(userId);
  assert.equal(data.interaction_count, 3);
});

test('userAnalyticsMemory: trackReminderSetup increments reminder_setups', async () => {
  const userId = 888886;
  const user = { id: userId };
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  
  await userAnalyticsServiceMemory.trackReminderSetup(userId, { capsules: 1, time1: '08:00' });
  
  const data = await userAnalyticsServiceMemory.getUserAnalytics(userId);
  assert.equal(data.reminder_setups, 1);
});

test('userAnalyticsMemory: trackReminderChange increments reminder_changes', async () => {
  const userId = 888885;
  const user = { id: userId };
  await userAnalyticsServiceMemory.trackInteraction(userId, user);
  
  await userAnalyticsServiceMemory.trackReminderChange(userId);
  
  const data = await userAnalyticsServiceMemory.getUserAnalytics(userId);
  assert.equal(data.reminder_changes, 1);
});
