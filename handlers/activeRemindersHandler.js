import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { getReminder, trackInteraction } from '../services/index.js';
import { Markup } from 'telegraf';
import { normalizeTime } from '../utils/validators.js';

export const activeRemindersHandler = async (ctx) => {
  const userId = ctx.from.id;
  
  await trackInteraction(userId, ctx.from);
  const reminder = await getReminder(userId);
  
  if (!reminder) {
    const message = TEXTS.NO_ACTIVE_REMINDERS;
    const keyboard = await keyboards.mainMenu(userId);
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, keyboard);
    } else {
      await ctx.reply(message, keyboard);
    }
    return;
  }
  
  const buttons = [];
  const time1 = normalizeTime(reminder.time1);
  const time2 = reminder.time2 ? normalizeTime(reminder.time2) : null;
  
  buttons.push([
    Markup.button.callback(`⏰ ${time1}`, `action:reminder_detail:time1`),
  ]);
  
  if (time2) {
    buttons.push([
      Markup.button.callback(`⏰ ${time2}`, `action:reminder_detail:time2`),
    ]);
  }
  
  buttons.push([
    Markup.button.callback(BUTTONS.MAIN_MENU, 'action:main_menu'),
  ]);
  
  const keyboard = Markup.inlineKeyboard(buttons);
  const message = TEXTS.ACTIVE_REMINDERS_LIST;
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, keyboard);
  } else {
    await ctx.reply(message, keyboard);
  }
};
