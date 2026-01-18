#!/bin/bash

# Скрипт для проверки состояния бота на сервере
# Использование: sudo ./deploy/check-bot.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
DOMAIN="hyalpharmbot.ru"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Проверка состояния Telegram бота     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 1. Проверка PM2
echo -e "${YELLOW}1️⃣  Проверка PM2:${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 установлен${NC}"
    echo ""
    echo -e "${BLUE}Статус процессов:${NC}"
    sudo -u $BOT_USER pm2 status
    echo ""
    
    if sudo -u $BOT_USER pm2 list | grep -q "telegram-bot"; then
        echo -e "${GREEN}✅ Бот запущен в PM2${NC}"
        echo ""
        echo -e "${BLUE}Последние логи (20 строк):${NC}"
        sudo -u $BOT_USER pm2 logs telegram-bot --lines 20 --nostream
    else
        echo -e "${RED}❌ Бот не запущен в PM2${NC}"
        echo -e "${YELLOW}💡 Запустите: sudo -u $BOT_USER pm2 start $APP_DIR/index.js --name telegram-bot${NC}"
    fi
else
    echo -e "${RED}❌ PM2 не установлен${NC}"
fi
echo ""

# 2. Проверка .env файла
echo -e "${YELLOW}2️⃣  Проверка .env файла:${NC}"
if [ -f "$APP_DIR/.env" ]; then
    echo -e "${GREEN}✅ Файл .env существует${NC}"
    if grep -q "USE_WEBHOOK=true" "$APP_DIR/.env"; then
        echo -e "${BLUE}   Режим: Вебхук${NC}"
        WEBHOOK_URL=$(grep "^WEBHOOK_URL=" "$APP_DIR/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
        if [ ! -z "$WEBHOOK_URL" ]; then
            echo -e "${BLUE}   WEBHOOK_URL: $WEBHOOK_URL${NC}"
        else
            echo -e "${RED}   ⚠️  WEBHOOK_URL не установлен${NC}"
        fi
    else
        echo -e "${BLUE}   Режим: Long polling${NC}"
    fi
else
    echo -e "${RED}❌ Файл .env не найден${NC}"
fi
echo ""

# 3. Проверка Nginx
echo -e "${YELLOW}3️⃣  Проверка Nginx:${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✅ Nginx установлен${NC}"
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx запущен${NC}"
    else
        echo -e "${RED}❌ Nginx не запущен${NC}"
        echo -e "${YELLOW}💡 Запустите: sudo systemctl start nginx${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Проверка конфигурации:${NC}"
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✅ Конфигурация Nginx корректна${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
        nginx -t
    fi
    
    # Проверка конфигурации для домена
    if [ -f "/etc/nginx/sites-available/$DOMAIN" ] || [ -f "/etc/nginx/sites-enabled/$DOMAIN" ]; then
        echo -e "${GREEN}✅ Конфигурация для $DOMAIN найдена${NC}"
    else
        echo -e "${YELLOW}⚠️  Конфигурация для $DOMAIN не найдена${NC}"
    fi
else
    echo -e "${RED}❌ Nginx не установлен${NC}"
fi
echo ""

# 4. Проверка порта 3000
echo -e "${YELLOW}4️⃣  Проверка порта 3000:${NC}"
if netstat -tuln 2>/dev/null | grep -q ":3000" || ss -tuln 2>/dev/null | grep -q ":3000"; then
    echo -e "${GREEN}✅ Порт 3000 прослушивается${NC}"
else
    echo -e "${YELLOW}⚠️  Порт 3000 не прослушивается${NC}"
    if grep -q "USE_WEBHOOK=true" "$APP_DIR/.env" 2>/dev/null; then
        echo -e "${RED}   ⚠️  ВНИМАНИЕ: Вебхук режим, но сервер не запущен!${NC}"
    else
        echo -e "${BLUE}   ℹ️  Это нормально для long polling режима${NC}"
    fi
fi
echo ""

# 5. Проверка доступности извне
echo -e "${YELLOW}5️⃣  Проверка доступности извне:${NC}"
if [ ! -z "$DOMAIN" ]; then
    echo -e "${BLUE}Проверка HTTPS:${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ HTTPS доступен (код: $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ HTTPS недоступен (не удалось подключиться)${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTPS вернул код: $HTTP_CODE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Домен не указан${NC}"
fi
echo ""

# 6. Проверка вебхука через скрипт
echo -e "${YELLOW}6️⃣  Детальная диагностика:${NC}"
if [ -f "$APP_DIR/scripts/check-bot-status.js" ]; then
    cd $APP_DIR
    sudo -u $BOT_USER node scripts/check-bot-status.js
else
    echo -e "${YELLOW}⚠️  Скрипт диагностики не найден${NC}"
fi
echo ""

# Итоговые рекомендации
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Проверка завершена${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Полезные команды:${NC}"
echo "   pm2 status"
echo "   pm2 logs telegram-bot"
echo "   pm2 restart telegram-bot"
echo "   systemctl status nginx"
echo "   nginx -t"
echo "   curl https://$DOMAIN/health"
echo ""
