import { TEXTS, BUTTONS, TIMEZONES } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackTimezoneSelection, trackInteraction, getReminder } from '../services/index.js';

export const timezoneHandler = async (ctx, timezoneValue) => {
  const userId = ctx.from.id;
  const userData = await userStateService.getUserData(userId);
  
  // Собираем аналитику
  await trackInteraction(userId, ctx.from);
  await trackTimezoneSelection(userId, timezoneValue);

  await userStateService.updateUserData(userId, { timezone: timezoneValue });
  
  const keyboard = keyboards.timeSelection();
  
  // Проверяем, редактируем ли мы существующее напоминание
  const existingReminder = await getReminder(userId);
  const isEditing = existingReminder !== null;
  
  // В зависимости от частоты приема переходим к разным шагам
  if (userData.capsules === 1) {
    // Если редактируем и переходим с двух раз на один раз в день, используем time1
    if (isEditing && existingReminder?.time1) {
      await userStateService.updateUserData(userId, {
        time1: existingReminder.time1,
        time2: null, // Для одного раза в день time2 всегда null
      });
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
    await ctx.editMessageText(
      TEXTS.SELECT_TIME_SINGLE,
      keyboard
    );
  } else if (userData.capsules === 2) {
    // Если редактируем и переходим с одного раза на два раза в день, используем существующее time1
    if (isEditing && existingReminder?.time1) {
      await userStateService.updateUserData(userId, {
        time1: existingReminder.time1,
        time2: existingReminder.time2 || existingReminder.time1, // Если time2 нет, используем time1
      });
    }
    
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_FIRST);
    await ctx.editMessageText(
      TEXTS.SELECT_TIME_FIRST,
      keyboard
    );
  }
};
