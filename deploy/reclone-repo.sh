#!/bin/bash

# Скрипт для переклонирования репозитория с сохранением .env
# Использование: sudo ./deploy/reclone-repo.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
GIT_REPO="https://github.com/Raleska/budbot.git"
GIT_BRANCH="main"
BACKUP_DIR="/tmp/telegram-bot-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Переклонирование репозитория         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/reclone-repo.sh)${NC}"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не найдена!${NC}"
    exit 1
fi

echo -e "${YELLOW}💾 Сохранение важных файлов...${NC}"

mkdir -p $BACKUP_DIR

if [ -f "$APP_DIR/.env" ]; then
    cp $APP_DIR/.env $BACKUP_DIR/.env
    echo -e "${GREEN}✅ .env файл сохранен${NC}"
else
    echo -e "${YELLOW}⚠️  .env файл не найден${NC}"
fi

if [ -d "$APP_DIR/node_modules" ]; then
    echo -e "${YELLOW}💾 Сохранение node_modules (опционально)...${NC}"
    cp -r $APP_DIR/node_modules $BACKUP_DIR/ 2>/dev/null || echo -e "${YELLOW}⚠️  Не удалось сохранить node_modules (слишком большой)${NC}"
fi

echo ""
echo -e "${YELLOW}⏸️  Остановка бота...${NC}"
sudo -u $BOT_USER pm2 stop telegram-bot 2>/dev/null || echo -e "${YELLOW}⚠️  Бот не запущен или не найден${NC}"

echo ""
echo -e "${YELLOW}🗑️  Удаление старой директории...${NC}"
cd /tmp
rm -rf $APP_DIR
echo -e "${GREEN}✅ Старая директория удалена${NC}"

echo ""
echo -e "${YELLOW}📥 Клонирование репозитория...${NC}"
git clone -b $GIT_BRANCH $GIT_REPO $APP_DIR
echo -e "${GREEN}✅ Репозиторий склонирован${NC}"

echo ""
echo -e "${YELLOW}🔧 Установка прав доступа...${NC}"
chown -R $BOT_USER:$BOT_USER $APP_DIR
chmod -R u+rwX $APP_DIR
echo -e "${GREEN}✅ Права доступа установлены${NC}"

echo ""
echo -e "${YELLOW}💾 Восстановление .env файла...${NC}"
if [ -f "$BACKUP_DIR/.env" ]; then
    cp $BACKUP_DIR/.env $APP_DIR/.env
    chown $BOT_USER:$BOT_USER $APP_DIR/.env
    chmod 600 $APP_DIR/.env
    echo -e "${GREEN}✅ .env файл восстановлен${NC}"
else
    echo -e "${YELLOW}⚠️  .env файл не найден в резервной копии${NC}"
    echo -e "${YELLOW}💡 Создайте .env файл вручную:${NC}"
    echo "   sudo -u $BOT_USER cp $APP_DIR/deploy/env.production.example $APP_DIR/.env"
    echo "   sudo -u $BOT_USER nano $APP_DIR/.env"
fi

echo ""
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
cd $APP_DIR
sudo -u $BOT_USER npm install
echo -e "${GREEN}✅ Зависимости установлены${NC}"

echo ""
echo -e "${YELLOW}🔧 Настройка Git...${NC}"
git config --global --add safe.directory $APP_DIR 2>/dev/null || true
sudo -u $BOT_USER git config --global --add safe.directory $APP_DIR 2>/dev/null || true
echo -e "${GREEN}✅ Git настроен${NC}"

echo ""
echo -e "${YELLOW}🚀 Запуск бота...${NC}"
cd $APP_DIR

USE_DATABASE=$(sudo -u $BOT_USER grep -E "^USE_DATABASE=" $APP_DIR/.env 2>/dev/null | cut -d '=' -f2 || echo "true")
USE_WEBHOOK=$(sudo -u $BOT_USER grep -E "^USE_WEBHOOK=" $APP_DIR/.env 2>/dev/null | cut -d '=' -f2 || echo "false")

if [ "$USE_DATABASE" = "false" ]; then
    START_CMD="start:memory"
else
    if [ "$USE_WEBHOOK" = "true" ]; then
        START_CMD="start:webhook"
    else
        START_CMD="start"
    fi
fi

sudo -u $BOT_USER pm2 delete telegram-bot 2>/dev/null || true
sudo -u $BOT_USER pm2 start npm --name telegram-bot -- run $START_CMD
sudo -u $BOT_USER pm2 save

echo ""
echo -e "${GREEN}✅ Репозиторий переклонирован и бот запущен!${NC}"
echo ""
echo -e "${BLUE}📊 Статус бота:${NC}"
sudo -u $BOT_USER pm2 status telegram-bot
echo ""
echo -e "${BLUE}📋 Логи (последние 10 строк):${NC}"
sudo -u $BOT_USER pm2 logs telegram-bot --lines 10 --nostream
echo ""
echo -e "${YELLOW}💡 Резервная копия сохранена в: $BACKUP_DIR${NC}"
echo -e "${YELLOW}💡 Можно удалить через 24 часа: rm -rf $BACKUP_DIR${NC}"
echo ""
