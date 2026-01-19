import { analyticsRepository } from '../database/repositories/analyticsRepository.js';
import { userRepository } from '../database/repositories/userRepository.js';

export async function trackInteraction(userId, telegramData = {}) {
  await userRepository.upsertUser(userId, {
    username: telegramData.username,
    firstName: telegramData.first_name,
    lastName: telegramData.last_name,
  });

  await analyticsRepository.initUserAnalytics(userId, telegramData);
  await analyticsRepository.updateLastInteraction(userId);
  
  const today = new Date().toISOString().split('T')[0];
  await analyticsRepository.updateActiveDay(userId, today);
}

export async function trackReminderSetup(userId, reminderData) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackReminderSetup(userId, reminderData);
}

export async function trackReminderChange(userId) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackReminderChange(userId);
}

export async function trackTimezoneSelection(userId, timezone) {
  await analyticsRepository.initUserAnalytics(userId, {});
  await analyticsRepository.trackTimezoneSelection(userId, timezone);
}

export async function trackTimeSelection(userId, time) {
}

export async function getUserData(userId) {
  const analytics = await analyticsRepository.getUserAnalytics(userId);
  const user = await userRepository.getUserById(userId);
  
  if (!analytics && !user) return null;
  
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

export async function getAllUserData() {
  return await analyticsRepository.getAllUserData();
}

export async function getStatistics() {
  return await analyticsRepository.getStatistics();
}

export async function exportData() {
  const data = await getAllUserData();
  return JSON.stringify(data, null, 2);
}
