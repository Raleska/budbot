#!/bin/bash

# Скрипт для настройки вебхука после установки Nginx и SSL

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="/opt/telegram-bot"
NGINX_SITE="/etc/nginx/sites-available/hyalpharmbot.ru"
NGINX_ENABLED="/etc/nginx/sites-enabled/hyalpharmbot.ru"

echo -e "${BLUE}🔧 Настройка вебхука для Telegram бота${NC}\n"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите скрипт с правами root: sudo bash setup-webhook.sh${NC}"
    exit 1
fi

# Шаг 1: Проверка существования директории проекта
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не найдена${NC}"
    echo -e "${YELLOW}💡 Сначала выполните deploy-full.sh для установки проекта${NC}"
    exit 1
fi

# Шаг 2: Проверка .env файла
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${RED}❌ Файл .env не найден в $APP_DIR${NC}"
    echo -e "${YELLOW}💡 Создайте .env файл на основе deploy/env.production.example${NC}"
    exit 1
fi

# Шаг 3: Проверка переменных окружения
USE_WEBHOOK=$(grep "^USE_WEBHOOK=" "$APP_DIR/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "false")
WEBHOOK_URL=$(grep "^WEBHOOK_URL=" "$APP_DIR/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")

if [ "$USE_WEBHOOK" != "true" ]; then
    echo -e "${YELLOW}⚠️  USE_WEBHOOK не установлен в true${NC}"
    echo -e "${BLUE}💡 Установите USE_WEBHOOK=true в .env для работы с вебхуком${NC}"
    exit 0
fi

if [ -z "$WEBHOOK_URL" ]; then
    echo -e "${RED}❌ WEBHOOK_URL не установлен в .env${NC}"
    echo -e "${YELLOW}💡 Установите WEBHOOK_URL=https://yourdomain.com в .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Переменные окружения проверены${NC}"
echo -e "   USE_WEBHOOK: $USE_WEBHOOK"
echo -e "   WEBHOOK_URL: $WEBHOOK_URL"

# Шаг 4: Копирование конфигурации Nginx
echo -e "\n${BLUE}📝 Настройка Nginx...${NC}"

if [ ! -f "$APP_DIR/deploy/nginx.conf.production" ]; then
    echo -e "${RED}❌ Файл nginx.conf.production не найден${NC}"
    exit 1
fi

# Копируем конфигурацию
cp "$APP_DIR/deploy/nginx.conf.production" "$NGINX_SITE"

# Создаем симлинк если его нет
if [ ! -L "$NGINX_ENABLED" ]; then
    ln -s "$NGINX_SITE" "$NGINX_ENABLED"
    echo -e "${GREEN}✅ Симлинк создан${NC}"
fi

# Проверка синтаксиса Nginx
echo -e "${BLUE}🔍 Проверка синтаксиса Nginx...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Синтаксис Nginx корректен${NC}"
else
    echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
    exit 1
fi

# Перезагрузка Nginx
echo -e "${BLUE}🔄 Перезагрузка Nginx...${NC}"
systemctl reload nginx
echo -e "${GREEN}✅ Nginx перезагружен${NC}"

# Шаг 5: Проверка SSL сертификата
echo -e "\n${BLUE}🔒 Проверка SSL сертификата...${NC}"
DOMAIN=$(echo "$WEBHOOK_URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if [ -f "$CERT_PATH" ]; then
    echo -e "${GREEN}✅ SSL сертификат найден: $CERT_PATH${NC}"
    
    # Проверка срока действия
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
    echo -e "${BLUE}   Срок действия до: $EXPIRY_DATE${NC}"
else
    echo -e "${YELLOW}⚠️  SSL сертификат не найден по пути: $CERT_PATH${NC}"
    echo -e "${YELLOW}💡 Убедитесь, что SSL сертификат установлен или обновите путь в nginx.conf.production${NC}"
fi

# Шаг 6: Проверка доступности бота
echo -e "\n${BLUE}🔍 Проверка доступности бота...${NC}"

# Проверка PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "telegram-bot"; then
        echo -e "${GREEN}✅ Бот запущен в PM2${NC}"
        pm2 list | grep telegram-bot
    else
        echo -e "${YELLOW}⚠️  Бот не найден в PM2${NC}"
        echo -e "${YELLOW}💡 Запустите бота: cd $APP_DIR && pm2 start npm --name telegram-bot -- start:webhook${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не установлен${NC}"
fi

# Проверка порта 3000
if netstat -tuln 2>/dev/null | grep -q ":3000 " || ss -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Порт 3000 прослушивается${NC}"
else
    echo -e "${YELLOW}⚠️  Порт 3000 не прослушивается${NC}"
    echo -e "${YELLOW}💡 Убедитесь, что бот запущен и слушает порт 3000${NC}"
fi

# Проверка health endpoint
echo -e "\n${BLUE}🔍 Проверка health endpoint...${NC}"
if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint доступен локально${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint недоступен локально${NC}"
fi

# Проверка HTTPS health endpoint
if curl -s -f -k "$WEBHOOK_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health endpoint доступен через HTTPS${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint недоступен через HTTPS${NC}"
    echo -e "${YELLOW}💡 Проверьте SSL сертификат и конфигурацию Nginx${NC}"
fi

# Шаг 7: Установка вебхука
echo -e "\n${BLUE}📡 Установка вебхука в Telegram...${NC}"

cd "$APP_DIR"
if [ -f "scripts/setWebhook.js" ]; then
    # Запускаем скрипт установки вебхука от имени пользователя бота
    if id "botuser" &>/dev/null; then
        echo -e "${BLUE}   Запуск от имени botuser...${NC}"
        sudo -u botuser node scripts/setWebhook.js
    else
        echo -e "${BLUE}   Запуск от имени текущего пользователя...${NC}"
        node scripts/setWebhook.js
    fi
else
    echo -e "${RED}❌ Скрипт scripts/setWebhook.js не найден${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Настройка вебхука завершена!${NC}"
echo -e "\n${BLUE}📋 Следующие шаги:${NC}"
echo -e "   1. Проверьте логи бота: pm2 logs telegram-bot"
echo -e "   2. Проверьте логи Nginx: tail -f /var/log/nginx/hyalpharmbot.ru-error.log"
echo -e "   3. Отправьте сообщение боту в Telegram"
echo -e "   4. Проверьте статус вебхука: node scripts/check-bot-status.js"
