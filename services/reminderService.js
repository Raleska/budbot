import cron from 'node-cron';
import { TEXTS } from '../config/texts.js';
import { reminderRepository } from '../database/repositories/reminderRepository.js';
import { userRepository } from '../database/repositories/userRepository.js';

const cronJobs = new Map();

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

async function sendReminder(bot, userId, reminder) {
  try {
    const message = TEXTS.REMINDER_MESSAGE(reminder.capsules);
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
    console.log(`📨 Напоминание отправлено пользователю ${userId} в ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке напоминания пользователю ${userId}:`, error);
    if (error.response?.error_code === 403) {
      console.log(`   Пользователь ${userId} заблокировал бота, удаляем напоминание`);
      await removeReminder(userId);
    }
  }
}

export async function addReminder(bot, userId, reminderData) {
  const existingJobs = cronJobs.get(userId);
  if (existingJobs) {
    existingJobs.forEach(job => job.stop());
    cronJobs.delete(userId);
  }
  
  await reminderRepository.upsertReminder(userId, reminderData);
  
  const jobs = [];
  
  const utcTime1 = convertToUTC(reminderData.time1, reminderData.timezone);
  const cronExpr1 = createCronExpression(utcTime1);
  
  const job1 = cron.schedule(cronExpr1, async () => {
    const reminder = await reminderRepository.getReminderByUserId(userId);
    if (reminder && reminder.enabled) {
      await sendReminder(bot, userId, reminder);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
  
  jobs.push(job1);
  
  if (reminderData.time2) {
    const utcTime2 = convertToUTC(reminderData.time2, reminderData.timezone);
    const cronExpr2 = createCronExpression(utcTime2);
    
    const job2 = cron.schedule(cronExpr2, async () => {
      const reminder = await reminderRepository.getReminderByUserId(userId);
      if (reminder && reminder.enabled) {
        await sendReminder(bot, userId, reminder);
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });
    
    jobs.push(job2);
  }
  
  cronJobs.set(userId, jobs);
  
  const utcTime2 = reminderData.time2 ? convertToUTC(reminderData.time2, reminderData.timezone) : null;
  
  console.log(`✅ Напоминание добавлено для пользователя ${userId}:`);
  console.log(`   Локальное время: ${reminderData.time1}${reminderData.time2 ? ` / ${reminderData.time2}` : ''}`);
  console.log(`   Часовой пояс: ${reminderData.timezone}`);
  console.log(`   UTC время: ${utcTime1}${utcTime2 ? ` / ${utcTime2}` : ''}`);
  console.log(`   Cron выражения: ${cronExpr1}${reminderData.time2 ? ` и ${cronExpr2}` : ''}`);
}

export async function removeReminder(userId) {
  const jobs = cronJobs.get(userId);
  if (jobs) {
    jobs.forEach(job => job.stop());
    cronJobs.delete(userId);
  }
  await reminderRepository.deleteReminder(userId);
  console.log(`🗑️ Напоминание удалено для пользователя ${userId}`);
}

export async function getReminder(userId) {
  return await reminderRepository.getReminderByUserId(userId);
}

export async function hasReminder(userId) {
  return await reminderRepository.hasActiveReminder(userId);
}

export async function getAllReminders() {
  return await reminderRepository.getAllActiveReminders();
}

export async function loadAllReminders(bot) {
  const reminders = await reminderRepository.getAllActiveReminders();
  for (const reminder of reminders) {
    const reminderData = {
      capsules: reminder.capsules,
      time1: reminder.time1,
      time2: reminder.time2,
      timezone: reminder.timezone,
    };
    await addReminder(bot, reminder.user_id, reminderData);
  }
  console.log(`📋 Загружено ${reminders.length} активных напоминаний из БД`);
}
