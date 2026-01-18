// Скрипт для установки вебхука

import 'dotenv/config';
import { setWebhook, getWebhookInfo } from '../utils/webhook.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
const WEBHOOK_SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в .env');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ Ошибка: WEBHOOK_URL не установлен в .env');
  console.error('Пример: WEBHOOK_URL=https://yourdomain.com');
  process.exit(1);
}

const fullWebhookUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;

console.log('🔧 Установка вебхука...');
console.log('   URL:', fullWebhookUrl);
if (WEBHOOK_SECRET_TOKEN) {
  console.log('   Secret Token: установлен');
}

setWebhook(BOT_TOKEN, fullWebhookUrl, WEBHOOK_SECRET_TOKEN)
  .then(() => {
    return getWebhookInfo(BOT_TOKEN);
  })
  .then((info) => {
    console.log('\n📊 Информация о вебхуке:');
    console.log('   URL:', info.url || 'не установлен');
    console.log('   Ожидает обновлений:', info.pending_update_count || 0);
    console.log('   Последняя ошибка:', info.last_error_message || 'нет');
    console.log('   Последняя ошибка (дата):', info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString() : 'нет');
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });
