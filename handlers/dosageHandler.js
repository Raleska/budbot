import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService } from '../services/index.js';

export const dosageHandler = async (ctx) => {
  const userId = ctx.from.id;
  await userStateService.setState(userId, USER_STATES.SELECT_DOSAGE);
  
  const keyboard = keyboards.dosageSelection();
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(
      TEXTS.SELECT_DOSAGE,
      keyboard
    );
  } else {
    await ctx.reply(
      TEXTS.SELECT_DOSAGE,
      keyboard
    );
  }
};
