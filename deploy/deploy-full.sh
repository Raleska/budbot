#!/bin/bash

# Полный скрипт развертывания бота на Ubuntu через Git
# Включает все шаги: установку, настройку SSL, клонирование кода и запуск
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
GIT_REPO="https://github.com/Raleska/budbot.git"
GIT_BRANCH="main"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Развертывание Telegram бота          ║${NC}"
echo -e "${BLUE}║  через Git                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/deploy-full.sh)${NC}"
    exit 1
fi

# Настройка репозитория (опционально)
echo -e "${YELLOW}📋 Настройка Git репозитория${NC}"
read -p "Использовать репозиторий по умолчанию ($GIT_REPO)? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "Введите URL Git репозитория: " GIT_REPO
fi

read -p "Использовать ветку main? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "Введите название ветки: " GIT_BRANCH
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

# Шаг 2: Установка Git (если не установлен)
echo -e "${YELLOW}📦 Проверка установки Git...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📦 Установка Git...${NC}"
    apt install -y git
    echo -e "${GREEN}✅ Git установлен${NC}"
else
    echo -e "${GREEN}✅ Git уже установлен: $(git --version)${NC}"
fi

# Шаг 3: Настройка SSL от Reg.ru
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔒 Шаг 2: Настройка SSL сертификата${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Настроить SSL сертификат сейчас? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "$SCRIPT_DIR/setup-regru-ssl.sh" ]; then
        bash "$SCRIPT_DIR/setup-regru-ssl.sh"
    else
        echo -e "${YELLOW}⚠️  Скрипт deploy/setup-regru-ssl.sh не найден, пропускаем${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Пропущено. Настройте SSL позже${NC}"
fi

# Шаг 4: Клонирование репозитория
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 Шаг 3: Клонирование репозитория${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Сохраняем текущую директорию и переходим в безопасное место
ORIGINAL_DIR=$(pwd)
SAFE_DIR="/tmp"
cd $SAFE_DIR

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠️  Директория $APP_DIR уже существует${NC}"
    read -p "Удалить и переклонировать? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  Удаление старой директории...${NC}"
        # Убеждаемся, что мы не в удаляемой директории
        if [ "$(pwd)" = "$APP_DIR" ] || [[ "$(pwd)" == "$APP_DIR"/* ]]; then
            cd $SAFE_DIR
        fi
        rm -rf $APP_DIR
        echo -e "${GREEN}✅ Старая директория удалена${NC}"
    else
        echo -e "${YELLOW}⚠️  Используем существующую директорию${NC}"
        cd $APP_DIR
        echo -e "${YELLOW}🔄 Обновление через git pull...${NC}"
        sudo -u $BOT_USER git fetch origin
        sudo -u $BOT_USER git reset --hard origin/$GIT_BRANCH
        cd $SAFE_DIR
    fi
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📥 Клонирование репозитория $GIT_REPO...${NC}"
    git clone -b $GIT_BRANCH $GIT_REPO $APP_DIR
    chown -R $BOT_USER:$BOT_USER $APP_DIR
    echo -e "${GREEN}✅ Репозиторий клонирован${NC}"
fi

# Настройка Git safe.directory для работы от root (если нужно)
echo -e "${YELLOW}🔧 Настройка Git безопасных директорий...${NC}"
git config --global --add safe.directory $APP_DIR 2>/dev/null || true
sudo -u $BOT_USER git config --global --add safe.directory $APP_DIR 2>/dev/null || true
echo -e "${GREEN}✅ Git настроен${NC}"

# Установка зависимостей
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
cd $APP_DIR
sudo -u $BOT_USER npm install
echo -e "${GREEN}✅ Зависимости установлены${NC}"

# Шаг 5: Настройка переменных окружения
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}⚙️  Шаг 4: Настройка переменных окружения${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f "$APP_DIR/deploy/env.production.example" ]; then
        cp $APP_DIR/deploy/env.production.example $APP_DIR/.env
        chown $BOT_USER:$BOT_USER $APP_DIR/.env
        echo -e "${GREEN}✅ Создан файл .env из примера${NC}"
    else
        echo -e "${YELLOW}⚠️  Создайте файл .env вручную${NC}"
    fi
else
    echo -e "${GREEN}✅ Файл .env уже существует, сохраняем его${NC}"
    chown $BOT_USER:$BOT_USER $APP_DIR/.env 2>/dev/null || true
fi

echo -e "${YELLOW}📝 Откройте файл .env и заполните необходимые переменные:${NC}"
echo "   nano $APP_DIR/.env"
echo ""
read -p "Нажмите Enter после настройки .env..."

# Шаг 6: Настройка базы данных (если используется)
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}💾 Шаг 5: Настройка базы данных${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Использовать PostgreSQL? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📦 Установка PostgreSQL...${NC}"
    apt update
    apt install -y postgresql postgresql-contrib postgresql-client
    
    echo -e "${YELLOW}📝 Создание базы данных...${NC}"
    read -p "Введите пароль для пользователя postgres: " DB_PASSWORD
    
    sudo -u postgres psql <<EOF
CREATE DATABASE bot_remind;
CREATE USER botuser WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bot_remind TO botuser;
\q
EOF
    
    echo -e "${YELLOW}📦 Инициализация схемы БД...${NC}"
    if [ ! -d "$APP_DIR" ]; then
        echo -e "${RED}❌ Директория $APP_DIR не существует!${NC}"
        exit 1
    fi
    cd $APP_DIR
    sudo -u $BOT_USER node database/init.js
    
    echo -e "${GREEN}✅ База данных настроена${NC}"
else
    echo -e "${YELLOW}⚠️  Пропущено. Бот будет работать в режиме in-memory${NC}"
fi

# Шаг 7: Запуск бота
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 Шаг 6: Запуск бота${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Убеждаемся, что мы в правильной директории
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не существует!${NC}"
    exit 1
fi

cd $APP_DIR

# Остановка старого процесса если есть
sudo -u $BOT_USER pm2 delete telegram-bot 2>/dev/null || true

# Запуск бота
echo -e "${YELLOW}🚀 Запуск бота...${NC}"
sudo -u $BOT_USER pm2 start index.js --name telegram-bot
sudo -u $BOT_USER pm2 save

# Шаг 8: Установка вебхука
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📡 Шаг 7: Установка вебхука${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

sleep 3  # Даем боту время запуститься

# Убеждаемся, что мы в правильной директории
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не существует!${NC}"
    exit 1
fi

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
echo -e "${BLUE}🔄 Обновление кода:${NC}"
echo "   cd $APP_DIR"
echo "   sudo -u $BOT_USER git pull"
echo "   sudo -u $BOT_USER npm install  # если изменились зависимости"
echo "   sudo -u $BOT_USER pm2 restart telegram-bot"
echo ""
echo -e "${GREEN}✅ Бот должен быть доступен в Telegram!${NC}"
echo ""
