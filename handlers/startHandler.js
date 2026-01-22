import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackInteraction } from '../services/index.js';

export const startHandler = async (ctx) => {
  const userId = ctx.from.id;
  
  await trackInteraction(userId, ctx.from);
  await userStateService.reset(userId);
  await userStateService.setState(userId, USER_STATES.START);

  const inlineKeyboard = await keyboards.mainMenu(userId);
  const replyKeyboard = await keyboards.replyKeyboard(userId);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(TEXTS.WELCOME, inlineKeyboard);
    await ctx.telegram.sendMessage(userId, 'Используйте меню внизу для быстрого доступа:', { reply_markup: replyKeyboard.reply_markup });
  } else {
    await ctx.reply(TEXTS.WELCOME, inlineKeyboard);
    await ctx.reply('Используйте меню внизу для быстрого доступа:', { reply_markup: replyKeyboard.reply_markup });
  }
};
