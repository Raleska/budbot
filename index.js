import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { startHandler } from './handlers/startHandler.js';
import { dosageHandler } from './handlers/dosageHandler.js';
import { capsuleSelectionHandler } from './handlers/capsuleSelectionHandler.js';
import { timezoneHandler } from './handlers/timezoneHandler.js';
import { timeSelectionHandler } from './handlers/timeSelectionHandler.js';
import { customTimeHandler } from './handlers/customTimeHandler.js';
import { confirmationHandler } from './handlers/confirmationHandler.js';
import { mainMenuHandler } from './handlers/mainMenuHandler.js';
import { activeRemindersHandler } from './handlers/activeRemindersHandler.js';
import { reminderDetailHandler } from './handlers/reminderDetailHandler.js';
import { USER_STATES } from './config/states.js';
import { BUTTONS, TEXTS } from './config/texts.js';
import { keyboards } from './utils/keyboards.js';
import { Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не установлен!');
  console.error('Создайте файл .env и добавьте: BOT_TOKEN=ваш_токен_бота');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.use(async (ctx, next) => {
  const originalReply = ctx.reply.bind(ctx);
  const originalEditMessageText = ctx.editMessageText.bind(ctx);
  
  ctx.reply = async function(text, extra = {}) {
    if (extra && typeof extra === 'object') {
      return originalReply(text, { ...extra, parse_mode: 'HTML' });
    }
    return originalReply(text, { parse_mode: 'HTML' });
  };
  
  ctx.editMessageText = async function(text, extra = {}) {
    if (extra && typeof extra === 'object') {
      return originalEditMessageText(text, { ...extra, parse_mode: 'HTML' });
    }
    return originalEditMessageText(text, { parse_mode: 'HTML' });
  };
  
  return next();
});

const USE_DATABASE = process.env.USE_DATABASE !== 'false';

const {
  userStateService,
  trackInteraction,
  getReminder,
  loadAllReminders,
  removeReminder,
} = await import('./services/index.js');

async function initializeBot() {
  try {
    if (USE_DATABASE) {
      console.log('🔌 Подключение к базе данных...');
      const { ensureDatabaseInitialized } = await import('./database/init.js');
      
      try {
        await ensureDatabaseInitialized();
        console.log('📋 Загрузка активных напоминаний из БД...');
        await loadAllReminders(bot);
        console.log('✅ Инициализация с БД завершена');
      } catch (dbError) {
        console.error('❌ Ошибка подключения к базе данных:', dbError.message);
        console.error('');
        console.error('💡 Решения:');
        console.error('   1. Проверьте настройки в .env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)');
        console.error('   2. Для облачных БД: убедитесь, что база данных создана в панели управления провайдера');
        console.error('   3. Для локальных БД: убедитесь, что PostgreSQL запущен и база данных создана');
        console.error('   4. Проверьте SSL настройки (DB_SSL, DB_SSL_CA) если используете облачную БД');
        console.error('   5. Или запустите бота в режиме без БД: npm run start:memory');
        console.error('');
        console.error('   Для запуска без БД используйте:');
        console.error('     npm run start:memory');
        console.error('   или установите в .env: USE_DATABASE=false');
        throw new Error('Не удалось подключиться к базе данных. Используйте режим без БД или настройте PostgreSQL.');
      }
    } else {
      console.log('💾 Режим работы: in-memory (без базы данных)');
      console.log('⚠️  Данные будут храниться только в памяти и потеряются при перезапуске');
      await loadAllReminders(bot);
      console.log('✅ Инициализация без БД завершена');
    }
  } catch (error) {
    console.error('❌ Ошибка при инициализации:', error.message);
    process.exit(1);
  }
}

bot.start(startHandler);

bot.action(/^action:/, async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;
  
  await trackInteraction(userId, ctx.from);
  
  try {
    if (callbackData === 'action:start_vitamins') {
      await dosageHandler(ctx);
    } else if (callbackData === 'action:about_company') {
      await mainMenuHandler(ctx);
    } else if (callbackData === 'action:active_reminders') {
      await activeRemindersHandler(ctx);
    } else if (callbackData === 'action:edit_capsules') {
      const reminder = await getReminder(userId);
      const userData = await userStateService.getUserData(userId);
      if (reminder) {
        await userStateService.updateUserData(userId, {
          capsules: reminder.capsules,
          timezone: reminder.timezone,
          time1: reminder.time1,
          time2: reminder.time2,
          editingTimeKey: userData.editingTimeKey || 'time1',
        });
      }
      await userStateService.setState(userId, USER_STATES.SELECT_DOSAGE);
      await ctx.editMessageText(
        TEXTS.SELECT_DOSAGE,
        keyboards.dosageSelection()
      );
    } else if (callbackData === 'action:edit_time') {
      const userData = await userStateService.getUserData(userId);
      const reminder = await getReminder(userId);
      
      if (!reminder) {
        await ctx.editMessageText(
          TEXTS.NO_ACTIVE_REMINDERS,
          await keyboards.mainMenu(userId)
        );
        return;
      }
      
      await userStateService.updateUserData(userId, {
        capsules: reminder.capsules,
        timezone: reminder.timezone,
        time1: reminder.time1,
        time2: reminder.time2,
        editingTimeKey: userData.editingTimeKey,
      });
      
      if (userData.editingTimeKey === 'time1') {
        await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
        await ctx.editMessageText(
          TEXTS.SELECT_TIME_SINGLE,
          keyboards.timeSelection()
        );
      } else if (userData.editingTimeKey === 'time2') {
        await userStateService.setState(userId, USER_STATES.SELECT_TIME_SECOND);
        await ctx.editMessageText(
          TEXTS.SELECT_TIME_SECOND,
          keyboards.timeSelection()
        );
      }
    } else if (callbackData === 'action:delete_reminder') {
      await removeReminder(userId);
      await userStateService.reset(userId);
      await userStateService.setState(userId, USER_STATES.START);
      
      const deleteKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(BUTTONS.MAIN_MENU, 'action:main_menu')],
      ]);
      
      await ctx.editMessageText(
        '✅ Напоминание отменено',
        deleteKeyboard
      );
    } else if (callbackData.startsWith('action:reminder_detail:')) {
      const timeKey = callbackData.replace('action:reminder_detail:', '');
      await reminderDetailHandler(ctx, timeKey);
    } else if (callbackData === 'action:one_capsule') {
      await capsuleSelectionHandler(ctx, 'one');
    } else if (callbackData === 'action:two_capsules') {
      await capsuleSelectionHandler(ctx, 'two');
    } else if (callbackData === 'action:back_to_start') {
      await startHandler(ctx);
    } else if (callbackData === 'action:back_to_dosage') {
      await userStateService.setState(userId, USER_STATES.SELECT_DOSAGE);
      await ctx.editMessageText(
        TEXTS.SELECT_DOSAGE,
        keyboards.dosageSelection()
      );
    } else if (callbackData.startsWith('action:timezone:')) {
      const timezone = callbackData.replace('action:timezone:', '');
      await timezoneHandler(ctx, timezone);
    } else if (callbackData.startsWith('action:time:')) {
      const time = callbackData.replace('action:time:', '');
      await timeSelectionHandler(ctx, time);
    } else if (callbackData === 'action:custom_time') {
      const state = await userStateService.getState(userId);
      if (state === USER_STATES.SELECT_TIME_SINGLE) {
        await userStateService.setState(userId, USER_STATES.ENTER_CUSTOM_TIME_SINGLE);
      } else if (state === USER_STATES.SELECT_TIME_FIRST) {
        await userStateService.setState(userId, USER_STATES.ENTER_CUSTOM_TIME_FIRST);
      } else if (state === USER_STATES.SELECT_TIME_SECOND) {
        await userStateService.setState(userId, USER_STATES.ENTER_CUSTOM_TIME_SECOND);
      }
      await ctx.editMessageText(
        TEXTS.ENTER_CUSTOM_TIME,
        keyboards.customTimeInput()
      );
    } else if (callbackData === 'action:back_to_timezone') {
      await userStateService.setState(userId, USER_STATES.SELECT_TIMEZONE);
      await ctx.editMessageText(
        TEXTS.SELECT_TIMEZONE,
        keyboards.timezoneSelection()
      );
    } else if (callbackData === 'action:back_to_time_selection') {
      const state = await userStateService.getState(userId);
      if (state === USER_STATES.ENTER_CUSTOM_TIME_SINGLE || state === USER_STATES.CONFIRM_TIME_SINGLE) {
        await userStateService.setState(userId, USER_STATES.SELECT_TIME_SINGLE);
        await ctx.editMessageText(
          TEXTS.SELECT_TIME_SINGLE,
          keyboards.timeSelection()
        );
      } else if (state === USER_STATES.ENTER_CUSTOM_TIME_FIRST || state === USER_STATES.CONFIRM_TIME_FIRST) {
        await userStateService.setState(userId, USER_STATES.SELECT_TIME_FIRST);
        await ctx.editMessageText(
          TEXTS.SELECT_TIME_FIRST,
          keyboards.timeSelection()
        );
      } else if (state === USER_STATES.ENTER_CUSTOM_TIME_SECOND || state === USER_STATES.CONFIRM_TIME_SECOND) {
        await userStateService.setState(userId, USER_STATES.SELECT_TIME_SECOND);
        await ctx.editMessageText(
          TEXTS.SELECT_TIME_SECOND,
          keyboards.timeSelection()
        );
      }
    } else if (callbackData === 'action:confirm') {
      await confirmationHandler(ctx);
    } else if (callbackData === 'action:main_menu') {
      await startHandler(ctx);
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Ошибка при обработке callback:', error);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const state = await userStateService.getState(userId);
  
  await trackInteraction(userId, ctx.from);

  try {
    if (
      state === USER_STATES.ENTER_CUSTOM_TIME_SINGLE ||
      state === USER_STATES.ENTER_CUSTOM_TIME_FIRST ||
      state === USER_STATES.ENTER_CUSTOM_TIME_SECOND
    ) {
      await customTimeHandler(ctx);
    } else {
      await ctx.reply('Пожалуйста, используйте кнопки для навигации или отправьте /start для начала');
    }
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    await ctx.reply('Произошла ошибка. Попробуйте еще раз или начните заново с /start');
  }
});

