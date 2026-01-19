import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { reminderRepository } from '../database/repositories/reminderRepository.js';
import { TEXTS } from '../config/texts.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const userId = process.argv[2];

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в .env');
  process.exit(1);
}

if (!userId) {
  console.error('❌ Укажите user_id: node scripts/send-test-reminder.js <user_id>');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function sendTestReminder() {
  try {
    console.log(`📨 Отправка тестового напоминания пользователю ${userId}...\n`);
    
    const reminder = await reminderRepository.getReminderByUserId(userId);
    
    if (!reminder) {
      console.error(`❌ Напоминание для пользователя ${userId} не найдено`);
      process.exit(1);
    }
    
    console.log('📋 Данные напоминания:');
    console.log(`   Капсулы: ${reminder.capsules}`);
    console.log(`   Время 1: ${reminder.time1}`);
    console.log(`   Время 2: ${reminder.time2 || 'не установлено'}`);
    console.log(`   Часовой пояс: ${reminder.timezone}\n`);
    
    const message = TEXTS.REMINDER_MESSAGE;
    
    console.log('📤 Отправка сообщения...');
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
    console.log('✅ Сообщение отправлено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('   Детали:', error.response.description);
    }
    process.exit(1);
  } finally {
    await bot.telegram.close();
  }
}

sendTestReminder();
