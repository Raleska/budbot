#!/bin/bash

# Скрипт для настройки HTTPS и исправления long polling режима
# Использование: sudo ./deploy/fix-https-longpolling.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="hyalpharmbot.ru"
BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление HTTPS и Long Polling     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/fix-https-longpolling.sh)${NC}"
    exit 1
fi

# 1. Проверка и настройка .env для long polling
echo -e "${YELLOW}1️⃣  Проверка настроек бота:${NC}"
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    exit 1
fi

# Убедимся, что USE_WEBHOOK не установлен в true
if grep -q "^USE_WEBHOOK=true" "$APP_DIR/.env"; then
    echo -e "${YELLOW}⚠️  USE_WEBHOOK=true найден в .env${NC}"
    read -p "Изменить на long polling режим? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Заменяем USE_WEBHOOK=true на false
        sed -i 's/^USE_WEBHOOK=true/USE_WEBHOOK=false/' "$APP_DIR/.env"
        echo -e "${GREEN}✅ USE_WEBHOOK установлен в false${NC}"
    fi
else
    echo -e "${GREEN}✅ Режим long polling настроен правильно${NC}"
fi
echo ""

# 2. Удаление вебхука, если он активен
echo -e "${YELLOW}2️⃣  Проверка и удаление вебхука:${NC}"
cd $APP_DIR
if [ -f "scripts/deleteWebhook.js" ]; then
    echo -e "${YELLOW}🔄 Проверка вебхука...${NC}"
    WEBHOOK_INFO=$(sudo -u $BOT_USER node scripts/getWebhookInfo.js 2>/dev/null || echo "")
    if echo "$WEBHOOK_INFO" | grep -q "url:" && echo "$WEBHOOK_INFO" | grep -vq "url:.*не установлен"; then
        echo -e "${YELLOW}🗑️  Найден активный вебхук, удаляем...${NC}"
        sudo -u $BOT_USER node scripts/deleteWebhook.js
        echo -e "${GREEN}✅ Вебхук удален${NC}"
    else
        echo -e "${GREEN}✅ Вебхук не установлен${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Скрипты вебхука не найдены${NC}"
fi
echo ""

# 3. Проверка SSL сертификата
echo -e "${YELLOW}3️⃣  Проверка SSL сертификата:${NC}"
SSL_FOUND=false
CERT_PATH=""
KEY_PATH=""

# Проверка Let's Encrypt
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    SSL_FOUND=true
    echo -e "${GREEN}✅ SSL сертификат Let's Encrypt найден${NC}"
fi

# Проверка других путей
if [ ! "$SSL_FOUND" = true ]; then
    if [ -f "/etc/nginx/ssl/$DOMAIN/certificate.crt" ] && [ -f "/etc/nginx/ssl/$DOMAIN/private.key" ]; then
        CERT_PATH="/etc/nginx/ssl/$DOMAIN/certificate.crt"
        KEY_PATH="/etc/nginx/ssl/$DOMAIN/private.key"
        SSL_FOUND=true
        echo -e "${GREEN}✅ SSL сертификат найден${NC}"
    fi
fi

if [ ! "$SSL_FOUND" = true ]; then
    echo -e "${RED}❌ SSL сертификат не найден${NC}"
    echo -e "${YELLOW}💡 Настройте SSL:${NC}"
    echo "   sudo ./deploy/setup-https-auto.sh"
    echo "   или настройте вручную через Reg.ru"
    echo ""
    read -p "Продолжить без HTTPS? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo "   Сертификат: $CERT_PATH"
    echo "   Ключ: $KEY_PATH"
fi
echo ""

# 4. Настройка Nginx для HTTPS (если SSL найден)
if [ "$SSL_FOUND" = true ]; then
    echo -e "${YELLOW}4️⃣  Настройка Nginx для HTTPS:${NC}"
    
    # Создаем базовую конфигурацию HTTPS
    cat > $NGINX_CONFIG <<EOF
# Редирект HTTP на HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL сертификаты
    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    # SSL настройки безопасности
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Логи
    access_log /var/log/nginx/$DOMAIN-access.log;
    error_log /var/log/nginx/$DOMAIN-error.log;

    # Увеличенные размеры для запросов
    client_max_body_size 1M;

    # Health check (для проверки доступности)
    location /health {
        return 200 '{"status":"ok","message":"Server is running"}';
        add_header Content-Type application/json;
        access_log off;
    }

    # Блокировка доступа к другим путям
    location / {
        return 404;
    }
}
EOF

    # Активация конфигурации
    ln -sf $NGINX_CONFIG $NGINX_ENABLED
    
    # Проверка конфигурации
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✅ Конфигурация Nginx создана${NC}"
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx перезагружен${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации Nginx:${NC}"
        nginx -t
        exit 1
    fi
    echo ""
fi

# 5. Перезапуск бота
echo -e "${YELLOW}5️⃣  Перезапуск бота:${NC}"
cd $APP_DIR

if sudo -u $BOT_USER pm2 list | grep -q "telegram-bot"; then
    echo -e "${YELLOW}🔄 Перезапуск бота...${NC}"
    sudo -u $BOT_USER pm2 restart telegram-bot
    sleep 3
    echo -e "${GREEN}✅ Бот перезапущен${NC}"
    
    # Показываем статус
    echo ""
    echo -e "${BLUE}Статус бота:${NC}"
    sudo -u $BOT_USER pm2 status telegram-bot
    echo ""
    echo -e "${BLUE}Последние логи (10 строк):${NC}"
    sudo -u $BOT_USER pm2 logs telegram-bot --lines 10 --nostream
else
    echo -e "${YELLOW}⚠️  Бот не запущен в PM2${NC}"
    echo -e "${YELLOW}🚀 Запуск бота...${NC}"
    sudo -u $BOT_USER pm2 start index.js --name telegram-bot
    sudo -u $BOT_USER pm2 save
    echo -e "${GREEN}✅ Бот запущен${NC}"
fi
echo ""

# 6. Финальная проверка
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Настройка завершена!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Проверка:${NC}"
echo "   1. Статус бота: sudo -u $BOT_USER pm2 status"
echo "   2. Логи бота: sudo -u $BOT_USER pm2 logs telegram-bot"
echo "   3. HTTP редирект: curl -I http://$DOMAIN"
echo "   4. HTTPS доступность: curl https://$DOMAIN/health"
echo "   5. Проверка вебхука: cd $APP_DIR && sudo -u $BOT_USER npm run webhook:info"
echo ""