bot.catch((err, ctx) => {
  console.error('Ошибка в боте:', err);
  ctx.reply('Произошла ошибка. Попробуйте еще раз.');
});

import { setupAdminCommands } from './utils/adminCommands.js';
setupAdminCommands(bot);

const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3000');
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';
const WEBHOOK_SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN;

initializeBot().then(async () => {
  if (USE_WEBHOOK && WEBHOOK_URL) {
    console.log('🌐 Запуск в режиме вебхука...');
    const { createWebhookServer, setWebhook } = await import('./utils/webhook.js');
    
    await createWebhookServer(bot, {
      port: WEBHOOK_PORT,
      path: WEBHOOK_PATH,
      secretToken: WEBHOOK_SECRET_TOKEN,
    });
    
    const fullWebhookUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;
    await setWebhook(BOT_TOKEN, fullWebhookUrl, WEBHOOK_SECRET_TOKEN);
    
    console.log('✅ Бот успешно запущен в режиме вебхука!');
    console.log('📊 Аналитика пользователей активна');
    if (USE_DATABASE) {
      console.log('💾 База данных PostgreSQL подключена');
    } else {
      console.log('💾 Режим работы: in-memory (без БД)');
    }
    console.log(`🔗 Вебхук URL: ${fullWebhookUrl}`);
  } else {
    console.log('🔄 Запуск в режиме long polling...');
    console.log('ℹ️  Вебхук не будет настроен (режим long polling)');
    
    try {
      const { deleteWebhook, getWebhookInfo } = await import('./utils/webhook.js');
      console.log('🔍 Проверка наличия активного вебхука...');
      const webhookInfo = await getWebhookInfo(BOT_TOKEN);
      if (webhookInfo && webhookInfo.url) {
        console.log(`🗑️  Обнаружен активный вебхук: ${webhookInfo.url}`);
        console.log('🗑️  Удаляем вебхук для перехода в long polling...');
        await deleteWebhook(BOT_TOKEN);
        console.log('✅ Вебхук успешно удален');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Готово к запуску long polling');
      } else {
        console.log('✅ Вебхук не установлен, можно запускать long polling');
      }
    } catch (error) {
      console.error('⚠️  Ошибка при проверке/удалении вебхука:', error.message);
      console.log('ℹ️  Продолжаем запуск в режиме long polling...');
      try {
        const { deleteWebhook } = await import('./utils/webhook.js');
        await deleteWebhook(BOT_TOKEN);
        console.log('✅ Вебхук удален принудительно');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (deleteError) {
        console.log('ℹ️  Продолжаем без удаления вебхука...');
      }
    }
    
    console.log('🚀 Запуск бота в режиме long polling...');
    await bot.launch();
    console.log('✅ Бот успешно запущен!');
    console.log('📊 Аналитика пользователей активна');
    if (USE_DATABASE) {
      console.log('💾 База данных PostgreSQL подключена');
    } else {
      console.log('💾 Режим работы: in-memory (без БД)');
    }
  }
}).catch((error) => {
  console.error('❌ Ошибка при запуске бота:', error);
  process.exit(1);
});

process.once('SIGINT', async () => {
  console.log('🛑 Получен сигнал SIGINT, завершение работы...');
  try {
    if (USE_WEBHOOK) {
      const { deleteWebhook } = await import('./utils/webhook.js');
      await deleteWebhook(BOT_TOKEN);
    } else {
      const stopPromise = bot.stop('SIGINT');
      if (stopPromise && typeof stopPromise.then === 'function') {
        await stopPromise;
      }
    }
  } catch (error) {
    console.error('Ошибка при завершении работы:', error);
  } finally {
    process.exit(0);
  }
});

process.once('SIGTERM', async () => {
  console.log('🛑 Получен сигнал SIGTERM, завершение работы...');
  try {
    if (USE_WEBHOOK) {
      const { deleteWebhook } = await import('./utils/webhook.js');
      await deleteWebhook(BOT_TOKEN);
    } else {
      const stopPromise = bot.stop('SIGTERM');
      if (stopPromise && typeof stopPromise.then === 'function') {
        await stopPromise;
      }
    }
  } catch (error) {
    console.error('Ошибка при завершении работы:', error);
  } finally {
    process.exit(0);
  }
});
