import cron from 'node-cron';
import { Markup } from 'telegraf';
import { TEXTS, BUTTONS } from '../config/texts.js';

const reminders = new Map();
const cronJobs = new Map();
const snoozeTimeouts = new Map();
const lastReminderMessage = new Map();
let botInstance = null;
let cronAdapter = cron;

export function setBotInstance(bot) {
  botInstance = bot;
}

// Test/diagnostic hooks (not used in production flow)
export function __setCronAdapter(adapter) {
  cronAdapter = adapter;
}

export function __debugGetJobsCount(userId) {
  const jobs = cronJobs.get(String(userId));
  return Array.isArray(jobs) ? jobs.length : 0;
}

export function __debugReset() {
  lastReminderMessage.clear();
  for (const id of snoozeTimeouts.values()) clearTimeout(id);
  snoozeTimeouts.clear();
  for (const jobs of cronJobs.values()) {
    if (Array.isArray(jobs)) jobs.forEach((j) => j?.stop?.());
  }
  cronJobs.clear();
  reminders.clear();
  botInstance = null;
  cronAdapter = cron;
}

function getTimezoneOffset(timezone) {
  if (!timezone) return 0;
  const match = timezone.match(/UTC([+-])(\d+(?:\.\d+)?)/);
  if (!match) {
    console.error('Ошибка: неверный формат часового пояса:', timezone);
    return 0;
  }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseFloat(match[2]);
  return sign * hours;
}

function convertToUTC(time, timezone) {
  if (!time || typeof time !== 'string') {
    console.error('Ошибка: время не указано или имеет неверный формат:', time);
    return '12:00';
  }
  
  const timeParts = time.split(':');
  if (timeParts.length !== 2) {
    console.error('Ошибка: неверный формат времени:', time);
    return '12:00';
  }
  
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) {
    console.error('Ошибка: неверный формат времени:', time);
    return '12:00';
  }
  
  const offset = getTimezoneOffset(timezone);
  let utcHours = hours - offset;
  let utcMinutes = minutes;
  
  if (offset % 1 !== 0) {
    const offsetMinutes = Math.round((offset % 1) * 60);
    utcMinutes -= offsetMinutes;
    if (utcMinutes < 0) {
      utcMinutes += 60;
      utcHours -= 1;
    } else if (utcMinutes >= 60) {
      utcMinutes -= 60;
      utcHours += 1;
    }
  }
  
  if (utcHours < 0) {
    utcHours += 24;
  } else if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  return `${Math.floor(utcHours).toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;
}

function createCronExpression(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${minutes} ${hours} * * *`;
}

function reminderReplyMarkup() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(BUTTONS.REMINDER_BTN_TAKEN, 'action:reminder_taken'),
      Markup.button.callback(BUTTONS.REMINDER_BTN_SNOOZE, 'action:reminder_snooze30'),
    ],
  ]);
}

async function sendReminder(userId, reminder) {
  if (!botInstance) {
    console.error(`❌ Bot instance не установлен, невозможно отправить напоминание пользователю ${userId}`);
    return;
  }

  const userKey = String(userId);
  const prev = lastReminderMessage.get(userKey);
  if (prev) {
    try {
      await botInstance.telegram.editMessageReplyMarkup(prev.chatId, prev.messageId, {
        reply_markup: { inline_keyboard: [] },
      });
    } catch (_) {}
    lastReminderMessage.delete(userKey);
  }

  try {
    const message = TEXTS.REMINDER_MESSAGE(reminder.capsules);
    const sent = await botInstance.telegram.sendMessage(userId, message, {
      parse_mode: 'HTML',
      reply_markup: reminderReplyMarkup().reply_markup,
    });
    lastReminderMessage.set(userKey, { chatId: sent.chat.id, messageId: sent.message_id });
    console.log(`📨 Напоминание отправлено пользователю ${userId} в ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке напоминания пользователю ${userId}:`, error);
    if (error.response?.error_code === 403) {
      console.log(`   Пользователь ${userId} заблокировал бота, удаляем напоминание`);
      await removeReminder(userId);
    }
  }
}

const SNOOZE_MS = 30 * 60 * 1000;

