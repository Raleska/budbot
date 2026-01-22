import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addReminder,
  loadAllReminders,
  __debugGetJobsCount,
  __debugReset,
  __setCronAdapter,
  __setReminderRepository,
} from '../services/reminderService.js';

function createFakeCron() {
  const jobs = [];
  return {
    jobs,
    schedule(_expr, _fn, _opts) {
      const job = { stopped: false, stop() { this.stopped = true; } };
      jobs.push(job);
      return job;
    },
  };
}

function createFakeBot() {
  const sent = [];
  return {
    sent,
    telegram: {
      async sendMessage(userId, text) {
        sent.push({ userId, text });
      },
    },
  };
}

test('DB service: userId number vs string overwrites jobs (no duplicates)', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 1 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 123, { capsules: 1, time1: '08:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(123), 1);

  // same user, different type (string) => should stop previous and keep 1
  await addReminder(bot, '123', { capsules: 1, time1: '09:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(123), 1);
  assert.equal(fakeCron.jobs.length, 2);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, false);
});

test('DB service: two-times reminder creates exactly 2 jobs and overwrites cleanly', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 999, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(999), 2);

  await addReminder(bot, '999', { capsules: 2, time1: '08:30', time2: '12:30', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(999), 2);

  // First 2 jobs should be stopped
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('DB service: loadAllReminders should not create duplicate jobs across runs', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const reminders = [
    { user_id: '1', capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' },
  ];

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return reminders; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await loadAllReminders(bot);
  assert.equal(__debugGetJobsCount('1'), 2);

  await loadAllReminders(bot);
  assert.equal(__debugGetJobsCount(1), 2);
});

test('DB service: changing from 1 time to 2 times stops old job and creates 2 new', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 1 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 555, { capsules: 1, time1: '08:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(555), 1);

  await addReminder(bot, 555, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(555), 2);
  assert.equal(fakeCron.jobs[0].stopped, true);
});

test('DB service: changing from 2 times to 1 time stops both old jobs and creates 1 new', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 2 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 666, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(666), 2);

  await addReminder(bot, 666, { capsules: 1, time1: '09:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(666), 1);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('DB service: changing both times in 2-times reminder stops both and creates 2 new', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 2 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 777, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(777), 2);

  await addReminder(bot, 777, { capsules: 2, time1: '10:00', time2: '18:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(777), 2);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('DB service: removeReminder stops all jobs', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 2 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 888, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(888), 2);

  const { removeReminder } = await import('../services/reminderService.js');
  await removeReminder(888);
  assert.equal(__debugGetJobsCount(888), 0);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('DB service: different timezones convert correctly', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const repo = {
    async upsertReminder() { return {}; },
    async getReminderByUserId() { return { enabled: true, capsules: 1 }; },
    async deleteReminder() { return {}; },
    async hasActiveReminder() { return true; },
    async getAllActiveReminders() { return []; },
  };
  __setReminderRepository(repo);

  const bot = createFakeBot();

  await addReminder(bot, 111, { capsules: 1, time1: '08:00', time2: null, timezone: 'UTC+5.5' });
  assert.equal(__debugGetJobsCount(111), 1);
  assert.equal(fakeCron.jobs[0].stopped, false);
});

