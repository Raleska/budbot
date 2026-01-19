import 'dotenv/config';
import { getWebhookInfo } from '../utils/webhook.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || '3000';
const USE_DATABASE = process.env.USE_DATABASE !== 'false';

console.log('🔍 Диагностика состояния бота\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1️⃣  Проверка переменных окружения:');
console.log(`   BOT_TOKEN: ${BOT_TOKEN ? '✅ Установлен (' + BOT_TOKEN.substring(0, 10) + '...)' : '❌ Не установлен'}`);
console.log(`   USE_WEBHOOK: ${USE_WEBHOOK ? '✅ true (режим вебхука)' : '✅ false/не указан (режим long polling)'}`);
console.log(`   USE_DATABASE: ${USE_DATABASE ? '✅ true (с PostgreSQL)' : '✅ false (in-memory)'}`);

if (USE_WEBHOOK) {
  console.log(`   WEBHOOK_URL: ${WEBHOOK_URL ? '✅ ' + WEBHOOK_URL : '❌ Не установлен'}`);
  console.log(`   WEBHOOK_PORT: ${WEBHOOK_PORT}`);
} else {
  console.log('   ℹ️  Режим long polling - вебхук не требуется');
}

console.log('');

console.log('2️⃣  Проверка вебхука в Telegram:');
try {
  if (!BOT_TOKEN) {
    console.log('   ⚠️  BOT_TOKEN не установлен, пропускаем проверку');
  } else {
    const webhookInfo = await getWebhookInfo(BOT_TOKEN);
    if (webhookInfo.url) {
      console.log(`   ⚠️  Активный вебхук: ${webhookInfo.url}`);
      console.log(`   Ожидает обновлений: ${webhookInfo.pending_update_count || 0}`);
      if (webhookInfo.last_error_message) {
        console.log(`   ⚠️  Последняя ошибка: ${webhookInfo.last_error_message}`);
      }
      if (!USE_WEBHOOK) {
        console.log('   ⚠️  ВНИМАНИЕ: Вебхук активен, но бот настроен на long polling!');
        console.log('   💡 Решение: Удалите вебхук командой: npm run webhook:delete');
      }
    } else {
      console.log('   ✅ Вебхук не установлен');
      if (USE_WEBHOOK) {
        console.log('   ⚠️  ВНИМАНИЕ: Бот настроен на вебхук, но вебхук не установлен!');
        console.log('   💡 Решение: Установите вебхук командой: npm run webhook:set');
      }
    }
  }
} catch (error) {
  console.log(`   ❌ Ошибка при проверке вебхука: ${error.message}`);
}
console.log('');

console.log('3️⃣  Проверка доступности порта 3000:');
try {
  const http = await import('http');
  const checkPort = () => {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/health',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve({ available: true, status: res.statusCode });
      });
      
      req.on('error', () => {
        resolve({ available: false });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ available: false });
      });
      
      req.end();
    });
  };
  
  const portCheck = await checkPort();
  if (portCheck.available) {
    console.log('   ✅ Порт 3000 доступен (сервер работает)');
    if (portCheck.status) {
      console.log(`   Статус health check: ${portCheck.status}`);
    }
  } else {
    console.log('   ❌ Порт 3000 недоступен');
    if (USE_WEBHOOK) {
      console.log('   ⚠️  ВНИМАНИЕ: Вебхук сервер не запущен!');
      console.log('   💡 Решение: Проверьте логи бота: pm2 logs telegram-bot');
    } else {
      console.log('   ℹ️  Это нормально для режима long polling (сервер не требуется)');
    }
  }
} catch (error) {
  console.log(`   ⚠️  Не удалось проверить порт: ${error.message}`);
}
console.log('');

console.log('4️⃣  Рекомендации:');
if (USE_WEBHOOK) {
  console.log('   📋 Для режима вебхука проверьте:');
  console.log('      1. PM2 статус: pm2 status');
  console.log('      2. Логи бота: pm2 logs telegram-bot');
  console.log('      3. Nginx статус: systemctl status nginx');
  console.log('      4. Nginx конфигурация: nginx -t');
  console.log('      5. Доступность извне: curl https://' + (WEBHOOK_URL ? new URL(WEBHOOK_URL).hostname : 'yourdomain.com') + '/health');
} else {
  console.log('   📋 Для режима long polling проверьте:');
  console.log('      1. PM2 статус: pm2 status');
  console.log('      2. Логи бота: pm2 logs telegram-bot');
  console.log('      3. Убедитесь, что вебхук удален: npm run webhook:info');
  console.log('      4. Если вебхук активен, удалите его: npm run webhook:delete');
}
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Диагностика завершена\n');
