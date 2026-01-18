#!/bin/bash

# Скрипт для обновления бота через Git
# Использование: ./deploy/deploy-update.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"
GIT_BRANCH="main"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Обновление Telegram бота             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/deploy-update.sh)${NC}"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не найдена!${NC}"
    echo "Сначала выполните развертывание: sudo ./deploy/deploy-full.sh"
    exit 1
fi

cd $APP_DIR

# Проверка, что это Git репозиторий
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Это не Git репозиторий!${NC}"
    exit 1
fi

echo -e "${YELLOW}📥 Получение обновлений из Git...${NC}"
sudo -u $BOT_USER git fetch origin

# Проверка изменений
LOCAL=$(sudo -u $BOT_USER git rev-parse HEAD)
REMOTE=$(sudo -u $BOT_USER git rev-parse origin/$GIT_BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✅ Уже на последней версии${NC}"
    exit 0
fi

echo -e "${YELLOW}📋 Изменения найдены. Обновление...${NC}"
echo -e "${YELLOW}   Текущая версия: ${LOCAL:0:7}${NC}"
echo -e "${YELLOW}   Новая версия:  ${REMOTE:0:7}${NC}"
echo ""

# Создание бэкапа текущей версии
BACKUP_DIR="/opt/telegram-bot-backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}💾 Создание резервной копии...${NC}"
cp -r $APP_DIR $BACKUP_DIR
echo -e "${GREEN}✅ Резервная копия создана: $BACKUP_DIR${NC}"

# Остановка бота
echo -e "${YELLOW}⏸️  Остановка бота...${NC}"
sudo -u $BOT_USER pm2 stop telegram-bot || true

# Обновление кода
echo -e "${YELLOW}🔄 Обновление кода...${NC}"
sudo -u $BOT_USER git reset --hard origin/$GIT_BRANCH
sudo -u $BOT_USER git clean -fd

# Установка зависимостей
echo -e "${YELLOW}📦 Проверка зависимостей...${NC}"
if [ -f "package.json" ]; then
    sudo -u $BOT_USER npm install
    echo -e "${GREEN}✅ Зависимости обновлены${NC}"
fi

# Запуск бота
echo -e "${YELLOW}🚀 Запуск бота...${NC}"
sudo -u $BOT_USER pm2 restart telegram-bot || sudo -u $BOT_USER pm2 start index.js --name telegram-bot
sudo -u $BOT_USER pm2 save

# Проверка статуса
sleep 2
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Обновление завершено!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Статус бота:${NC}"
sudo -u $BOT_USER pm2 status telegram-bot
echo ""
echo -e "${BLUE}📋 Логи (последние 20 строк):${NC}"
sudo -u $BOT_USER pm2 logs telegram-bot --lines 20 --nostream
echo ""
echo -e "${YELLOW}💡 Если что-то пошло не так, восстановите из резервной копии:${NC}"
echo "   rm -rf $APP_DIR"
echo "   cp -r $BACKUP_DIR $APP_DIR"
echo "   sudo -u $BOT_USER pm2 restart telegram-bot"
echo ""
