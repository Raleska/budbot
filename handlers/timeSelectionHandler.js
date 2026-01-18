import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackTimeSelection, trackInteraction, getReminder } from '../services/index.js';
import { normalizeTime } from '../utils/validators.js';

export const timeSelectionHandler = async (ctx, time) => {
  const userId = ctx.from.id;
  const state = await userStateService.getState(userId);
  const keyboard = keyboards.confirmation();
  
  // Собираем аналитику
  await trackInteraction(userId, ctx.from);
  await trackTimeSelection(userId, time);
  
  // Проверяем, редактируем ли мы существующее напоминание
  const existingReminder = await getReminder(userId);
  const userData = await userStateService.getUserData(userId);
  const isEditing = existingReminder !== null && userData.editingTimeKey;

  // Нормализуем время (добавляем ведущий ноль)
  const normalizedTime = normalizeTime(time);

  if (state === USER_STATES.SELECT_TIME_SINGLE) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    
    // Если редактируем, сохраняем остальные данные и editingTimeKey
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        capsules: existingReminder.capsules,
        timezone: existingReminder.timezone,
        time2: existingReminder.time2,
        editingTimeKey: userData.editingTimeKey || 'time1', // Сохраняем для возврата
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SINGLE);
    
    await ctx.editMessageText(
      TEXTS.CONFIRM_TIME_SINGLE(normalizedTime),
      keyboard
    );
  } else if (state === USER_STATES.SELECT_TIME_FIRST) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    
    // Если редактируем, сохраняем editingTimeKey
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        editingTimeKey: userData.editingTimeKey || 'time1', // Сохраняем для возврата
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_FIRST);
    
    await ctx.editMessageText(
      TEXTS.CONFIRM_TIME_FIRST(normalizedTime),
      keyboard
    );
  } else if (state === USER_STATES.SELECT_TIME_SECOND) {
    await userStateService.updateUserData(userId, { time2: normalizedTime });
    
    // Если редактируем, сохраняем остальные данные и editingTimeKey
    if (isEditing && existingReminder) {
      await userStateService.updateUserData(userId, {
        capsules: existingReminder.capsules,
        timezone: existingReminder.timezone,
        time1: existingReminder.time1,
        editingTimeKey: userData.editingTimeKey || 'time2', // Сохраняем для возврата
      });
    }
    
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SECOND);
    
    await ctx.editMessageText(
      TEXTS.CONFIRM_TIME_SECOND(normalizedTime),
      keyboard
    );
  }
};
