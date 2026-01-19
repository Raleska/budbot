#!/bin/bash

# Скрипт для генерации секретного токена для вебхука

echo "🔐 Генерация секретного токена для WEBHOOK_SECRET_TOKEN..."
echo ""

# Генерируем токен
if command -v openssl &> /dev/null; then
    TOKEN=$(openssl rand -hex 32)
    echo "✅ Секретный токен сгенерирован:"
    echo ""
    echo "WEBHOOK_SECRET_TOKEN=$TOKEN"
    echo ""
    echo "📝 Добавьте эту строку в ваш .env файл"
    echo "💡 Или выполните:"
    echo "   echo 'WEBHOOK_SECRET_TOKEN=$TOKEN' >> /opt/telegram-bot/.env"
else
    echo "❌ OpenSSL не установлен"
    echo "💡 Установите: sudo apt-get install openssl"
    echo ""
    echo "Альтернативный способ генерации (Node.js):"
    echo "   node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
fi
