import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_STATES } from '../config/states.js';

process.env.USE_DATABASE = 'false';

function createMockCtx(userId) {
  const sentMessages = [];
  const editedMessages = [];
  
  return {
    from: { id: userId, first_name: 'Test' },
    telegram: {
      sendMessage: async () => ({ message_id: 1 }),
    },
    reply: async (msg, extra) => {
      sentMessages.push({ msg, extra });
      return { message_id: sentMessages.length };
    },
    editMessageText: async (msg, extra) => {
      editedMessages.push({ msg, extra });
      return { message_id: editedMessages.length };
    },
    sentMessages,
    editedMessages,
  };
}

test('confirmationHandler: creates single reminder correctly', async () => {
  const { confirmationHandler } = await import('../handlers/confirmationHandler.js');
  const { userStateService, getReminder } = await import('../services/index.js');
  
  const userId = 666666;
  const ctx = createMockCtx(userId);
  
  await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SINGLE);
  await userStateService.updateUserData(userId, {
    capsules: 1,
    time1: '08:00',
    timezone: 'UTC+3',
  });
  
  await confirmationHandler(ctx);
  
  const reminder = await getReminder(userId);
  assert.ok(reminder);
  assert.equal(reminder.capsules, 1);
  assert.equal(reminder.time1, '08:00');
  assert.equal(reminder.timezone, 'UTC+3');
});

test('confirmationHandler: creates double reminder correctly', async () => {
  const { confirmationHandler } = await import('../handlers/confirmationHandler.js');
  const { userStateService, getReminder } = await import('../services/index.js');
  
  const userId = 666665;
  const ctx = createMockCtx(userId);
  
  await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SECOND);
  await userStateService.updateUserData(userId, {
    capsules: 2,
    time1: '08:00',
    time2: '12:00',
    timezone: 'UTC+3',
  });
  
  await confirmationHandler(ctx);
  
  const reminder = await getReminder(userId);
  assert.ok(reminder);
  assert.equal(reminder.capsules, 2);
  assert.equal(reminder.time1, '08:00');
  assert.equal(reminder.time2, '12:00');
});
