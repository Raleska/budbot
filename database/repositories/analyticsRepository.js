// Репозиторий для работы с аналитикой пользователей

import { query } from '../connection.js';

export const analyticsRepository = {
  // Инициализировать аналитику пользователя
  async initUserAnalytics(userId, telegramData) {
    const { username, firstName, lastName } = telegramData;
    
    // Сначала создаем пользователя
    await query(
      `INSERT INTO users (user_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, username || null, firstName || null, lastName || null]
    );

    // Затем создаем запись аналитики
    const result = await query(
      `INSERT INTO user_analytics (
        user_id, first_interaction, last_interaction, interaction_count,
        preferred_times, active_days
      )
      VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, ARRAY[]::TEXT[], ARRAY[]::TEXT[])
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *`,
      [userId]
    );
    
    return result.rows[0] || await this.getUserAnalytics(userId);
  },

  // Получить аналитику пользователя
  async getUserAnalytics(userId) {
    const result = await query(
      'SELECT * FROM user_analytics WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  // Обновить последнее взаимодействие
  async updateLastInteraction(userId) {
    await query(
      `UPDATE user_analytics 
       SET last_interaction = CURRENT_TIMESTAMP,
           interaction_count = interaction_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  },

  // Обновить настройки напоминания
  async trackReminderSetup(userId, reminderData) {
    const { capsules, time1, time2, timezone } = reminderData;
    const times = [time1, time2].filter(Boolean);
    
    await query(
      `UPDATE user_analytics 
       SET reminder_setups = reminder_setups + 1,
           timezone = $2,
           preferred_capsules = $3,
           preferred_times = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, timezone, capsules, times]
    );
  },

  // Отследить изменение напоминания
  async trackReminderChange(userId) {
    await query(
      `UPDATE user_analytics 
       SET reminder_changes = reminder_changes + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  },

  // Обновить активный день
  async updateActiveDay(userId, date) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    await query(
      `UPDATE user_analytics 
       SET active_days = array_append(
         COALESCE(active_days, ARRAY[]::TEXT[]), 
         $2
       ),
       last_active_date = $2,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 
       AND NOT ($2 = ANY(COALESCE(active_days, ARRAY[]::TEXT[])))`,
      [userId, dateStr]
    );
  },

  // Отследить выбор часового пояса
  async trackTimezoneSelection(userId, timezone) {
    await query(
      `UPDATE user_analytics 
       SET timezone = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, timezone]
    );
  },

  // Получить статистику
  async getStatistics() {
    const totalUsers = await query('SELECT COUNT(*) as count FROM users');
    const activeUsers = await query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM user_analytics 
       WHERE last_interaction > NOW() - INTERVAL '7 days'`
    );
    const totalReminders = await query(
      'SELECT COUNT(*) as count FROM reminders WHERE enabled = TRUE'
    );
    const avgInteractions = await query(
      'SELECT AVG(interaction_count) as avg FROM user_analytics'
    );
    const timezoneDist = await query(
      `SELECT timezone, COUNT(*) as count 
       FROM user_analytics 
       WHERE timezone IS NOT NULL 
       GROUP BY timezone`
    );
    const capsulesDist = await query(
      `SELECT preferred_capsules, COUNT(*) as count 
       FROM user_analytics 
       WHERE preferred_capsules IS NOT NULL 
       GROUP BY preferred_capsules`
    );
    const popularTimes = await query(
      `SELECT unnest(preferred_times) as time, COUNT(*) as count 
       FROM user_analytics 
       WHERE preferred_times IS NOT NULL 
       GROUP BY time 
       ORDER BY count DESC 
       LIMIT 10`
    );

    return {
      totalUsers: parseInt(totalUsers.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      totalReminderSetups: parseInt(totalReminders.rows[0].count),
      averageInteractions: parseFloat(avgInteractions.rows[0].avg || 0),
      timezoneDistribution: timezoneDist.rows.reduce((acc, row) => {
        acc[row.timezone] = parseInt(row.count);
        return acc;
      }, {}),
      capsulesDistribution: capsulesDist.rows.reduce((acc, row) => {
        acc[row.preferred_capsules] = parseInt(row.count);
        return acc;
      }, {}),
      popularTimes: popularTimes.rows.map(row => ({
        time: row.time,
        count: parseInt(row.count),
      })),
    };
  },

  // Получить все данные пользователя для экспорта
  async getAllUserData() {
    const result = await query(
      `SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.created_at,
        a.first_interaction,
        a.last_interaction,
        a.interaction_count,
        a.reminder_setups,
        a.reminder_changes,
        a.timezone,
        a.preferred_capsules,
        a.preferred_times,
        a.active_days,
        a.last_active_date
       FROM users u
       LEFT JOIN user_analytics a ON u.user_id = a.user_id
       ORDER BY u.created_at DESC`
    );
    return result.rows;
  },
};
