# Настройка вебхука для Telegram бота

## Что такое вебхук?

Вебхук — это способ получения обновлений от Telegram через HTTP запросы вместо постоянного опроса сервера (long polling). Вебхук более эффективен для продакшена, так как:
- Меньше нагрузка на сервер
- Мгновенная доставка обновлений
- Лучше масштабируется

## Требования

1. **Публичный HTTPS URL** — Telegram требует HTTPS для вебхуков
2. **Доступный сервер** — ваш сервер должен быть доступен из интернета
3. **Express** — уже добавлен в зависимости

## Настройка переменных окружения

Добавьте в файл `.env`:

```env
# Режим работы (true для вебхука, false или не указано для polling)
USE_WEBHOOK=true

# URL вашего сервера (обязательно HTTPS)
WEBHOOK_URL=https://yourdomain.com

# Порт для вебхук сервера (по умолчанию 3000)
WEBHOOK_PORT=3000

# Путь для вебхука (по умолчанию /webhook)
WEBHOOK_PATH=/webhook

# Secret token для безопасности (опционально, но рекомендуется)
WEBHOOK_SECRET_TOKEN=your_secret_token_here
```

## Установка вебхука

### Автоматическая установка

Если `USE_WEBHOOK=true` и `WEBHOOK_URL` указан, вебхук установится автоматически при запуске бота.

### Ручная установка

```bash
npm run webhook:set
```

## Проверка информации о вебхуке

```bash
npm run webhook:info
```

Это покажет:
- URL вебхука
- Количество ожидающих обновлений
- Последние ошибки (если есть)

## Удаление вебхука

```bash
npm run webhook:delete
```

## Запуск бота с вебхуком

1. Убедитесь, что все переменные окружения установлены
2. Запустите бота:
   ```bash
   npm start
   ```

Бот автоматически:
- Создаст Express сервер на указанном порту
- Установит вебхук в Telegram
- Начнет принимать обновления через HTTP

## Запуск бота в режиме polling (для разработки)

Если `USE_WEBHOOK=false` или не указан, бот будет работать в режиме long polling:

```bash
npm start
```

## Настройка Nginx (пример)

Если вы используете Nginx как reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Для secret token
        proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    }
}
```

## Безопасность

### Secret Token

Рекомендуется использовать `WEBHOOK_SECRET_TOKEN` для защиты вебхука. Telegram будет отправлять этот токен в заголовке `X-Telegram-Bot-Api-Secret-Token`, и сервер будет проверять его перед обработкой запросов.

### Генерация секретного токена

```bash
# Linux/Mac
openssl rand -hex 32

# Или используйте любой генератор случайных строк
```

## Health Check

Вебхук сервер автоматически создает эндпоинт `/health` для проверки работоспособности:

```bash
curl http://localhost:3000/health
```

Ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Переключение между режимами

### С вебхука на polling

1. Удалите вебхук: `npm run webhook:delete`
2. Установите `USE_WEBHOOK=false` или удалите переменную
3. Перезапустите бота

### С polling на вебхук

1. Установите переменные окружения для вебхука
2. Запустите бота: `npm start`
3. Вебхук установится автоматически

## Troubleshooting

### Вебхук не работает

1. Проверьте, что URL доступен из интернета:
   ```bash
   curl https://yourdomain.com/webhook
   ```

2. Проверьте логи бота на наличие ошибок

3. Проверьте информацию о вебхуке:
   ```bash
   npm run webhook:info
   ```

4. Убедитесь, что используется HTTPS (Telegram требует HTTPS)

### Ошибка "Bad Request"

- Проверьте, что путь `/webhook` правильный
- Убедитесь, что сервер принимает POST запросы
- Проверьте secret token (если используется)

### Ошибка "Unauthorized"

- Проверьте правильность `WEBHOOK_SECRET_TOKEN`
- Убедитесь, что токен передается в заголовках

## Примеры использования

### Локальная разработка с ngrok

1. Установите ngrok: https://ngrok.com/
2. Запустите ngrok:
   ```bash
   ngrok http 3000
   ```
3. Используйте HTTPS URL от ngrok в `WEBHOOK_URL`:
   ```env
   WEBHOOK_URL=https://abc123.ngrok.io
   ```
4. Запустите бота

### Продакшен на VPS

1. Настройте домен и SSL сертификат (Let's Encrypt)
2. Настройте Nginx как reverse proxy
3. Установите переменные окружения
4. Запустите бота через PM2 или systemd
5. Установите вебхук: `npm run webhook:set`
