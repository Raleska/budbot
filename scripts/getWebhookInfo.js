// Скрипт для получения информации о вебхуке

import 'dotenv/config';
import { getWebhookInfo } from '../utils/webhook.js';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в .env');
  process.exit(1);
}

console.log('📊 Получение информации о вебхуке...\n');

getWebhookInfo(BOT_TOKEN)
  .then((info) => {
    console.log('Информация о вебхуке:');
    console.log('   URL:', info.url || 'не установлен');
    console.log('   Ожидает обновлений:', info.pending_update_count || 0);
    console.log('   Последняя ошибка:', info.last_error_message || 'нет');
    if (info.last_error_date) {
      console.log('   Последняя ошибка (дата):', new Date(info.last_error_date * 1000).toLocaleString());
    }
    if (info.max_connections) {
      console.log('   Макс. соединений:', info.max_connections);
    }
    if (info.allowed_updates) {
      console.log('   Разрешенные обновления:', info.allowed_updates.join(', '));
    }
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });
