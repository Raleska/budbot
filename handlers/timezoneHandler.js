import { TEXTS, BUTTONS, TIMEZONES } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackTimezoneSelection, trackInteraction, getReminder } from '../services/index.js';

export const timezoneHandler = async (ctx, timezoneValue) => {
  const userId = ctx.from.id;
  const userData = await userStateService.getUserData(userId);
  
  await trackInteraction(userId, ctx.from);
  await trackTimezoneSelection(userId, timezoneValue);

  await userStateService.updateUserData(userId, { timezone: timezoneValue });
  
  const keyboard = keyboards.timeSelection();
  const existingReminder = await getReminder(userId);
  const isEditing = existingReminder !== null;
  
  if (userData.capsules === 1) {
    if (isEditing && existingReminder?.time1) {
      await userStateService.updateUserData(userId, {
        time1: existingReminder.time1,
        time2: null,
      });
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
    await ctx.editMessageText(TEXTS.SELECT_TIME_SINGLE, keyboard);
  } else if (userData.capsules === 2) {
    if (isEditing && existingReminder?.time1) {
      await userStateService.updateUserData(userId, {
        time1: existingReminder.time1,
        time2: existingReminder.time2 || existingReminder.time1,
      });
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_FIRST);
    await ctx.editMessageText(TEXTS.SELECT_TIME_FIRST, keyboard);
  }
};
