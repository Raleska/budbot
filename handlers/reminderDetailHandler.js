import { TEXTS, BUTTONS } from '../config/texts.js';
import { getReminder, removeReminder, trackInteraction, userStateService } from '../services/index.js';
import { Markup } from 'telegraf';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { normalizeTime } from '../utils/validators.js';

export const reminderDetailHandler = async (ctx, timeKey) => {
  const userId = ctx.from.id;
  
  await trackInteraction(userId, ctx.from);
  const reminder = await getReminder(userId);
  
  if (!reminder) {
    await ctx.editMessageText(
      TEXTS.NO_ACTIVE_REMINDERS,
      await keyboards.mainMenu(userId)
    );
    return;
  }
  
  const rawTime = timeKey === 'time1' ? reminder.time1 : reminder.time2;
  const time = normalizeTime(rawTime);
  const time1 = normalizeTime(reminder.time1);
  const time2 = reminder.time2 ? normalizeTime(reminder.time2) : null;
  
  const hasTwoTimes = reminder.time2 !== null && reminder.time2 !== undefined && reminder.time2 !== '';
  const capsules = hasTwoTimes ? 2 : 1;
  
  await userStateService.updateUserData(userId, { 
    editingTimeKey: timeKey,
    editingTime: time,
  });
  
  const message = TEXTS.REMINDER_DETAILS(capsules, time1, time2);
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(BUTTONS.EDIT_CAPSULES, 'action:edit_capsules')],
    [Markup.button.callback(BUTTONS.EDIT_TIME, 'action:edit_time')],
    [Markup.button.callback(BUTTONS.DELETE_REMINDER, 'action:delete_reminder')],
    [Markup.button.callback(BUTTONS.BACK, 'action:active_reminders')],
  ]);
  
  await ctx.editMessageText(message, keyboard);
};
