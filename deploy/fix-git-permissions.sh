#!/bin/bash

# Скрипт для исправления прав доступа к Git репозиторию
# Использование: sudo ./deploy/fix-git-permissions.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_USER="botuser"
APP_DIR="/opt/telegram-bot"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление прав доступа Git         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите с правами root (sudo ./deploy/fix-git-permissions.sh)${NC}"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Директория $APP_DIR не найдена!${NC}"
    exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
    echo -e "${RED}❌ Это не Git репозиторий!${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Исправление прав доступа к репозиторию...${NC}"

cd $APP_DIR

echo -e "${YELLOW}   Установка владельца всех файлов на $BOT_USER...${NC}"
chown -R $BOT_USER:$BOT_USER $APP_DIR

echo -e "${YELLOW}   Установка прав доступа к .git директории...${NC}"
chmod -R u+rwX $APP_DIR/.git

echo -e "${YELLOW}   Установка прав доступа к объектам Git...${NC}"
if [ -d "$APP_DIR/.git/objects" ]; then
    chmod -R u+rwX $APP_DIR/.git/objects
fi

if [ -d "$APP_DIR/.git/refs" ]; then
    chmod -R u+rwX $APP_DIR/.git/refs
fi

echo -e "${YELLOW}   Настройка Git safe.directory...${NC}"
git config --global --add safe.directory $APP_DIR 2>/dev/null || true
sudo -u $BOT_USER git config --global --add safe.directory $APP_DIR 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Права доступа исправлены!${NC}"
echo ""
echo -e "${YELLOW}🧪 Проверка прав доступа...${NC}"
sudo -u $BOT_USER git status > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Git работает корректно для пользователя $BOT_USER${NC}"
else
    echo -e "${RED}❌ Проблема с правами доступа все еще существует${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔄 Проверка локальных изменений...${NC}"
cd $APP_DIR
LOCAL_CHANGES=$(sudo -u $BOT_USER git status --porcelain 2>/dev/null | wc -l)
if [ "$LOCAL_CHANGES" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Обнаружены локальные изменения в репозитории${NC}"
    read -p "Отбросить локальные изменения и обновить из репозитория? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🔄 Откат локальных изменений...${NC}"
        sudo -u $BOT_USER git fetch origin
        sudo -u $BOT_USER git reset --hard origin/main
        sudo -u $BOT_USER git clean -fd
        echo -e "${GREEN}✅ Локальные изменения отброшены, репозиторий обновлен${NC}"
    else
        echo -e "${YELLOW}⚠️  Локальные изменения сохранены${NC}"
    fi
else
    echo -e "${GREEN}✅ Локальных изменений нет${NC}"
fi

echo ""
echo -e "${BLUE}💡 Теперь можно выполнить:${NC}"
echo "   sudo -u $BOT_USER git pull"
echo "   или"
echo "   sudo ./deploy/deploy-update.sh"
echo ""
