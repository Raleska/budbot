#!/bin/bash

# Скрипт для диагностики и исправления проблем с Nginx и SSL
# Использование: sudo ./deploy/fix-nginx-ssl.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="hyalpharmbot.ru"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика и исправление Nginx/SSL  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/fix-nginx-ssl.sh)${NC}"
    exit 1
fi

# 1. Проверка Nginx
echo -e "${YELLOW}1️⃣  Проверка Nginx:${NC}"
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx не установлен${NC}"
    echo -e "${YELLOW}📦 Установка Nginx...${NC}"
    apt update
    apt install -y nginx
    echo -e "${GREEN}✅ Nginx установлен${NC}"
else
    echo -e "${GREEN}✅ Nginx установлен${NC}"
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx запущен${NC}"
else
    echo -e "${RED}❌ Nginx не запущен${NC}"
    echo -e "${YELLOW}🚀 Запуск Nginx...${NC}"
    systemctl start nginx
    systemctl enable nginx
    echo -e "${GREEN}✅ Nginx запущен${NC}"
fi
echo ""

# 2. Проверка файрвола
echo -e "${YELLOW}2️⃣  Проверка файрвола:${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep "Status:" | awk '{print $2}')
    if [ "$UFW_STATUS" = "active" ]; then
        echo -e "${GREEN}✅ UFW активен${NC}"
        
        # Проверка портов
        if ufw status | grep -q "443/tcp"; then
            echo -e "${GREEN}✅ Порт 443 открыт${NC}"
        else
            echo -e "${RED}❌ Порт 443 закрыт${NC}"
            echo -e "${YELLOW}🔓 Открытие порта 443...${NC}"
            ufw allow 443/tcp
            echo -e "${GREEN}✅ Порт 443 открыт${NC}"
        fi
        
        if ufw status | grep -q "80/tcp"; then
            echo -e "${GREEN}✅ Порт 80 открыт${NC}"
        else
            echo -e "${YELLOW}🔓 Открытие порта 80...${NC}"
            ufw allow 80/tcp
            echo -e "${GREEN}✅ Порт 80 открыт${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  UFW не активен${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW не установлен${NC}"
fi
echo ""

