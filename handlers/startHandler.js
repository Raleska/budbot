import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService, trackInteraction } from '../services/index.js';

export const startHandler = async (ctx) => {
  const userId = ctx.from.id;
  
  await trackInteraction(userId, ctx.from);
  await userStateService.reset(userId);
  await userStateService.setState(userId, USER_STATES.START);

  const keyboard = await keyboards.mainMenu(userId);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(TEXTS.WELCOME, keyboard);
  } else {
    await ctx.reply(TEXTS.WELCOME, keyboard);
  }
};
