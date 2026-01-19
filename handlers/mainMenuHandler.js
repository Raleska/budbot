import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService } from '../services/index.js';
import { Markup } from 'telegraf';

export const mainMenuHandler = async (ctx) => {
  const userId = ctx.from.id;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(BUTTONS.BACK, 'action:back_to_start')]
  ]);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(TEXTS.ABOUT_COMPANY, keyboard);
  } else {
    await ctx.reply(TEXTS.ABOUT_COMPANY, keyboard);
  }
};
