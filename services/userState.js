// Сервис для управления состояниями пользователей с использованием PostgreSQL

import { USER_STATES } from '../config/states.js';
import { userStateRepository } from '../database/repositories/userStateRepository.js';

export const userStateService = {
  // Получить состояние пользователя
  async getState(userId) {
    const stateData = await userStateRepository.getState(userId);
    return stateData ? stateData.state : USER_STATES.START;
  },

  // Установить состояние пользователя
  async setState(userId, state) {
    const current = await userStateRepository.getState(userId);
    const userData = current ? current.userData : {};
    await userStateRepository.upsertState(userId, state, userData);
  },

  // Получить данные пользователя
  async getUserData(userId) {
    const stateData = await userStateRepository.getState(userId);
    return stateData ? stateData.userData : {};
  },

  // Обновить данные пользователя
  async updateUserData(userId, data) {
    await userStateRepository.updateUserData(userId, data);
  },

  // Сбросить состояние и данные пользователя
  async reset(userId) {
    await userStateRepository.deleteState(userId);
  },

  // Получить все данные пользователя
  async getAllUserData(userId) {
    const stateData = await userStateRepository.getState(userId);
    return {
      state: stateData ? stateData.state : USER_STATES.START,
      data: stateData ? stateData.userData : {},
    };
  },
};
