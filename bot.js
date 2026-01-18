/**
 * Основной файл Telegram бота
 * Модульная архитектура для легкого изменения функционала
 */

import { Telegraf } from 'telegraf';
import { config } from './config/config.js';
import { setupCommandHandlers } from './handlers/commandHandlers.js';
import { setupMessageHandlers } from './handlers/messageHandlers.js';
import { setupErrorHandler } from './handlers/errorHandler.js';

// Проверка наличия токена
if (!config.botToken) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в переменных окружения!');
  console.error('Создайте файл .env и добавьте туда BOT_TOKEN=ваш_токен');
  process.exit(1);
}

// Создание экземпляра бота
const bot = new Telegraf(config.botToken);

// Настройка обработчиков
setupCommandHandlers(bot);
setupMessageHandlers(bot);
setupErrorHandler(bot);

// Запуск бота
bot.launch()
  .then(() => {
    console.log('✅ Бот успешно запущен!');
  })
  .catch((error) => {
    console.error('❌ Ошибка при запуске бота:', error);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
