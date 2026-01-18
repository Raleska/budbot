/**
 * Обработчики команд бота
 */

import { TEXTS } from '../config/texts.js';
import { getMainKeyboard, removeKeyboard } from '../config/keyboards.js';

export const setupCommandHandlers = (bot) => {
  // Команда /start
  bot.command('start', async (ctx) => {
    await ctx.reply(
      TEXTS.START_MESSAGE,
      getMainKeyboard()
    );
  });

  // Команда /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      TEXTS.HELP_MESSAGE,
      removeKeyboard()
    );
  });

  // Команда /remind
  bot.command('remind', async (ctx) => {
    // Здесь будет логика создания напоминания
    await ctx.reply(
      TEXTS.REMIND_CREATE_PROMPT,
      getCancelKeyboard()
    );
    // Можно установить состояние ожидания ввода текста напоминания
  });

  // Команда /list
  bot.command('list', async (ctx) => {
    // Здесь будет логика показа списка напоминаний
    await ctx.reply(
      TEXTS.REMIND_LIST_EMPTY,
      getMainKeyboard()
    );
  });
};
