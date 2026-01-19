import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { reminderRepository } from '../database/repositories/reminderRepository.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function testReminders() {
  try {
    console.log('🔍 Проверка активных напоминаний в БД...\n');
    
    const reminders = await reminderRepository.getAllActiveReminders();
    
    if (reminders.length === 0) {
      console.log('⚠️  Активных напоминаний не найдено');
      return;
    }
    
    console.log(`✅ Найдено ${reminders.length} активных напоминаний:\n`);
    
    for (const reminder of reminders) {
      console.log(`👤 Пользователь: ${reminder.user_id}`);
      console.log(`   Капсулы: ${reminder.capsules}`);
      console.log(`   Время 1: ${reminder.time1}`);
      console.log(`   Время 2: ${reminder.time2 || 'не установлено'}`);
      console.log(`   Часовой пояс: ${reminder.timezone}`);
      console.log(`   Включено: ${reminder.enabled}`);
      console.log('');
    }
    
    console.log('\n📋 Для проверки cron jobs проверьте логи бота:');
    console.log('   pm2 logs telegram-bot | grep "Cron job"');
    console.log('\n💡 Для тестовой отправки напоминания используйте:');
    console.log('   node scripts/send-test-reminder.js <user_id>');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await bot.telegram.close();
  }
}

testReminders();
