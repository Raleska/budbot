import { TEXTS, BUTTONS } from '../config/texts.js';
import { keyboards } from '../utils/keyboards.js';
import { USER_STATES } from '../config/states.js';
import { userStateService } from '../services/index.js';
import { isValidTime, normalizeTime } from '../utils/validators.js';

export const customTimeHandler = async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const state = await userStateService.getState(userId);
  const keyboard = keyboards.confirmation();

  if (!isValidTime(text)) {
    await ctx.reply(TEXTS.INVALID_TIME_FORMAT, keyboards.customTimeInput());
    return;
  }

  const normalizedTime = normalizeTime(text);
  
  if (state === USER_STATES.ENTER_CUSTOM_TIME_SINGLE) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SINGLE);
    
    await ctx.reply(
      TEXTS.CONFIRM_TIME_SINGLE(normalizedTime),
      keyboard
    );
  } else if (state === USER_STATES.ENTER_CUSTOM_TIME_FIRST) {
    await userStateService.updateUserData(userId, { time1: normalizedTime });
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_FIRST);
    
    await ctx.reply(
      TEXTS.CONFIRM_TIME_FIRST(normalizedTime),
      keyboard
    );
  } else if (state === USER_STATES.ENTER_CUSTOM_TIME_SECOND) {
    await userStateService.updateUserData(userId, { time2: normalizedTime });
    await userStateService.setState(userId, USER_STATES.CONFIRM_TIME_SECOND);
    
    await ctx.reply(
      TEXTS.CONFIRM_TIME_SECOND(normalizedTime),
      keyboard
    );
  }
};
