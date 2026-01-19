import { USER_STATES } from '../config/states.js';
import { userStateRepository } from '../database/repositories/userStateRepository.js';

export const userStateService = {
  async getState(userId) {
    const stateData = await userStateRepository.getState(userId);
    return stateData ? stateData.state : USER_STATES.START;
  },

  async setState(userId, state) {
    const current = await userStateRepository.getState(userId);
    const userData = current ? current.userData : {};
    await userStateRepository.upsertState(userId, state, userData);
  },

  async getUserData(userId) {
    const stateData = await userStateRepository.getState(userId);
    return stateData ? stateData.userData : {};
  },

  async updateUserData(userId, data) {
    await userStateRepository.updateUserData(userId, data);
  },

  async reset(userId) {
    await userStateRepository.deleteState(userId);
  },

  async getAllUserData(userId) {
    const stateData = await userStateRepository.getState(userId);
    return {
      state: stateData ? stateData.state : USER_STATES.START,
      data: stateData ? stateData.userData : {},
    };
  },
};
