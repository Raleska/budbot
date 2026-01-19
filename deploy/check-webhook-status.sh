#!/bin/bash

# Скрипт для проверки статуса вебхука и бота

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="/opt/telegram-bot"

echo -e "${BLUE}🔍 Проверка статуса вебхука и бота${NC}\n"

# Проверка 1: Статус PM2
echo -e "${BLUE}1. Проверка статуса бота в PM2...${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "telegram-bot"; then
        echo -e "${GREEN}✅ Бот найден в PM2${NC}"
        pm2 list | grep telegram-bot
        echo ""
        
        # Проверка логов
        echo -e "${BLUE}   Последние строки логов:${NC}"
        pm2 logs telegram-bot --lines 5 --nostream 2>/dev/null || echo -e "${YELLOW}   Логи недоступны${NC}"
    else
        echo -e "${RED}❌ Бот не найден в PM2${NC}"
        echo -e "${YELLOW}💡 Запустите бота: pm2 start npm --name telegram-bot -- start:webhook${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не установлен${NC}"
fi

echo ""

# Проверка 2: Порт 3000
echo -e "${BLUE}2. Проверка порта 3000...${NC}"
if netstat -tuln 2>/dev/null | grep -q ":3000 " || ss -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Порт 3000 прослушивается${NC}"
    netstat -tuln 2>/dev/null | grep ":3000 " || ss -tuln 2>/dev/null | grep ":3000 "
else
    echo -e "${RED}❌ Порт 3000 не прослушивается${NC}"
    echo -e "${YELLOW}💡 Бот не запущен или не слушает порт 3000${NC}"
fi

echo ""

# Проверка 3: Health endpoint локально
echo -e "${BLUE}3. Проверка health endpoint локально...${NC}"
if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
    RESPONSE=$(curl -s "http://localhost:3000/health")
    echo -e "${GREEN}✅ Health endpoint доступен${NC}"
    echo "   Ответ: $RESPONSE"
else
    echo -e "${RED}❌ Health endpoint недоступен${NC}"
    echo -e "${YELLOW}💡 Бот не отвечает на localhost:3000${NC}"
fi

echo ""

# Проверка 4: Nginx статус
echo -e "${BLUE}4. Проверка Nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx запущен${NC}"
    
    # Проверка конфигурации
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✅ Конфигурация Nginx корректна${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
        nginx -t
    fi
else
    echo -e "${RED}❌ Nginx не запущен${NC}"
    echo -e "${YELLOW}💡 Запустите: sudo systemctl start nginx${NC}"
fi

echo ""

# Проверка 5: Health endpoint через HTTPS
if [ -f "$APP_DIR/.env" ]; then
    WEBHOOK_URL=$(grep "^WEBHOOK_URL=" "$APP_DIR/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
    if [ ! -z "$WEBHOOK_URL" ]; then
        echo -e "${BLUE}5. Проверка health endpoint через HTTPS...${NC}"
        if curl -s -f "$WEBHOOK_URL/health" > /dev/null 2>&1; then
            RESPONSE=$(curl -s "$WEBHOOK_URL/health")
            echo -e "${GREEN}✅ Health endpoint доступен через HTTPS${NC}"
            echo "   Ответ: $RESPONSE"
        else
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL/health" 2>/dev/null || echo "000")
            echo -e "${RED}❌ Health endpoint недоступен через HTTPS (код: $HTTP_CODE)${NC}"
            if [ "$HTTP_CODE" = "502" ]; then
                echo -e "${YELLOW}💡 Ошибка 502: Nginx не может подключиться к боту${NC}"
                echo -e "${YELLOW}   Проверьте, что бот запущен и слушает порт 3000${NC}"
            elif [ "$HTTP_CODE" = "404" ]; then
                echo -e "${YELLOW}💡 Ошибка 404: Проверьте конфигурацию Nginx${NC}"
            fi
        fi
    fi
fi

echo ""

# Проверка 6: Статус вебхука в Telegram
echo -e "${BLUE}6. Проверка статуса вебхука в Telegram...${NC}"
if [ -f "$APP_DIR/.env" ] && [ -f "$APP_DIR/scripts/check-bot-status.js" ]; then
    cd "$APP_DIR"
    if id "botuser" &>/dev/null; then
        sudo -u botuser node scripts/check-bot-status.js 2>/dev/null || echo -e "${YELLOW}⚠️  Не удалось проверить статус вебхука${NC}"
    else
        node scripts/check-bot-status.js 2>/dev/null || echo -e "${YELLOW}⚠️  Не удалось проверить статус вебхука${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Скрипт проверки статуса не найден${NC}"
fi

echo ""
echo -e "${BLUE}📋 Рекомендации:${NC}"
echo -e "   1. Убедитесь, что бот запущен: pm2 restart telegram-bot"
echo -e "   2. Проверьте логи: pm2 logs telegram-bot"
echo -e "   3. Проверьте .env файл: USE_WEBHOOK=true, WEBHOOK_URL установлен"
echo -e "   4. Проверьте логи Nginx: tail -f /var/log/nginx/hyalpharmbot.ru-error.log"
