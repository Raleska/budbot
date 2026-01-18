# Настройка PostgreSQL для бота

## Установка PostgreSQL

### Windows
1. Скачайте PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
2. Установите PostgreSQL, запомните пароль для пользователя `postgres`
3. Убедитесь, что PostgreSQL запущен как служба

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew install postgresql
brew services start postgresql
```

## Создание базы данных

1. Подключитесь к PostgreSQL:
```bash
psql -U postgres
```

2. Создайте базу данных:
```sql
CREATE DATABASE bot_remind;
\q
```

## Настройка переменных окружения

Добавьте в файл `.env` следующие переменные:

```env
# Telegram Bot Token
BOT_TOKEN=your_bot_token_here

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bot_remind
DB_USER=postgres
DB_PASSWORD=your_postgres_password
```

## Инициализация схемы базы данных

После установки зависимостей и настройки `.env`, выполните:

```bash
npm install
node database/init.js
```

Или схема будет автоматически создана при первом запуске бота (если включена автоматическая инициализация).

## Установка зависимостей

```bash
npm install
```

Это установит пакет `pg` для работы с PostgreSQL.

## Запуск бота

```bash
npm start
```

Бот автоматически:
1. Подключится к базе данных
2. Создаст необходимые таблицы (если их нет)
3. Загрузит все активные напоминания из БД
4. Начнет работу

## Структура базы данных

- **users** - информация о пользователях Telegram
- **user_states** - текущие состояния пользователей в боте
- **reminders** - активные напоминания
- **user_analytics** - аналитика использования бота

Подробная схема находится в файле `database/schema.sql`.
