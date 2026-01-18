// In-memory сервис для управления состояниями пользователей (без БД)

import { USER_STATES } from '../config/states.js';

// In-memory хранилище
const userStates = new Map(); // userId -> state
const userData = new Map(); // userId -> data object

export const userStateServiceMemory = {
  // Получить состояние пользователя
  async getState(userId) {
    return userStates.get(userId) || USER_STATES.START;
  },

  // Установить состояние пользователя
  async setState(userId, state) {
    userStates.set(userId, state);
  },

  // Получить данные пользователя
  async getUserData(userId) {
    return userData.get(userId) || {};
  },

  // Обновить данные пользователя
  async updateUserData(userId, data) {
    const current = userData.get(userId) || {};
    userData.set(userId, { ...current, ...data });
  },

  // Сбросить состояние и данные пользователя
  async reset(userId) {
    userStates.delete(userId);
    userData.delete(userId);
  },

  // Получить все данные пользователя
  async getAllUserData(userId) {
    return {
      state: userStates.get(userId) || USER_STATES.START,
      data: userData.get(userId) || {},
    };
  },
};
