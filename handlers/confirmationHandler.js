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
  
  // Собираем аналитику
  await trackInteraction(userId, ctx.from);

  if (state === USER_STATES.CONFIRM_TIME_SINGLE) {
    // Финальное сообщение для одного раза в день
    await userStateService.setState(userId, USER_STATES.REMINDER_SET);
    
    // Проверяем наличие всех необходимых данных
    if (!userData.time1 || !userData.timezone) {
      console.error('Ошибка: отсутствуют данные для напоминания', userData);
      await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните заново с /start');
      return;
    }
    
    // Если редактируем время, сохраняем остальные данные из существующего напоминания
    const existingReminder = await getReminder(userId);
    const reminderData = {
      capsules: userData.capsules || (existingReminder?.capsules || 1),
      time1: normalizeTime(userData.time1), // Нормализуем время
      time2: null, // При редактировании time1 для одного раза в день, time2 всегда null
      timezone: userData.timezone || (existingReminder?.timezone || 'UTC+3'),
    };
    
    // Сохраняем и настраиваем напоминание ПЕРЕД созданием клавиатуры
    await addReminder(ctx.telegram, userId, reminderData);
    
    // Проверяем, редактируем ли мы существующее напоминание
    const editingTimeKey = userData.editingTimeKey;
    
    // Отслеживаем настройку или изменение напоминания
    if (editingTimeKey) {
      await trackReminderChange(userId);
    } else {
      await trackReminderSetup(userId, reminderData);
    }
    
    // Очищаем данные редактирования
    await userStateService.updateUserData(userId, { editingTimeKey: null, editingTime: null });
    
    // Если редактировали напоминание, возвращаемся к деталям напоминания
    if (editingTimeKey) {
      await reminderDetailHandler(ctx, editingTimeKey);
      return;
    }
    
    // Иначе показываем главное меню (новое напоминание)
    await ctx.editMessageText(
      TEXTS.REMINDER_SET_SINGLE(
        reminderData.capsules,
        reminderData.time1,
        reminderData.timezone
      ),
      await keyboards.mainMenuAfterSetup(userId)
    );
    
  } else if (state === USER_STATES.CONFIRM_TIME_FIRST) {
    // После подтверждения первого времени для двух раз в день, переходим к выбору второго
    await userStateService.setState(userId, USER_STATES.SELECT_TIME_SECOND);
    
    await ctx.editMessageText(
      TEXTS.SELECT_TIME_SECOND,
      keyboards.timeSelection()
    );
    
  } else if (state === USER_STATES.CONFIRM_TIME_SECOND) {
    // Финальное сообщение для двух раз в день
    await userStateService.setState(userId, USER_STATES.REMINDER_SET);
    
    // Проверяем наличие всех необходимых данных
    if (!userData.time1 || !userData.time2 || !userData.timezone) {
      console.error('Ошибка: отсутствуют данные для напоминания', userData);
      await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните заново с /start');
      return;
    }
    
    // Если редактируем время, сохраняем остальные данные из существующего напоминания
    const existingReminder = await getReminder(userId);
    const reminderData = {
      capsules: userData.capsules || (existingReminder?.capsules || 2),
      time1: normalizeTime(userData.time1 || (existingReminder?.time1 || '12:00')), // Нормализуем время
      time2: normalizeTime(userData.time2), // Нормализуем время
      timezone: userData.timezone || (existingReminder?.timezone || 'UTC+3'),
    };
    
    // Сохраняем и настраиваем напоминание ПЕРЕД созданием клавиатуры
    await addReminder(ctx.telegram, userId, reminderData);
    
    // Проверяем, редактируем ли мы существующее напоминание
    const editingTimeKey = userData.editingTimeKey;
    
    // Отслеживаем настройку или изменение напоминания
    if (editingTimeKey) {
      await trackReminderChange(userId);
    } else {
      await trackReminderSetup(userId, reminderData);
    }
    
    // Очищаем данные редактирования
    await userStateService.updateUserData(userId, { editingTimeKey: null, editingTime: null });
    
    // Если редактировали напоминание, возвращаемся к деталям напоминания
    // Для двух раз в день возвращаемся к первому времени, если редактировали time2, иначе к time1
    if (editingTimeKey) {
      // Если редактировали time2, возвращаемся к time2, иначе к time1
      await reminderDetailHandler(ctx, editingTimeKey === 'time2' ? 'time2' : 'time1');
      return;
    }
    
    // Иначе показываем главное меню (новое напоминание)
    await ctx.editMessageText(
      TEXTS.REMINDER_SET_DOUBLE(
        reminderData.capsules,
        reminderData.time1,
        reminderData.time2,
        reminderData.timezone
      ),
      await keyboards.mainMenuAfterSetup(userId)
    );
  }
};
