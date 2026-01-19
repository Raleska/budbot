import { USER_STATES } from '../config/states.js';

const userStates = new Map();
const userData = new Map();

export const userStateServiceMemory = {
  async getState(userId) {
    return userStates.get(userId) || USER_STATES.START;
  },

  async setState(userId, state) {
    userStates.set(userId, state);
  },

  async getUserData(userId) {
    return userData.get(userId) || {};
  },

  async updateUserData(userId, data) {
    const current = userData.get(userId) || {};
    userData.set(userId, { ...current, ...data });
  },

  async reset(userId) {
    userStates.delete(userId);
    userData.delete(userId);
  },

  async getAllUserData(userId) {
    return {
      state: userStates.get(userId) || USER_STATES.START,
      data: userData.get(userId) || {},
    };
  },
};
