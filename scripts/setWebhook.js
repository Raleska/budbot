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

// Проверка формата BOT_TOKEN
if (!BOT_TOKEN.match(/^\d+:[A-Za-z0-9_-]+$/)) {
  console.error('❌ Ошибка: BOT_TOKEN имеет неправильный формат!');
  console.error('   Формат должен быть: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
  console.error('   Получите правильный токен у @BotFather в Telegram');
  process.exit(1);
}

const fullWebhookUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;

// Проверка формата URL
if (!fullWebhookUrl.startsWith('https://')) {
  console.error('❌ Ошибка: WEBHOOK_URL должен начинаться с https://');
  console.error('   Telegram требует HTTPS для вебхуков');
  process.exit(1);
}

console.log('🔧 Установка вебхука...');
console.log('   URL:', fullWebhookUrl);
console.log('   BOT_TOKEN:', BOT_TOKEN.substring(0, 10) + '...' + (BOT_TOKEN.length > 10 ? ' (проверен)' : ' (неверный формат!)'));
if (WEBHOOK_SECRET_TOKEN) {
  if (WEBHOOK_SECRET_TOKEN === 'ваш_секретный_токен_32_символа' || WEBHOOK_SECRET_TOKEN.length < 32) {
    console.warn('⚠️  Внимание: WEBHOOK_SECRET_TOKEN похож на пример из шаблона!');
    console.warn('   Сгенерируйте новый токен: openssl rand -hex 32');
  } else {
    console.log('   Secret Token: установлен');
  }
} else {
  console.warn('⚠️  Secret Token не установлен (рекомендуется для безопасности)');
}

// Функция для проверки доступности URL
async function checkUrlAvailability(urlString) {
  try {
    const https = await import('https');
    const url = new URL(urlString);
    
    return new Promise((resolve) => {
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 405) {
          // 404/405 нормальны для POST эндпоинта при GET запросе
          console.log('   ✅ URL доступен (статус:', res.statusCode + ')');
          resolve(true);
        } else {
          console.warn('   ⚠️  URL вернул статус:', res.statusCode);
          resolve(true); // Продолжаем в любом случае
        }
      });
      
      req.on('error', (err) => {
        console.warn('   ⚠️  Не удалось проверить URL:', err.message);
        console.warn('   Продолжаем установку вебхука...');
        resolve(true); // Продолжаем в любом случае
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.warn('   ⚠️  Таймаут при проверке URL');
        resolve(true);
      });
      
      req.end();
    });
  } catch (err) {
    console.warn('   ⚠️  Пропущена проверка URL:', err.message);
    return true;
  }
}

// Основная функция установки вебхука
async function setupWebhook() {
  // Проверка доступности URL перед установкой
  console.log('\n🔍 Проверка доступности URL...');
  await checkUrlAvailability(fullWebhookUrl);
  
  console.log('\n📡 Установка вебхука в Telegram...');
  
  return setWebhook(BOT_TOKEN, fullWebhookUrl, WEBHOOK_SECRET_TOKEN)
    .then(() => {
      return getWebhookInfo(BOT_TOKEN);
    })
    .then((info) => {
      console.log('\n✅ Вебхук успешно установлен!');
      console.log('\n📊 Информация о вебхуке:');
      console.log('   URL:', info.url || 'не установлен');
      console.log('   Ожидает обновлений:', info.pending_update_count || 0);
      if (info.last_error_message) {
        console.log('   ⚠️  Последняя ошибка:', info.last_error_message);
        if (info.last_error_date) {
          console.log('   ⚠️  Дата ошибки:', new Date(info.last_error_date * 1000).toLocaleString());
        }
      }
    })
    .catch((error) => {
      console.error('\n❌ Ошибка при установке вебхука:', error.message);
      
      if (error.response && error.response.error_code === 404) {
        console.error('\n💡 Возможные причины ошибки 404:');
        console.error('   1. Неправильный BOT_TOKEN');
        console.error('      Проверьте токен в .env файле');
        console.error('      Получите новый токен у @BotFather в Telegram');
        console.error('');
        console.error('   2. URL недоступен для Telegram');
        console.error('      Проверьте доступность: curl -I', fullWebhookUrl);
        console.error('      Убедитесь, что:');
        console.error('      - SSL сертификат действителен');
        console.error('      - Nginx настроен и запущен');
        console.error('      - Бот запущен и слушает порт 3000');
        console.error('      - Файрвол открыт для портов 80 и 443');
        console.error('');
        console.error('   3. Проверьте конфигурацию:');
        console.error('      - nginx -t');
        console.error('      - systemctl status nginx');
        console.error('      - pm2 status');
        console.error('      - curl https://' + new URL(fullWebhookUrl).hostname + '/health');
      }
      
    process.exit(1);
  });
}

// Запуск
setupWebhook().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
