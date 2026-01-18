// Репозиторий для работы с напоминаниями

import { query } from '../connection.js';

export const reminderRepository = {
  // Создать или обновить напоминание
  async upsertReminder(userId, reminderData) {
    const { capsules, time1, time2, timezone, enabled = true } = reminderData;
    const result = await query(
      `INSERT INTO reminders (user_id, capsules, time1, time2, timezone, enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         capsules = EXCLUDED.capsules,
         time1 = EXCLUDED.time1,
         time2 = EXCLUDED.time2,
         timezone = EXCLUDED.timezone,
         enabled = EXCLUDED.enabled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, capsules, time1, time2 || null, timezone, enabled]
    );
    return result.rows[0];
  },

  // Получить напоминание пользователя
  async getReminderByUserId(userId) {
    const result = await query(
      'SELECT * FROM reminders WHERE user_id = $1 AND enabled = TRUE',
      [userId]
    );
    return result.rows[0] || null;
  },

  // Удалить напоминание (установить enabled = false)
  async deleteReminder(userId) {
    const result = await query(
      'UPDATE reminders SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0] || null;
  },

  // Получить все активные напоминания
  async getAllActiveReminders() {
    const result = await query(
      'SELECT * FROM reminders WHERE enabled = TRUE'
    );
    return result.rows;
  },

  // Проверить наличие активного напоминания
  async hasActiveReminder(userId) {
    const result = await query(
      'SELECT EXISTS(SELECT 1 FROM reminders WHERE user_id = $1 AND enabled = TRUE)',
      [userId]
    );
    return result.rows[0].exists;
  },
};
