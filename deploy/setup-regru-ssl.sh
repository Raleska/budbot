#!/bin/bash

# Скрипт для настройки SSL сертификата от Reg.ru
# Использование: ./deploy/setup-regru-ssl.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="hyalpharmbot.ru"
CERT_DIR="/etc/nginx/ssl/$DOMAIN"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/setup-regru-ssl.sh)${NC}"
    exit 1
fi

echo -e "${GREEN}🔒 Настройка SSL сертификата от Reg.ru для $DOMAIN${NC}"
echo ""

# Создание директории
mkdir -p $CERT_DIR
chmod 700 $CERT_DIR

echo -e "${YELLOW}📥 Инструкции:${NC}"
echo ""
echo "1. Войдите в панель Reg.ru"
echo "2. Перейдите в SSL сертификаты для домена $DOMAIN"
echo "3. Скачайте файлы:"
echo "   - Сертификат (Certificate) → certificate.crt"
echo "   - Private Key → private.key"
echo "   - Корневой сертификат (если есть) → chain.crt"
echo ""
echo "4. Загрузите файлы на сервер в: $CERT_DIR"
echo ""
echo "   Используйте один из способов:"
echo "   - scp certificate.crt root@сервер:$CERT_DIR/"
echo "   - Или используйте SFTP клиент"
echo ""
read -p "Нажмите Enter после загрузки файлов..."

# Поиск файлов сертификата
CERT_FILE=$(find $CERT_DIR -name "*.crt" -o -name "*.pem" | grep -v chain | grep -v root | head -1)
KEY_FILE=$(find $CERT_DIR -name "*.key" | head -1)
CHAIN_FILE=$(find $CERT_DIR -name "*chain*" -o -name "*root*" | head -1)

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo -e "${RED}❌ Не найдены файлы сертификата!${NC}"
    echo "Ожидаемые файлы:"
    echo "  - $CERT_DIR/certificate.crt (или .pem)"
    echo "  - $CERT_DIR/private.key"
    exit 1
fi

echo -e "${GREEN}✅ Найдены файлы:${NC}"
echo "   Сертификат: $CERT_FILE"
echo "   Ключ: $KEY_FILE"
if [ -n "$CHAIN_FILE" ]; then
    echo "   Цепочка: $CHAIN_FILE"
fi

# Настройка прав
chmod 600 $KEY_FILE
chmod 644 $CERT_FILE
if [ -n "$CHAIN_FILE" ]; then
    chmod 644 $CHAIN_FILE
fi

# Обновление конфигурации Nginx
echo -e "${YELLOW}⚙️  Обновление конфигурации Nginx...${NC}"

cat > $NGINX_CONFIG <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL сертификаты
    ssl_certificate $CERT_FILE;
    ssl_certificate_key $KEY_FILE;
EOF

if [ -n "$CHAIN_FILE" ]; then
    echo "    ssl_trusted_certificate $CHAIN_FILE;" >> $NGINX_CONFIG
fi

cat >> $NGINX_CONFIG <<EOF

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Логи
    access_log /var/log/nginx/$DOMAIN-access.log;
    error_log /var/log/nginx/$DOMAIN-error.log;

    # Увеличенные размеры для запросов от Telegram
    client_max_body_size 1M;

    # Проксирование на локальный сервер бота
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Важно: передача secret token от Telegram
        proxy_set_header X-Telegram-Bot-Api-Secret-Token \$http_x_telegram_bot_api_secret_token;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        access_log off;
    }

    # Блокировка доступа к другим путям
    location / {
        return 404;
    }
}
EOF

# Активация конфигурации
ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/$DOMAIN

# Проверка и перезагрузка
if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}✅ Конфигурация Nginx обновлена и применена${NC}"
else
    echo -e "${RED}❌ Ошибка в конфигурации Nginx!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ SSL сертификат настроен!${NC}"
echo ""
echo -e "${YELLOW}📝 Проверка:${NC}"
echo "1. Проверьте SSL: openssl s_client -connect $DOMAIN:443"
echo "2. Проверьте health check: curl https://$DOMAIN/health"
echo "3. Проверьте в браузере: https://$DOMAIN/health"
echo ""
