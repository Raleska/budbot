import cron from 'node-cron';
import { TEXTS } from '../config/texts.js';
import { reminderRepository } from '../database/repositories/reminderRepository.js';
import { userRepository } from '../database/repositories/userRepository.js';

const cronJobs = new Map();
let botInstance = null;
let cronAdapter = cron;
let reminderRepo = reminderRepository;

export function setBotInstance(bot) {
  botInstance = bot;
}

// Test/diagnostic hooks (not used in production flow)
export function __setCronAdapter(adapter) {
  cronAdapter = adapter;
}

export function __setReminderRepository(repo) {
  reminderRepo = repo;
}

export function __debugGetJobsCount(userId) {
  const jobs = cronJobs.get(String(userId));
  return Array.isArray(jobs) ? jobs.length : 0;
}

export function __debugReset() {
  for (const jobs of cronJobs.values()) {
    if (Array.isArray(jobs)) jobs.forEach((j) => j?.stop?.());
  }
  cronJobs.clear();
  botInstance = null;
  cronAdapter = cron;
  reminderRepo = reminderRepository;
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
  if (!time || typeof time !== 'string') {
    console.error('Ошибка: время не указано для cron выражения:', time);
    return '0 12 * * *';
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    console.error('Ошибка: неверный формат времени для cron:', time);
    return '0 12 * * *';
  }
  
  return `${minutes} ${hours} * * *`;
}

async function sendReminder(userId, reminder) {
  if (!botInstance) {
    console.error(`❌ Bot instance не установлен, невозможно отправить напоминание пользователю ${userId}`);
    return;
  }
  
  try {
    const message = TEXTS.REMINDER_MESSAGE(reminder.capsules);
    await botInstance.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
    console.log(`📨 Напоминание отправлено пользователю ${userId} в ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке напоминания пользователю ${userId}:`, error);
    if (error.response?.error_code === 403) {
      console.log(`   Пользователь ${userId} заблокировал бота, удаляем напоминание`);
      await removeReminder(userId);
    }
  }
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
  
  await reminderRepo.upsertReminder(userId, reminderData);
  
  const jobs = [];
  
  const utcTime1 = convertToUTC(reminderData.time1, reminderData.timezone);
  const cronExpr1 = createCronExpression(utcTime1);
  
  const job1 = cronAdapter.schedule(cronExpr1, async () => {
    const now = new Date();
    console.log(`⏰ Cron job сработал для пользователя ${userKey} в ${now.toISOString()} (UTC)`);
    const reminder = await reminderRepo.getReminderByUserId(userId);
    if (reminder && reminder.enabled) {
      await sendReminder(userId, reminder);
    } else {
      console.log(`⚠️ Напоминание для пользователя ${userKey} не найдено или отключено`);
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
      const reminder = await reminderRepo.getReminderByUserId(userId);
      if (reminder && reminder.enabled) {
        await sendReminder(userId, reminder);
      } else {
        console.log(`⚠️ Напоминание для пользователя ${userKey} не найдено или отключено`);
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
  const jobs = cronJobs.get(userKey);
  if (jobs) {
    jobs.forEach(job => job.stop());
    cronJobs.delete(userKey);
  }
  await reminderRepo.deleteReminder(userId);
  console.log(`🗑️ Напоминание удалено для пользователя ${userKey}`);
}

export async function getReminder(userId) {
  return await reminderRepo.getReminderByUserId(userId);
}

export async function hasReminder(userId) {
  return await reminderRepo.hasActiveReminder(userId);
}

export async function getAllReminders() {
  return await reminderRepo.getAllActiveReminders();
}

export async function loadAllReminders(bot) {
  setBotInstance(bot);
  const reminders = await reminderRepo.getAllActiveReminders();
  let loadedCount = 0;
  let errorCount = 0;
  
  for (const reminder of reminders) {
    try {
      const reminderData = {
        capsules: reminder.capsules,
        time1: reminder.time1,
        time2: reminder.time2 || null,
        timezone: reminder.timezone,
      };
      await addReminder(bot, reminder.user_id, reminderData);
      loadedCount++;
    } catch (error) {
      errorCount++;
      console.error(`❌ Ошибка при загрузке напоминания для пользователя ${reminder.user_id}:`, error.message);
    }
  }
  
  console.log(`📋 Загружено ${loadedCount} из ${reminders.length} активных напоминаний из БД`);
  if (errorCount > 0) {
    console.error(`⚠️  Не удалось загрузить ${errorCount} напоминаний`);
  }
}