export function scheduleSnooze(userId) {
  const userKey = String(userId);
  const existing = snoozeTimeouts.get(userKey);
  if (existing) clearTimeout(existing);
  const timeoutId = setTimeout(async () => {
    snoozeTimeouts.delete(userKey);
    const reminder = reminders.get(userKey);
    if (reminder) await sendReminder(userId, reminder);
  }, SNOOZE_MS);
  snoozeTimeouts.set(userKey, timeoutId);
}

export async function addReminder(botOrTelegram, userId, reminderData) {
  const userKey = String(userId);
  if (botOrTelegram && botOrTelegram.telegram) {
    setBotInstance(botOrTelegram);
  } else if (botOrTelegram) {
    setBotInstance({ telegram: botOrTelegram });
  }
  
  const existingJobs = cronJobs.get(userKey);
  if (existingJobs) {
    existingJobs.forEach(job => job.stop());
    cronJobs.delete(userKey);
  }
  
  reminders.set(userKey, reminderData);
  
  const jobs = [];
  const utcTime1 = convertToUTC(reminderData.time1, reminderData.timezone);
  const cronExpr1 = createCronExpression(utcTime1);
  
  const job1 = cronAdapter.schedule(cronExpr1, async () => {
    const now = new Date();
    console.log(`⏰ Cron job сработал для пользователя ${userKey} в ${now.toISOString()} (UTC)`);
    const reminder = reminders.get(userKey);
    if (reminder) {
      await sendReminder(userId, reminder);
    } else {
      console.log(`⚠️ Напоминание для пользователя ${userKey} не найдено`);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
  
  jobs.push(job1);
  
  let cronExpr2 = null;
  if (reminderData.time2) {
    const utcTime2 = convertToUTC(reminderData.time2, reminderData.timezone);
    cronExpr2 = createCronExpression(utcTime2);
    
    const job2 = cronAdapter.schedule(cronExpr2, async () => {
      const now = new Date();
      console.log(`⏰ Cron job сработал для пользователя ${userKey} (time2) в ${now.toISOString()} (UTC)`);
      const reminder = reminders.get(userKey);
      if (reminder) {
        await sendReminder(userId, reminder);
      } else {
        console.log(`⚠️ Напоминание для пользователя ${userKey} не найдено`);
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });
    
    jobs.push(job2);
  }
  
  cronJobs.set(userKey, jobs);
  
  const utcTime2 = reminderData.time2 ? convertToUTC(reminderData.time2, reminderData.timezone) : null;
  
  console.log(`✅ Напоминание добавлено для пользователя ${userKey}:`);
  console.log(`   Локальное время: ${reminderData.time1}${reminderData.time2 ? ` / ${reminderData.time2}` : ''}`);
  console.log(`   Часовой пояс: ${reminderData.timezone}`);
  console.log(`   UTC время: ${utcTime1}${utcTime2 ? ` / ${utcTime2}` : ''}`);
  console.log(`   Cron выражения: ${cronExpr1}${cronExpr2 ? ` и ${cronExpr2}` : ''}`);
}

export async function removeReminder(userId) {
  const userKey = String(userId);
  lastReminderMessage.delete(userKey);
  const snoozeId = snoozeTimeouts.get(userKey);
  if (snoozeId) {
    clearTimeout(snoozeId);
    snoozeTimeouts.delete(userKey);
  }
  const jobs = cronJobs.get(userKey);
  if (jobs) {
    jobs.forEach(job => job.stop());
    cronJobs.delete(userKey);
  }
  reminders.delete(userKey);
  console.log(`🗑️ Напоминание удалено для пользователя ${userKey}`);
}

export async function getReminder(userId) {
  return reminders.get(String(userId)) || null;
}

export async function hasReminder(userId) {
  return reminders.has(String(userId));
}

export async function getAllReminders() {
  return Array.from(reminders.entries()).map(([userId, data]) => ({
    user_id: userId,
    ...data,
  }));
}

export async function loadAllReminders(bot) {
  setBotInstance(bot);
  console.log('ℹ️ Режим без БД: напоминания хранятся только в памяти');
}
