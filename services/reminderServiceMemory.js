// In-memory сервис для управления напоминаниями (без БД)

import cron from 'node-cron';
import { TEXTS } from '../config/texts.js';

// In-memory хранилище
const reminders = new Map(); // userId -> reminderData
const cronJobs = new Map(); // userId -> cron job instances

// Конвертация часового пояса в смещение UTC
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

// Конвертация времени из часового пояса пользователя в UTC
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
  
  // Обработка перехода через полночь
  if (utcHours < 0) {
    utcHours += 24;
  } else if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
}

// Создание cron выражения из времени
function createCronExpression(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${minutes} ${hours} * * *`;
}

// Отправка напоминания пользователю
async function sendReminder(bot, userId, reminder) {
  try {
    const message = TEXTS.REMINDER_MESSAGE(reminder.capsules);
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`Ошибка при отправке напоминания пользователю ${userId}:`, error);
    // Если пользователь заблокировал бота, удаляем напоминание
    if (error.response?.error_code === 403) {
      await removeReminder(userId);
    }
  }
}

// Добавление напоминания
export async function addReminder(bot, userId, reminderData) {
  // Удаляем старое напоминание, если есть
  await removeReminder(userId);
  
  // Сохраняем напоминание
  reminders.set(userId, reminderData);
  
  // Останавливаем старые cron jobs
  const oldJobs = cronJobs.get(userId);
  if (oldJobs) {
    oldJobs.forEach(job => job.stop());
  }
  
  const jobs = [];
  
  // Первое время
  const utcTime1 = convertToUTC(reminderData.time1, reminderData.timezone);
  const cronExpr1 = createCronExpression(utcTime1);
  
  const job1 = cron.schedule(cronExpr1, async () => {
    const reminder = reminders.get(userId);
    if (reminder) {
      await sendReminder(bot, userId, reminder);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
  
  jobs.push(job1);
  
  // Второе время (если есть)
  if (reminderData.time2) {
    const utcTime2 = convertToUTC(reminderData.time2, reminderData.timezone);
    const cronExpr2 = createCronExpression(utcTime2);
    
    const job2 = cron.schedule(cronExpr2, async () => {
      const reminder = reminders.get(userId);
      if (reminder) {
        await sendReminder(bot, userId, reminder);
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });
    
    jobs.push(job2);
  }
  
  cronJobs.set(userId, jobs);
  
  console.log(`✅ Напоминание добавлено для пользователя ${userId}:`, {
    time1: reminderData.time1,
    time2: reminderData.time2,
    timezone: reminderData.timezone,
    utcTime1,
    utcTime2: reminderData.time2 ? convertToUTC(reminderData.time2, reminderData.timezone) : null,
  });
}

// Удаление напоминания
export async function removeReminder(userId) {
  const jobs = cronJobs.get(userId);
  if (jobs) {
    jobs.forEach(job => job.stop());
    cronJobs.delete(userId);
  }
  reminders.delete(userId);
  console.log(`🗑️ Напоминание удалено для пользователя ${userId}`);
}

// Получение напоминания
export async function getReminder(userId) {
  return reminders.get(userId) || null;
}

// Проверка наличия напоминания
export async function hasReminder(userId) {
  return reminders.has(userId);
}

// Получение всех напоминаний
export async function getAllReminders() {
  return Array.from(reminders.entries()).map(([userId, data]) => ({
    user_id: userId,
    ...data,
  }));
}

// Загрузка всех напоминаний (для режима без БД не требуется)
export async function loadAllReminders(bot) {
  // В режиме без БД напоминания хранятся только в памяти
  // При перезапуске они теряются
  console.log('ℹ️ Режим без БД: напоминания хранятся только в памяти');
}
