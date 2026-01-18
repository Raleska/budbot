#!/bin/bash

# Скрипт развертывания Telegram бота на Ubuntu сервере
# Использование: ./deploy/deploy.sh

set -e  # Остановка при ошибках

echo "🚀 Начало развертывания Telegram бота..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Пожалуйста, запустите скрипт с правами root (sudo ./deploy/deploy.sh)${NC}"
    exit 1
fi

# Переменные (измените под свои данные)
DOMAIN="hyalpharmbot.ru"
BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
NGINX_SITES_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

echo -e "${GREEN}📋 Параметры развертывания:${NC}"
echo "   Домен: $DOMAIN"
echo "   Пользователь: $BOT_USER"
echo "   Директория приложения: $APP_DIR"
echo ""

# Шаг 1: Обновление системы
echo -e "${YELLOW}📦 Шаг 1: Обновление системы...${NC}"
apt update && apt upgrade -y

# Шаг 2: Установка Node.js
echo -e "${YELLOW}📦 Шаг 2: Установка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}✅ Node.js установлен: $(node --version)${NC}"
else
    echo -e "${GREEN}✅ Node.js уже установлен: $(node --version)${NC}"
fi

# Шаг 3: Установка PM2
echo -e "${YELLOW}📦 Шаг 3: Установка PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    pm2 startup systemd -u $BOT_USER --hp /home/$BOT_USER
    echo -e "${GREEN}✅ PM2 установлен${NC}"
else
    echo -e "${GREEN}✅ PM2 уже установлен${NC}"
fi

# Шаг 4: Создание пользователя для бота
echo -e "${YELLOW}👤 Шаг 4: Создание пользователя...${NC}"
if ! id "$BOT_USER" &>/dev/null; then
    useradd -m -s /bin/bash $BOT_USER
    echo -e "${GREEN}✅ Пользователь $BOT_USER создан${NC}"
else
    echo -e "${GREEN}✅ Пользователь $BOT_USER уже существует${NC}"
fi

# Шаг 5: Создание директории приложения
echo -e "${YELLOW}📁 Шаг 5: Создание директории приложения...${NC}"
mkdir -p $APP_DIR
chown -R $BOT_USER:$BOT_USER $APP_DIR
echo -e "${GREEN}✅ Директория создана: $APP_DIR${NC}"

# Шаг 6: Установка Nginx
echo -e "${YELLOW}📦 Шаг 6: Установка Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
    echo -e "${GREEN}✅ Nginx установлен и запущен${NC}"
else
    echo -e "${GREEN}✅ Nginx уже установлен${NC}"
fi

# Шаг 7: Установка Certbot для SSL
echo -e "${YELLOW}📦 Шаг 7: Установка Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✅ Certbot установлен${NC}"
else
    echo -e "${GREEN}✅ Certbot уже установлен${NC}"
fi

# Шаг 8: Настройка Nginx
echo -e "${YELLOW}⚙️  Шаг 8: Настройка Nginx...${NC}"
cat > $NGINX_SITES_DIR/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Логи
    access_log /var/log/nginx/$DOMAIN-access.log;
    error_log /var/log/nginx/$DOMAIN-error.log;

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
        
        # Для secret token
        proxy_set_header X-Telegram-Bot-Api-Secret-Token \$http_x_telegram_bot_api_secret_token;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
    }
}
EOF

# Активация конфигурации
ln -sf $NGINX_SITES_DIR/$DOMAIN $NGINX_ENABLED_DIR/$DOMAIN
nginx -t && systemctl reload nginx
echo -e "${GREEN}✅ Конфигурация Nginx создана${NC}"

# Шаг 9: Получение SSL сертификата
echo -e "${YELLOW}🔒 Шаг 9: Настройка SSL сертификата...${NC}"
echo -e "${YELLOW}⚠️  Если у вас уже есть SSL сертификат от Reg.ru, пропустите этот шаг${NC}"
read -p "Получить бесплатный SSL сертификат от Let's Encrypt? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    echo -e "${GREEN}✅ SSL сертификат получен${NC}"
else
    echo -e "${YELLOW}⚠️  Пропущено. Убедитесь, что SSL сертификат настроен вручную${NC}"
fi

# Шаг 10: Настройка файрвола
echo -e "${YELLOW}🔥 Шаг 10: Настройка файрвола...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✅ Файрвол настроен${NC}"
else
    echo -e "${YELLOW}⚠️  UFW не установлен, пропускаем настройку файрвола${NC}"
fi

echo ""
echo -e "${GREEN}✅ Базовая настройка сервера завершена!${NC}"
echo ""
echo -e "${YELLOW}📝 Следующие шаги:${NC}"
echo "1. Скопируйте файлы проекта в $APP_DIR"
echo "2. Создайте файл .env с настройками (см. deploy/env.production.example)"
echo "3. Установите зависимости: cd $APP_DIR && npm install"
echo "4. Если используете SSL от Reg.ru, запустите: ./deploy/setup-regru-ssl.sh"
echo "5. Запустите бота: sudo -u $BOT_USER pm2 start index.js --name telegram-bot"
echo "6. Сохраните PM2: sudo -u $BOT_USER pm2 save"
echo "7. Установите вебхук: npm run webhook:set"
echo ""
echo -e "${GREEN}📚 Документация:${NC}"
echo "   - Настройка вебхука: README_WEBHOOK.md"
echo "   - Настройка БД: README_DATABASE.md"
echo ""
