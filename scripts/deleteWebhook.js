// Скрипт для удаления вебхука

import 'dotenv/config';
import { deleteWebhook, getWebhookInfo } from '../utils/webhook.js';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен в .env');
  process.exit(1);
}

console.log('🗑️  Удаление вебхука...');

deleteWebhook(BOT_TOKEN)
  .then(() => {
    return getWebhookInfo(BOT_TOKEN);
  })
  .then((info) => {
    console.log('\n📊 Информация о вебхуке:');
    console.log('   URL:', info.url || 'не установлен');
    if (!info.url) {
      console.log('   ✅ Вебхук успешно удален');
    }
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });
