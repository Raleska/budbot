import { getStatistics, getAllUserData, getUserData, exportData } from '../services/index.js';

const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

export function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

export function setupAdminCommands(bot) {
  bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    
    const stats = await getStatistics();
    const message = `📊 Статистика бота:

👥 Всего пользователей: ${stats.totalUsers}
🟢 Активных (7 дней): ${stats.activeUsers}
📅 Настроено напоминаний: ${stats.totalReminderSetups}
💬 Среднее взаимодействий: ${stats.averageInteractions.toFixed(1)}

🌍 Часовые пояса:
${Object.entries(stats.timezoneDistribution)
  .map(([tz, count]) => `  ${tz}: ${count}`)
  .join('\n')}

💊 Распределение капсул:
  1 капсула: ${stats.capsulesDistribution[1]}
  2 капсулы: ${stats.capsulesDistribution[2]}

⏰ Популярные времена:
${stats.popularTimes.map(({ time, count }) => `  ${time}: ${count}`).join('\n')}`;
    
    await ctx.reply(message);
  });
  
  bot.command('user', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      await ctx.reply('Использование: /user <userId>');
      return;
    }
    
    const userId = parseInt(args[1]);
    const userData = await getUserData(userId);
    
    if (!userData) {
      await ctx.reply('Пользователь не найден');
      return;
    }
    
    const message = `👤 Данные пользователя ${userId}:

Имя: ${userData.firstName || 'Не указано'} ${userData.lastName || ''}
Username: @${userData.username || 'не указан'}

📅 Первое взаимодействие: ${new Date(userData.firstInteraction).toLocaleString('ru-RU')}
🕐 Последнее взаимодействие: ${new Date(userData.lastInteraction).toLocaleString('ru-RU')}
💬 Всего взаимодействий: ${userData.interactionCount}

📅 Активных дней: ${userData.activeDays.size}
🕐 Последний активный день: ${userData.lastActiveDate || 'Нет данных'}

⏰ Настроено напоминаний: ${userData.reminderSetups}
🔄 Изменено напоминаний: ${userData.reminderChanges}

🌍 Часовой пояс: ${userData.timezone || 'Не выбран'}
💊 Предпочитаемые капсулы: ${userData.preferredCapsules || 'Не выбрано'}
⏰ Популярные времена: ${userData.preferredTimes.join(', ') || 'Нет данных'}`;
    
    await ctx.reply(message);
  });
  
  bot.command('export', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    
    const data = await exportData();
    if (data.length < 4096) {
      await ctx.reply(`<pre>${data}</pre>`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply('Данные слишком большие для отправки. Используйте API или файловую систему.');
    }
  });
}
