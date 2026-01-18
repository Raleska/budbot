/**
 * Обработчики текстовых сообщений
 */

import { TEXTS } from '../config/texts.js';
import { getMainKeyboard, getCancelKeyboard, removeKeyboard } from '../config/keyboards.js';

export const setupMessageHandlers = (bot) => {
  // Обработка текстовых кнопок
  bot.hears('➕ Создать напоминание', async (ctx) => {
    await ctx.reply(
      TEXTS.REMIND_CREATE_PROMPT,
      getCancelKeyboard()
    );
  });

  bot.hears('📋 Список напоминаний', async (ctx) => {
    await ctx.reply(
      TEXTS.REMIND_LIST_EMPTY,
      getMainKeyboard()
    );
  });

  bot.hears('❌ Отмена', async (ctx) => {
    await ctx.reply(
      TEXTS.CANCELLED,
      getMainKeyboard()
    );
  });

  // Обработка обычных текстовых сообщений
  bot.on('text', async (ctx) => {
    // Здесь можно добавить логику обработки текста
    // Например, если пользователь в режиме создания напоминания
    await ctx.reply(
      TEXTS.UNKNOWN_MESSAGE,
      getMainKeyboard()
    );
  });
};
