import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addReminder,
  __debugGetJobsCount,
  __debugReset,
  __setCronAdapter,
} from '../services/reminderServiceMemory.js';

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

function createFakeTelegram() {
  const sent = [];
  return {
    sent,
    async sendMessage(userId, text) {
      sent.push({ userId, text });
    },
  };
}

test('Memory service: userId number vs string overwrites jobs (no duplicates)', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const telegram = createFakeTelegram();

  await addReminder(telegram, 123, { capsules: 1, time1: '08:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(123), 1);

  await addReminder(telegram, '123', { capsules: 1, time1: '09:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(123), 1);
  assert.equal(fakeCron.jobs[0].stopped, true);
});

test('Memory service: two-times reminder creates exactly 2 jobs and overwrites cleanly', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const telegram = createFakeTelegram();

  await addReminder(telegram, 999, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(999), 2);

  await addReminder(telegram, '999', { capsules: 2, time1: '08:30', time2: '12:30', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(999), 2);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('Memory service: changing from 1 time to 2 times stops old job and creates 2 new', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const telegram = createFakeTelegram();

  await addReminder(telegram, 555, { capsules: 1, time1: '08:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(555), 1);

  await addReminder(telegram, 555, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(555), 2);
  assert.equal(fakeCron.jobs[0].stopped, true);
});

test('Memory service: changing from 2 times to 1 time stops both old jobs and creates 1 new', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const telegram = createFakeTelegram();

  await addReminder(telegram, 666, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(666), 2);

  await addReminder(telegram, 666, { capsules: 1, time1: '09:00', time2: null, timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(666), 1);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

test('Memory service: removeReminder stops all jobs', async () => {
  __debugReset();

  const fakeCron = createFakeCron();
  __setCronAdapter(fakeCron);

  const telegram = createFakeTelegram();

  await addReminder(telegram, 888, { capsules: 2, time1: '08:00', time2: '12:00', timezone: 'UTC+3' });
  assert.equal(__debugGetJobsCount(888), 2);

  const { removeReminder } = await import('../services/reminderServiceMemory.js');
  await removeReminder(888);
  assert.equal(__debugGetJobsCount(888), 0);
  assert.equal(fakeCron.jobs[0].stopped, true);
  assert.equal(fakeCron.jobs[1].stopped, true);
});

