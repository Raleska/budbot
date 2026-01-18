/**
 * Конфигурация бота
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  // Здесь можно добавить другие настройки
  // Например, настройки базы данных, API ключи и т.д.
};
