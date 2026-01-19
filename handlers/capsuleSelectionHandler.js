import { TEXTS, BUTTONS, TIMEZONES } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, getReminder } from '../services/index.js';

export const capsuleSelectionHandler = async (ctx, capsuleType) => {
  const userId = ctx.from.id;
  const keyboard = keyboards.timezoneSelection();
  
  const existingReminder = await getReminder(userId);
  const userData = await userStateService.getUserData(userId);
  const isEditing = existingReminder !== null;
  const editingTimeKey = userData.editingTimeKey || 'time1';

  if (capsuleType === 'one') {
    await userStateService.updateUserData(userId, { capsules: 1 });
    
    if (isEditing && existingReminder?.timezone) {
      await userStateService.updateUserData(userId, {
        timezone: existingReminder.timezone,
        time1: existingReminder.time1,
        time2: null,
        editingTimeKey: editingTimeKey,
      });
      
      await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
      await ctx.editMessageText(TEXTS.SELECT_TIME_SINGLE, keyboards.timeSelection());
      return;
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIMEZONE);
    await ctx.editMessageText(TEXTS.SELECT_TIMEZONE, keyboard);
  } else if (capsuleType === 'two') {
    await userStateService.updateUserData(userId, { capsules: 2 });
    
    if (isEditing && existingReminder?.timezone) {
      await userStateService.updateUserData(userId, {
        timezone: existingReminder.timezone,
        time1: existingReminder.time1,
        time2: existingReminder.time2 || existingReminder.time1,
        editingTimeKey: editingTimeKey,
      });
      
      await userStateService.setState(userId, USER_STATES.SELECT_TIME_FIRST);
      await ctx.editMessageText(TEXTS.SELECT_TIME_FIRST, keyboards.timeSelection());
      return;
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIMEZONE);
    await ctx.editMessageText(TEXTS.SELECT_TIMEZONE, keyboard);
  }
};
