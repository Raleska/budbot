// Сервис для сбора аналитики о пользователях с использованием PostgreSQL

import { analyticsRepository } from '../database/repositories/analyticsRepository.js';
import { userRepository } from '../database/repositories/userRepository.js';

// Обновление последнего взаимодействия
export async function trackInteraction(userId, telegramData = {}) {
  // Создаем/обновляем пользователя
  await userRepository.upsertUser(userId, {
    username: telegramData.username,
    firstName: telegramData.first_name,
    lastName: telegramData.last_name,
  });

  // Инициализируем аналитику, если нужно
  await analyticsRepository.initUserAnalytics(userId, telegramData);
  
  // Обновляем последнее взаимодействие
  await analyticsRepository.updateLastInteraction(userId);
  
  // Обновляем активный день
  const today = new Date().toISOString().split('T')[0];
  await analyticsRepository.updateActiveDay(userId, today);
}

// Отслеживание настройки напоминания
export async function trackReminderSetup(userId, reminderData) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackReminderSetup(userId, reminderData);
}

// Отслеживание изменения напоминания
export async function trackReminderChange(userId) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackReminderChange(userId);
}

// Отслеживание выбора часового пояса
export async function trackTimezoneSelection(userId, timezone) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackTimezoneSelection(userId, timezone);
}

// Отслеживание выбора времени (оставляем для совместимости, но не используем в БД)
export async function trackTimeSelection(userId, time) {
  // Эта функция может быть использована для дополнительной аналитики
  // Пока не реализована в БД, так как preferred_times обновляется при настройке напоминания
}

// Получение данных пользователя
export async function getUserData(userId) {
  const analytics = await analyticsRepository.getUserAnalytics(userId);
  const user = await userRepository.getUserById(userId);
  
  // Если нет ни аналитики, ни пользователя, возвращаем null
  if (!analytics && !user) return null;
  
  // Преобразуем данные из БД в формат, совместимый со старым API
  return {
    userId: analytics?.user_id || user?.user_id,
    username: user?.username || null,
    firstName: user?.first_name || null,
    lastName: user?.last_name || null,
    firstInteraction: analytics?.first_interaction || null,
    lastInteraction: analytics?.last_interaction || null,
    interactionCount: analytics?.interaction_count || 0,
    reminderSetups: analytics?.reminder_setups || 0,
    reminderChanges: analytics?.reminder_changes || 0,
    timezone: analytics?.timezone || null,
    preferredCapsules: analytics?.preferred_capsules || null,
    preferredTimes: analytics?.preferred_times || [],
    activeDays: new Set(analytics?.active_days || []),
    lastActiveDate: analytics?.last_active_date || null,
  };
}

// Получение всех данных (для аналитики)
export async function getAllUserData() {
  return await analyticsRepository.getAllUserData();
}

// Получение статистики
export async function getStatistics() {
  return await analyticsRepository.getStatistics();
}

// Экспорт данных в JSON (для бэкапа или анализа)
export async function exportData() {
  const data = await getAllUserData();
  return JSON.stringify(data, null, 2);
}
