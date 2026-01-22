import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, addReminder, getReminder, trackReminderSetup, trackReminderChange, trackInteraction } from '../services/index.js';
import { reminderDetailHandler } from './reminderDetailHandler.js';
import { normalizeTime } from '../utils/validators.js';

export const confirmationHandler = async (ctx) => {
  const userId = ctx.from.id;
  const state = await userStateService.getState(userId);
  const userData = await userStateService.getUserData(userId);
  
  await trackInteraction(userId, ctx.from);

  if (state === USER_STATES.CONFIRM_TIME_SINGLE) {
    await userStateService.setState(userId, USER_STATES.REMINDER_SET);
    
    if (!userData.time1 || !userData.timezone) {
      console.error('Ошибка: отсутствуют данные для напоминания', userData);
      await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните заново с /start');
      return;
    }
    
    const existingReminder = await getReminder(userId);
    const reminderData = {
      capsules: 1,
      time1: normalizeTime(userData.time1),
      time2: null,
      timezone: userData.timezone || (existingReminder?.timezone || 'UTC+3'),
    };
    
    await addReminder(ctx.telegram, userId, reminderData);
    
    const editingTimeKey = userData.editingTimeKey;
    
    if (editingTimeKey) {
      await trackReminderChange(userId);
    } else {
      await trackReminderSetup(userId, reminderData);
    }
    
    await userStateService.updateUserData(userId, { editingTimeKey: null, editingTime: null });
    
    if (editingTimeKey) {
      await reminderDetailHandler(ctx, editingTimeKey);
      return;
    }
    
    const inlineKeyboard = await keyboards.mainMenuAfterSetup(userId);
    
    await ctx.editMessageText(
      TEXTS.REMINDER_SET_SINGLE(
        reminderData.capsules,
        reminderData.time1,
        reminderData.timezone
      ),
      inlineKeyboard
    );
    
    const replyKeyboard = await keyboards.replyKeyboard(userId);
    await ctx.telegram.sendMessage(userId, 'Используйте меню внизу для быстрого доступа:', { reply_markup: replyKeyboard.reply_markup });
    
  } else if (state === USER_STATES.CONFIRM_TIME_FIRST) {
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_SECOND);
    
    await ctx.editMessageText(
      TEXTS.SELECT_TIME_SECOND,
      keyboards.timeSelection()
    );
    
  } else if (state === USER_STATES.CONFIRM_TIME_SECOND) {
    await userStateService.setState(userId, USER_STATES.REMINDER_SET);
    
    if (!userData.time1 || !userData.time2 || !userData.timezone) {
      console.error('Ошибка: отсутствуют данные для напоминания', userData);
      await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните заново с /start');
      return;
    }
    
    const existingReminder = await getReminder(userId);
    
    if (!userData.time1 || !userData.time2) {
      console.error('Ошибка: отсутствуют оба времени для напоминания', userData);
      await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните заново с /start');
      return;
    }
    
    const reminderData = {
      capsules: 2,
      time1: normalizeTime(userData.time1),
      time2: normalizeTime(userData.time2),
      timezone: userData.timezone || (existingReminder?.timezone || 'UTC+3'),
    };
    
    await addReminder(ctx.telegram, userId, reminderData);
    
    const editingTimeKey = userData.editingTimeKey;
    
    if (editingTimeKey) {
      await trackReminderChange(userId);
    } else {
      await trackReminderSetup(userId, reminderData);
    }
    
    await userStateService.updateUserData(userId, { editingTimeKey: null, editingTime: null });
    
    if (editingTimeKey) {
      await reminderDetailHandler(ctx, editingTimeKey === 'time2' ? 'time2' : 'time1');
      return;
    }
    
    const inlineKeyboard = await keyboards.mainMenuAfterSetup(userId);
    
    await ctx.editMessageText(
      TEXTS.REMINDER_SET_DOUBLE(
        reminderData.capsules,
        reminderData.time1,
        reminderData.time2,
        reminderData.timezone
      ),
      inlineKeyboard
    );
    
    const replyKeyboard = await keyboards.replyKeyboard(userId);
    await ctx.telegram.sendMessage(userId, 'Используйте меню внизу для быстрого доступа:', { reply_markup: replyKeyboard.reply_markup });
  }
};
