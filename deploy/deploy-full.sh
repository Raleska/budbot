#!/bin/bash

# Полный скрипт развертывания бота на Ubuntu
# Включает все шаги: установку, настройку SSL, развертывание кода и запуск
# Использование: ./deploy/deploy-full.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="hyalpharmbot.ru"
BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Развертывание Telegram бота          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/deploy-full.sh)${NC}"
    exit 1
fi

# Шаг 1: Базовая установка
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 Шаг 1: Базовая установка системы${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
    bash "$SCRIPT_DIR/deploy.sh"
else
    echo -e "${RED}❌ Файл deploy/deploy.sh не найден!${NC}"
    exit 1
fi

# Шаг 2: Настройка SSL от Reg.ru
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔒 Шаг 2: Настройка SSL сертификата${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "$SCRIPT_DIR/setup-regru-ssl.sh" ]; then
    bash "$SCRIPT_DIR/setup-regru-ssl.sh"
else
    echo -e "${YELLOW}⚠️  Скрипт deploy/setup-regru-ssl.sh не найден, пропускаем${NC}"
fi

# Шаг 3: Развертывание кода
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 Шаг 3: Развертывание кода${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}⚠️  Убедитесь, что файлы проекта скопированы в $APP_DIR${NC}"
read -p "Нажмите Enter после копирования файлов..."

# Установка зависимостей
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
cd $APP_DIR
sudo -u $BOT_USER npm install

# Шаг 4: Настройка переменных окружения
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}⚙️  Шаг 4: Настройка переменных окружения${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f "$APP_DIR/deploy/env.production.example" ]; then
        cp $APP_DIR/deploy/env.production.example $APP_DIR/.env
        echo -e "${GREEN}✅ Создан файл .env из примера${NC}"
    else
        echo -e "${YELLOW}⚠️  Создайте файл .env вручную${NC}"
    fi
fi

echo -e "${YELLOW}📝 Откройте файл .env и заполните необходимые переменные:${NC}"
echo "   nano $APP_DIR/.env"
echo ""
read -p "Нажмите Enter после настройки .env..."

# Шаг 5: Настройка базы данных (если используется)
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}💾 Шаг 5: Настройка базы данных${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Использовать PostgreSQL? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📦 Установка PostgreSQL...${NC}"
    apt install -y postgresql postgresql-contrib
    
    echo -e "${YELLOW}📝 Создание базы данных...${NC}"
    read -p "Введите пароль для пользователя postgres: " DB_PASSWORD
    
    sudo -u postgres psql <<EOF
CREATE DATABASE bot_remind;
CREATE USER botuser WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bot_remind TO botuser;
\q
EOF
    
    echo -e "${YELLOW}📦 Инициализация схемы БД...${NC}"
    cd $APP_DIR
    sudo -u $BOT_USER node database/init.js
    
    echo -e "${GREEN}✅ База данных настроена${NC}"
else
    echo -e "${YELLOW}⚠️  Пропущено. Бот будет работать в режиме in-memory${NC}"
fi

# Шаг 6: Запуск бота
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 Шаг 6: Запуск бота${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd $APP_DIR

# Остановка старого процесса если есть
sudo -u $BOT_USER pm2 delete telegram-bot 2>/dev/null || true

# Запуск бота
echo -e "${YELLOW}🚀 Запуск бота...${NC}"
sudo -u $BOT_USER pm2 start index.js --name telegram-bot
sudo -u $BOT_USER pm2 save

# Шаг 7: Установка вебхука
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📡 Шаг 7: Установка вебхука${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

sleep 3  # Даем боту время запуститься

cd $APP_DIR
sudo -u $BOT_USER npm run webhook:set

# Финальная проверка
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Развертывание завершено!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Проверка статуса:${NC}"
echo "   pm2 status"
echo "   pm2 logs telegram-bot"
echo "   npm run webhook:info"
echo ""
echo -e "${BLUE}🌐 Проверка работы:${NC}"
echo "   curl https://$DOMAIN/health"
echo ""
echo -e "${GREEN}✅ Бот должен быть доступен в Telegram!${NC}"
echo ""
