# Настройка вебхука для Telegram бота

## Быстрый старт

### 1. Генерация секретного токена

```bash
cd /opt/telegram-bot
bash deploy/generate-secret-token.sh
```

Скопируйте сгенерированный токен и добавьте в `.env`:
```env
WEBHOOK_SECRET_TOKEN=ваш_сгенерированный_токен
```

### 2. Настройка .env файла

Убедитесь, что в `/opt/telegram-bot/.env` установлены:

```env
USE_WEBHOOK=true
WEBHOOK_URL=https://hyalpharmbot.ru
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET_TOKEN=ваш_секретный_токен
```

### 3. Настройка Nginx и вебхука

**Автоматическая настройка:**
```bash
cd /opt/telegram-bot
sudo bash deploy/setup-webhook.sh
```

**Или вручную:**

1. Копирование конфигурации Nginx:
```bash
sudo cp /opt/telegram-bot/deploy/nginx.conf.production /etc/nginx/sites-available/hyalpharmbot.ru
sudo ln -sf /etc/nginx/sites-available/hyalpharmbot.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

2. Установка вебхука:
```bash
cd /opt/telegram-bot
sudo -u botuser node scripts/setWebhook.js
```

**⚠️ Важно:** Используйте `node scripts/setWebhook.js`, а не `sudo scripts/setWebhook.js`!

### 4. Запуск бота в режиме вебхука

```bash
cd /opt/telegram-bot
pm2 restart telegram-bot
# или если бот еще не запущен:
pm2 start npm --name telegram-bot -- start:webhook
```

## Проверка работы

### 1. Проверка статуса вебхука
```bash
cd /opt/telegram-bot
sudo -u botuser node scripts/check-bot-status.js
```

### 2. Проверка health endpoint
```bash
curl https://hyalpharmbot.ru/health
```

### 3. Проверка логов
```bash
pm2 logs telegram-bot
tail -f /var/log/nginx/hyalpharmbot.ru-error.log
```

### 4. Тест бота
Отправьте сообщение боту в Telegram — он должен ответить.

## Частые ошибки

### Ошибка: "Permission denied" при запуске скрипта

**Проблема:** Вы пытаетесь запустить скрипт напрямую: `sudo scripts/setWebhook.js`

**Решение:** Используйте Node.js:
```bash
sudo -u botuser node scripts/setWebhook.js
```

### Ошибка: "404: Not Found" при установке вебхука

**Возможные причины:**
1. Неправильный `BOT_TOKEN` — проверьте в `.env`
2. URL недоступен для Telegram — проверьте SSL сертификат
3. Бот не запущен — проверьте `pm2 status`
4. Nginx не настроен — проверьте конфигурацию

**Решение:**
```bash
# Проверка токена
grep BOT_TOKEN /opt/telegram-bot/.env

# Проверка доступности
curl -I https://hyalpharmbot.ru/health

# Проверка Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверка бота
pm2 status
pm2 logs telegram-bot
```

### Ошибка: "Secret token mismatch"

**Проблема:** Токен в `.env` не совпадает с токеном, установленным в Telegram

**Решение:**
1. Проверьте токен в `.env`: `grep WEBHOOK_SECRET_TOKEN /opt/telegram-bot/.env`
2. Переустановите вебхук: `sudo -u botuser node scripts/setWebhook.js`

## Удаление вебхука (переход на long polling)

Если нужно переключиться обратно на long polling:

```bash
cd /opt/telegram-bot

# Установите в .env
echo "USE_WEBHOOK=false" >> .env

# Удалите вебхук
sudo -u botuser node -e "import('./utils/webhook.js').then(m => m.deleteWebhook(process.env.BOT_TOKEN))"

# Перезапустите бота
pm2 restart telegram-bot
```

## Дополнительная информация

- Подробная документация: `README_WEBHOOK.md`
- Конфигурация Nginx: `deploy/nginx.conf.production`
- Пример .env: `deploy/env.production.example`
