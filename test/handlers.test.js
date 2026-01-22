import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_STATES } from '../config/states.js';

process.env.USE_DATABASE = 'false';

test.before(async () => {
  process.env.USE_DATABASE = 'false';
});

function createMockCtx(userId, text = null, callbackData = null) {
  const sentMessages = [];
  const editedMessages = [];
  
  return {
    from: { id: userId, first_name: 'Test', username: 'testuser' },
    message: text ? { text } : null,
    callbackQuery: callbackData ? { data: callbackData } : null,
    reply: async (msg, extra) => {
      sentMessages.push({ msg, extra });
      return { message_id: sentMessages.length };
    },
    editMessageText: async (msg, extra) => {
      editedMessages.push({ msg, extra });
      return { message_id: editedMessages.length };
    },
    answerCbQuery: async () => {},
    sentMessages,
    editedMessages,
  };
}

test('handlers: startHandler resets user state', async () => {
  const { startHandler } = await import('../handlers/startHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777777;
  const ctx = createMockCtx(userId);
  
  await startHandler(ctx);
  
  const state = await userStateService.getState(userId);
  assert.equal(state, USER_STATES.START);
  assert.equal(ctx.sentMessages.length + ctx.editedMessages.length, 1);
});

test('handlers: dosageHandler sets SELECT_DOSAGE state', async () => {
  const { dosageHandler } = await import('../handlers/dosageHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777776;
  const ctx = createMockCtx(userId, null, 'action:start_vitamins');
  
  await dosageHandler(ctx);
  
  const state = await userStateService.getState(userId);
  assert.equal(state, USER_STATES.SELECT_DOSAGE);
});

test('handlers: capsuleSelectionHandler saves capsules and sets timezone state', async () => {
  const { capsuleSelectionHandler } = await import('../handlers/capsuleSelectionHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777775;
  const ctx = createMockCtx(userId);
  
  await capsuleSelectionHandler(ctx, 'one');
  
  const data = await userStateService.getUserData(userId);
  const state = await userStateService.getState(userId);
  assert.equal(data.capsules, 1);
  assert.equal(state, USER_STATES.SELECT_TIMEZONE);
});

test('handlers: timezoneHandler saves timezone and sets time selection state', async () => {
  const { timezoneHandler } = await import('../handlers/timezoneHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777774;
  const ctx = createMockCtx(userId);
  
  await userStateService.updateUserData(userId, { capsules: 1 });
  await timezoneHandler(ctx, 'UTC+3');
  
  const data = await userStateService.getUserData(userId);
  const state = await userStateService.getState(userId);
  assert.equal(data.timezone, 'UTC+3');
  assert.equal(state, USER_STATES.SELECT_TIME_SINGLE);
});

test('handlers: timeSelectionHandler saves time and sets confirmation state', async () => {
  const { timeSelectionHandler } = await import('../handlers/timeSelectionHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777773;
  const ctx = createMockCtx(userId, null, 'action:time:08:00');
  
  await userStateService.updateUserData(userId, { capsules: 1, timezone: 'UTC+3' });
  await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
  
  await timeSelectionHandler(ctx, '08:00');
  
  const data = await userStateService.getUserData(userId);
  const state = await userStateService.getState(userId);
  assert.equal(data.time1, '08:00');
  assert.equal(state, USER_STATES.CONFIRM_TIME_SINGLE);
});

test('handlers: customTimeHandler validates and saves custom time', async () => {
  const { customTimeHandler } = await import('../handlers/customTimeHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777772;
  const ctx = createMockCtx(userId, '14:30');
  
  await userStateService.updateUserData(userId, { capsules: 1, timezone: 'UTC+3' });
  await userStateService.setState(userId, USER_STATES.ENTER_CUSTOM_TIME_SINGLE);
  
  await customTimeHandler(ctx);
  
  const data = await userStateService.getUserData(userId);
  const state = await userStateService.getState(userId);
  assert.equal(data.time1, '14:30');
  assert.equal(state, USER_STATES.CONFIRM_TIME_SINGLE);
});

test('handlers: customTimeHandler rejects invalid time format', async () => {
  const { customTimeHandler } = await import('../handlers/customTimeHandler.js');
  const { userStateService } = await import('../services/index.js');
  
  const userId = 777771;
  const ctx = createMockCtx(userId, 'invalid');
  
  await userStateService.updateUserData(userId, { capsules: 1, timezone: 'UTC+3' });
  await userStateService.setState(userId, USER_STATES.ENTER_CUSTOM_TIME_SINGLE);
  
  await customTimeHandler(ctx);
  
  assert.ok(ctx.sentMessages.length > 0 || ctx.editedMessages.length > 0);
});