# 3. Проверка конфигурации Nginx
echo -e "${YELLOW}3️⃣  Проверка конфигурации Nginx:${NC}"
if [ -f "$NGINX_CONFIG" ] || [ -f "$NGINX_ENABLED" ]; then
    echo -e "${GREEN}✅ Конфигурация для $DOMAIN найдена${NC}"
    
    # Проверка синтаксиса
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✅ Синтаксис конфигурации корректен${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации:${NC}"
        nginx -t
        echo ""
        echo -e "${YELLOW}💡 Исправьте ошибки в конфигурации и запустите скрипт снова${NC}"
        exit 1
    fi
    
    # Перезагрузка конфигурации
    echo -e "${YELLOW}🔄 Перезагрузка конфигурации Nginx...${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✅ Конфигурация перезагружена${NC}"
else
    echo -e "${RED}❌ Конфигурация для $DOMAIN не найдена${NC}"
    echo -e "${YELLOW}💡 Создайте конфигурацию вручную или используйте скрипты настройки SSL${NC}"
    echo ""
    echo -e "${BLUE}Пути для проверки:${NC}"
    echo "   $NGINX_CONFIG"
    echo "   $NGINX_ENABLED"
    echo "   /etc/nginx/sites-available/default"
    echo ""
fi
echo ""

# 4. Проверка SSL сертификатов
echo -e "${YELLOW}4️⃣  Проверка SSL сертификатов:${NC}"
SSL_FOUND=false

# Проверка Let's Encrypt
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo -e "${GREEN}✅ SSL сертификат Let's Encrypt найден${NC}"
    echo "   Сертификат: $CERT_PATH"
    echo "   Ключ: $KEY_PATH"
    SSL_FOUND=true
fi

# Проверка других путей
if [ ! "$SSL_FOUND" = true ]; then
    if [ -f "/etc/ssl/certs/$DOMAIN.crt" ] && [ -f "/etc/ssl/private/$DOMAIN.key" ]; then
        echo -e "${GREEN}✅ SSL сертификат найден${NC}"
        echo "   Сертификат: /etc/ssl/certs/$DOMAIN.crt"
        echo "   Ключ: /etc/ssl/private/$DOMAIN.key"
        SSL_FOUND=true
    elif [ -f "/etc/nginx/ssl/$DOMAIN.crt" ] && [ -f "/etc/nginx/ssl/$DOMAIN.key" ]; then
        echo -e "${GREEN}✅ SSL сертификат найден${NC}"
        echo "   Сертификат: /etc/nginx/ssl/$DOMAIN.crt"
        echo "   Ключ: /etc/nginx/ssl/$DOMAIN.key"
        SSL_FOUND=true
    fi
fi

if [ ! "$SSL_FOUND" = true ]; then
    echo -e "${RED}❌ SSL сертификат не найден${NC}"
    echo -e "${YELLOW}💡 Настройте SSL сертификат:${NC}"
    echo "   1. Используйте скрипт: sudo ./deploy/setup-https-auto.sh"
    echo "   2. Или настройте вручную через Reg.ru"
fi
echo ""

# 5. Проверка прослушивания портов
echo -e "${YELLOW}5️⃣  Проверка прослушивания портов:${NC}"
if netstat -tuln 2>/dev/null | grep -q ":443" || ss -tuln 2>/dev/null | grep -q ":443"; then
    echo -e "${GREEN}✅ Порт 443 прослушивается${NC}"
    netstat -tuln 2>/dev/null | grep ":443" || ss -tuln 2>/dev/null | grep ":443"
else
    echo -e "${RED}❌ Порт 443 не прослушивается${NC}"
    echo -e "${YELLOW}💡 Проверьте конфигурацию Nginx${NC}"
fi

if netstat -tuln 2>/dev/null | grep -q ":80" || ss -tuln 2>/dev/null | grep -q ":80"; then
    echo -e "${GREEN}✅ Порт 80 прослушивается${NC}"
else
    echo -e "${YELLOW}⚠️  Порт 80 не прослушивается${NC}"
fi
echo ""

# 6. Проверка DNS
echo -e "${YELLOW}6️⃣  Проверка DNS:${NC}"
DOMAIN_IP=$(dig +short $DOMAIN @8.8.8.8 | tail -n1)
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "не определен")

if [ ! -z "$DOMAIN_IP" ] && [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  IP домена ($DOMAIN_IP) не совпадает с IP сервера ($SERVER_IP)${NC}"
    echo -e "${YELLOW}💡 Обновите A записи DNS для домена${NC}"
elif [ ! -z "$DOMAIN_IP" ]; then
    echo -e "${GREEN}✅ DNS настроен правильно (IP: $DOMAIN_IP)${NC}"
else
    echo -e "${RED}❌ Не удалось определить IP домена${NC}"
fi
echo ""

# 7. Тест локального подключения
echo -e "${YELLOW}7️⃣  Тест локального подключения:${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null | grep -q "200\|404"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
    echo -e "${GREEN}✅ Локальный HTTP доступен (код: $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Локальный HTTP недоступен${NC}"
fi

if curl -s -k -o /dev/null -w "%{http_code}" https://localhost/health 2>/dev/null | grep -q "200\|404"; then
    HTTPS_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" https://localhost/health)
    echo -e "${GREEN}✅ Локальный HTTPS доступен (код: $HTTPS_CODE)${NC}"
else
    echo -e "${RED}❌ Локальный HTTPS недоступен${NC}"
fi
echo ""

# Итоговые рекомендации
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Диагностика завершена${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Следующие шаги:${NC}"
echo "   1. Проверьте логи Nginx: tail -f /var/log/nginx/error.log"
echo "   2. Проверьте статус: systemctl status nginx"
echo "   3. Проверьте конфигурацию: nginx -t"
echo "   4. Если SSL не настроен: sudo ./deploy/setup-https-auto.sh"
echo "   5. Проверьте доступность: curl https://$DOMAIN/health"
echo ""
