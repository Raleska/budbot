// Сервис для управления напоминаниями и отправки уведомлений

import cron from 'node-cron';
import { TEXTS } from '../config/texts.js';
import { reminderRepository } from '../database/repositories/reminderRepository.js';
import { userRepository } from '../database/repositories/userRepository.js';

// Хранилище cron jobs (остается в памяти, так как это runtime объекты)
const cronJobs = new Map(); // userId -> cron job instances

// Конвертация часового пояса в смещение UTC
function getTimezoneOffset(timezone) {
  if (!timezone) return 0;
  
  // Пример: "UTC+3" -> 3, "UTC+5.5" -> 5.5
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
    return '12:00'; // Значение по умолчанию
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
    return '12:00'; // Значение по умолчанию
  }
  
  const offset = getTimezoneOffset(timezone);
  
  // Вычитаем смещение, чтобы получить UTC время
  // offset может быть дробным (например, 5.5 для UTC+5:30)
  let utcHours = hours - offset;
  let utcMinutes = minutes;
  
  // Если offset дробный, обрабатываем минуты
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
  
  // Обработка перехода через границы суток
  if (utcHours < 0) {
    utcHours += 24;
  } else if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  return `${Math.floor(utcHours).toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;
}

// Создание cron выражения для времени
function createCronExpression(time) {
  // time в формате "HH:MM" в UTC
  if (!time || typeof time !== 'string') {
    console.error('Ошибка: время не указано для cron выражения:', time);
    return '0 12 * * *'; // По умолчанию 12:00
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    console.error('Ошибка: неверный формат времени для cron:', time);
    return '0 12 * * *'; // По умолчанию 12:00
  }
  
  // node-cron формат: "минуты часы * * *"
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
  
  // Сохраняем данные напоминания в БД
  await reminderRepository.upsertReminder(userId, reminderData);
  
  // Создаем cron jobs для каждого времени
  const jobs = [];
  
  // Первое время (всегда есть)
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
  
  // Второе время (если есть)
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
  await reminderRepository.deleteReminder(userId);
  console.log(`🗑️ Напоминание удалено для пользователя ${userId}`);
}

// Получение напоминания пользователя
export async function getReminder(userId) {
  return await reminderRepository.getReminderByUserId(userId);
}

// Проверка наличия напоминания
export async function hasReminder(userId) {
  return await reminderRepository.hasActiveReminder(userId);
}

// Получение всех напоминаний (для отладки)
export async function getAllReminders() {
  return await reminderRepository.getAllActiveReminders();
}

// Загрузка всех напоминаний при старте (для восстановления cron jobs)
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
