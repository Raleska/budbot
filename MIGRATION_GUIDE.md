# Руководство по миграции на PostgreSQL

## Что было сделано

1. ✅ Добавлена зависимость `pg` в `package.json`
2. ✅ Создана SQL схема в `database/schema.sql`
3. ✅ Создан модуль подключения `database/connection.js`
4. ✅ Созданы репозитории для работы с БД:
   - `database/repositories/userRepository.js`
   - `database/repositories/reminderRepository.js`
   - `database/repositories/userStateRepository.js`
   - `database/repositories/analyticsRepository.js`
5. ✅ Обновлены сервисы для работы с БД:
   - `services/reminderService.js` - теперь асинхронный
   - `services/userState.js` - теперь асинхронный
   - `services/userAnalytics.js` - теперь асинхронный
6. ✅ Обновлен `index.js` для инициализации БД при старте

## Что нужно обновить в обработчиках

Все обработчики, которые используют `userStateService` или `reminderService`, нужно обновить для работы с асинхронными методами.

### Примеры изменений:

**Было:**
```javascript
const state = userStateService.getState(userId);
const userData = userStateService.getUserData(userId);
userStateService.setState(userId, USER_STATES.SELECT_DOSAGE);
const reminder = getReminder(userId);
```

**Стало:**
```javascript
const state = await userStateService.getState(userId);
const userData = await userStateService.getUserData(userId);
await userStateService.setState(userId, USER_STATES.SELECT_DOSAGE);
const reminder = await getReminder(userId);
```

### Файлы, которые нужно обновить:

1. ✅ `handlers/startHandler.js` - обновлен
2. ✅ `handlers/activeRemindersHandler.js` - обновлен
3. ✅ `utils/keyboards.js` - обновлен
4. ⚠️ `handlers/dosageHandler.js` - нужно добавить `await`
5. ⚠️ `handlers/capsuleSelectionHandler.js` - нужно добавить `await`
6. ⚠️ `handlers/timezoneHandler.js` - нужно добавить `await`
7. ⚠️ `handlers/timeSelectionHandler.js` - нужно добавить `await`
8. ⚠️ `handlers/customTimeHandler.js` - нужно добавить `await`
9. ⚠️ `handlers/confirmationHandler.js` - нужно добавить `await`
10. ⚠️ `handlers/reminderDetailHandler.js` - нужно добавить `await`
11. ⚠️ `handlers/mainMenuHandler.js` - нужно добавить `await`

## Настройка переменных окружения

Добавьте в `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bot_remind
DB_USER=postgres
DB_PASSWORD=your_password
```

## Инициализация базы данных

1. Создайте базу данных:
```sql
CREATE DATABASE bot_remind;
```

2. Запустите инициализацию:
```bash
node database/init.js
```

Или схема создастся автоматически при первом запуске бота.

## Запуск

```bash
npm install
npm start
```

Бот автоматически:
- Подключится к БД
- Создаст таблицы (если их нет)
- Загрузит все активные напоминания
- Начнет работу
