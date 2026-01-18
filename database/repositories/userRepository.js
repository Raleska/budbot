// Репозиторий для работы с пользователями

import { query } from '../connection.js';

export const userRepository = {
  // Создать или обновить пользователя
  async upsertUser(userId, userData) {
    const { username, firstName, lastName } = userData;
    const result = await query(
      `INSERT INTO users (user_id, username, first_name, last_name, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, username || null, firstName || null, lastName || null]
    );
    return result.rows[0];
  },

  // Получить пользователя по ID
  async getUserById(userId) {
    const result = await query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },
};
