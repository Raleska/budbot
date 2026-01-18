/**
 * Обработчик ошибок
 */

import { TEXTS } from '../config/texts.js';

export const setupErrorHandler = (bot) => {
  bot.catch((err, ctx) => {
    console.error('Ошибка в боте:', err);
    
    ctx.reply(TEXTS.ERROR_GENERIC).catch((error) => {
      console.error('Не удалось отправить сообщение об ошибке:', error);
    });
  });
};
