import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackTimeSelection, trackInteraction, getReminder } from '../services/index.js';
import { normalizeTime } from '../utils/validators.js';

export const timeSelectionHandler = async (ctx, time) => {
  const userId = ctx.from.id;
  const state = await userStateService.getState(userId);
  const keyboard = keyboards.confirmation();
  
  await trackInteraction(userId, ctx.from);
  await trackTimeSelection(userId, time);
  
  const existingReminder = await getReminder(userId);
  const userData = await userStateService.getUserData(userId);
  const isEditing = existingReminder !== null && userData.editingTimeKey;
  const normalizedTime = normalizeTime(time);

  if (state === USER_STATES.SELECT_TIME_SINGLE) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        capsules: existingReminder.capsules,
        timezone: existingReminder.timezone,
        time2: existingReminder.time2,
        editingTimeKey: userData.editingTimeKey || 'time1',
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SINGLE);
    await ctx.editMessageText(TEXTS.CONFIRM_TIME_SINGLE(normalizedTime), keyboard);
  } else if (state === USER_STATES.SELECT_TIME_FIRST) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        editingTimeKey: userData.editingTimeKey || 'time1',
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_FIRST);
    await ctx.editMessageText(TEXTS.CONFIRM_TIME_FIRST(normalizedTime), keyboard);
  } else if (state === USER_STATES.SELECT_TIME_SECOND) {
    const currentUserData = await userStateService.getUserData(userId);
    await userStateService.updateUserData(userId, { 
      time2: normalizedTime,
      time1: currentUserData.time1 || (existingReminder?.time1 || '12:00'),
    });
    
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        capsules: existingReminder.capsules,
        timezone: existingReminder.timezone,
        time1: currentUserData.time1 || existingReminder.time1,
        editingTimeKey: userData.editingTimeKey || 'time2',
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SECOND);
    await ctx.editMessageText(TEXTS.CONFIRM_TIME_SECOND(normalizedTime), keyboard);
  }
};
