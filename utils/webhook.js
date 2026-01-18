// Утилиты для управления вебхуком Telegram бота

import { Telegraf } from 'telegraf';

/**
 * Установка вебхука
 */
export async function setWebhook(botToken, webhookUrl, secretToken = null) {
  const bot = new Telegraf(botToken);
  
  try {
    const options = {
      url: webhookUrl,
    };
    
    if (secretToken) {
      options.secret_token = secretToken;
    }
    
    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: secretToken,
    });
    
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('✅ Вебхук успешно установлен:');
    console.log('   URL:', webhookInfo.url);
    console.log('   Ожидает обновления:', webhookInfo.pending_update_count);
    return true;
  } catch (error) {
    console.error('❌ Ошибка при установке вебхука:', error);
    throw error;
  }
}

/**
 * Удаление вебхука
 */
export async function deleteWebhook(botToken) {
  const bot = new Telegraf(botToken);
  
  try {
    await bot.telegram.deleteWebhook();
    console.log('✅ Вебхук успешно удален');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при удалении вебхука:', error);
    throw error;
  }
}

/**
 * Получение информации о вебхуке
 */
export async function getWebhookInfo(botToken) {
  const bot = new Telegraf(botToken);
  
  try {
    const info = await bot.telegram.getWebhookInfo();
    return info;
  } catch (error) {
    console.error('❌ Ошибка при получении информации о вебхуке:', error);
    throw error;
  }
}

/**
 * Создание Express приложения для вебхука
 */
export async function createWebhookServer(bot, options = {}) {
  // Динамический импорт express (чтобы не требовался для polling режима)
  const express = (await import('express')).default;
  
  const app = express();
  const port = options.port || process.env.WEBHOOK_PORT || 3000;
  const path = options.path || process.env.WEBHOOK_PATH || '/webhook';
  const secretToken = options.secretToken || process.env.WEBHOOK_SECRET_TOKEN;
  
  // Middleware для парсинга JSON
  app.use(express.json());
  
  // Middleware для проверки secret token (если указан)
  if (secretToken) {
    app.use((req, res, next) => {
      const token = req.headers['x-telegram-bot-api-secret-token'];
      if (token !== secretToken) {
        return res.status(401).send('Unauthorized');
      }
      next();
    });
  }
  
  // Эндпоинт для вебхука
  app.post(path, async (req, res) => {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Ошибка при обработке обновления:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // Health check эндпоинт
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Запуск сервера
  app.listen(port, () => {
    console.log(`🌐 Вебхук сервер запущен на порту ${port}`);
    console.log(`📡 Эндпоинт: http://localhost:${port}${path}`);
    if (secretToken) {
      console.log('🔒 Secret token защита включена');
    }
  });
  
  return app;
}
