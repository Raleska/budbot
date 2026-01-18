// In-memory сервис для сбора аналитики (без БД)

// In-memory хранилище
const userData = new Map(); // userId -> analytics data

// Обновление последнего взаимодействия
export async function trackInteraction(userId, telegramData = {}) {
  if (!userData.has(userId)) {
    userData.set(userId, {
      userId,
      username: telegramData.username || null,
      firstName: telegramData.first_name || null,
      lastName: telegramData.last_name || null,
      firstInteraction: new Date(),
      lastInteraction: new Date(),
      interactionCount: 0,
      reminderSetups: 0,
      reminderChanges: 0,
      timezone: null,
      preferredCapsules: null,
      preferredTimes: [],
      activeDays: new Set(),
      lastActiveDate: null,
    });
  }
  
  const data = userData.get(userId);
  data.lastInteraction = new Date();
  data.interactionCount = (data.interactionCount || 0) + 1;
  
  const today = new Date().toISOString().split('T')[0];
  if (!data.activeDays) {
    data.activeDays = new Set();
  }
  data.activeDays.add(today);
  data.lastActiveDate = today;
  
  // Обновляем данные пользователя, если они изменились
  if (telegramData.username) data.username = telegramData.username;
  if (telegramData.first_name) data.firstName = telegramData.first_name;
  if (telegramData.last_name) data.lastName = telegramData.last_name;
}

// Отслеживание настройки напоминания
export async function trackReminderSetup(userId, reminderData) {
  const data = userData.get(userId) || {};
  if (!userData.has(userId)) {
    await trackInteraction(userId, {});
  }
  
  const user = userData.get(userId);
  user.reminderSetups = (user.reminderSetups || 0) + 1;
  user.preferredCapsules = reminderData.capsules;
  user.timezone = reminderData.timezone;
  
  if (!user.preferredTimes) {
    user.preferredTimes = [];
  }
  if (reminderData.time1 && !user.preferredTimes.includes(reminderData.time1)) {
    user.preferredTimes.push(reminderData.time1);
  }
  if (reminderData.time2 && !user.preferredTimes.includes(reminderData.time2)) {
    user.preferredTimes.push(reminderData.time2);
  }
}

// Отслеживание изменения напоминания
export async function trackReminderChange(userId) {
  const data = userData.get(userId);
  if (data) {
    data.reminderChanges = (data.reminderChanges || 0) + 1;
  }
}

// Отслеживание выбора часового пояса
export async function trackTimezoneSelection(userId, timezone) {
  const data = userData.get(userId);
  if (data) {
    data.timezone = timezone;
  }
}

// Отслеживание выбора времени (оставляем для совместимости)
export async function trackTimeSelection(userId, time) {
  // Не реализовано в памяти
}

// Получение данных пользователя
export async function getUserData(userId) {
  const data = userData.get(userId);
  if (!data) return null;
  
  return {
    userId: data.userId,
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    firstInteraction: data.firstInteraction,
    lastInteraction: data.lastInteraction,
    interactionCount: data.interactionCount,
    reminderSetups: data.reminderSetups,
    reminderChanges: data.reminderChanges,
    timezone: data.timezone,
    preferredCapsules: data.preferredCapsules,
    preferredTimes: data.preferredTimes || [],
    activeDays: data.activeDays || new Set(),
    lastActiveDate: data.lastActiveDate,
  };
}

// Получение всех данных (для аналитики)
export async function getAllUserData() {
  return Array.from(userData.values());
}

// Получение статистики
export async function getStatistics() {
  const users = Array.from(userData.values());
  const totalUsers = users.length;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeUsers = users.filter(u => u.lastInteraction && new Date(u.lastInteraction) > sevenDaysAgo).length;
  
  const totalReminderSetups = users.reduce((sum, u) => sum + (u.reminderSetups || 0), 0);
  const avgInteractions = totalUsers > 0 
    ? users.reduce((sum, u) => sum + (u.interactionCount || 0), 0) / totalUsers 
    : 0;
  
  const timezoneDist = {};
  users.forEach(u => {
    if (u.timezone) {
      timezoneDist[u.timezone] = (timezoneDist[u.timezone] || 0) + 1;
    }
  });
  
  const capsulesDist = {};
  users.forEach(u => {
    if (u.preferredCapsules) {
      capsulesDist[u.preferredCapsules] = (capsulesDist[u.preferredCapsules] || 0) + 1;
    }
  });
  
  const timeCounts = {};
  users.forEach(u => {
    (u.preferredTimes || []).forEach(time => {
      timeCounts[time] = (timeCounts[time] || 0) + 1;
    });
  });
  
  const popularTimes = Object.entries(timeCounts)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalUsers,
    activeUsers,
    totalReminderSetups,
    averageInteractions: avgInteractions,
    timezoneDistribution: timezoneDist,
    capsulesDistribution: capsulesDist,
    popularTimes,
  };
}

// Экспорт данных в JSON
export async function exportData() {
  const data = await getAllUserData();
  // Преобразуем Set в массив для JSON
  const serialized = data.map(u => ({
    ...u,
    activeDays: u.activeDays ? Array.from(u.activeDays) : [],
  }));
  return JSON.stringify(serialized, null, 2);
}
