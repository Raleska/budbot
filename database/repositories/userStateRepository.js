import { query } from '../connection.js';

export const userStateRepository = {
  async upsertState(userId, state, userData = {}) {
    const result = await query(
      `INSERT INTO user_states (user_id, state, user_data, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         state = EXCLUDED.state,
         user_data = EXCLUDED.user_data,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, state, JSON.stringify(userData)]
    );
    return result.rows[0];
  },

  async getState(userId) {
    const result = await query(
      'SELECT * FROM user_states WHERE user_id = $1',
      [userId]
    );
    if (result.rows[0]) {
      return {
        state: result.rows[0].state,
        userData: result.rows[0].user_data || {},
      };
    }
    return null;
  },

  async updateUserData(userId, userData) {
    const current = await this.getState(userId);
    const mergedData = current ? { ...current.userData, ...userData } : userData;
    const state = current ? current.state : 'START';
    
    return await this.upsertState(userId, state, mergedData);
  },

  async deleteState(userId) {
    const result = await query(
      'DELETE FROM user_states WHERE user_id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0] || null;
  },
};
