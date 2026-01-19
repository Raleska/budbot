// Подключение к PostgreSQL базе данных

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

dotenv.config();

// Функция для настройки SSL
function getSslConfig() {
  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  
  if (!useSsl) {
    return false;
  }

  const sslConfig = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  // Путь к SSL сертификату
  const certPath = process.env.DB_SSL_CA || join(homedir(), '.cloud-certs', 'root.crt');
  
  try {
    const cert = readFileSync(certPath, 'utf-8');
    sslConfig.ca = cert;
    console.log(`✅ SSL сертификат загружен: ${certPath}`);
  } catch (error) {
    if (process.env.DB_SSL_CA) {
      // Если путь указан явно, но файл не найден - предупреждаем
      console.warn(`⚠️  SSL сертификат не найден по пути: ${certPath}`);
      console.warn('   Продолжаем без SSL сертификата');
      // Для облачных БД без сертификата отключаем проверку
      if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && !process.env.DB_HOST.startsWith('127.0.0.1')) {
        console.warn('   ⚠️  Для облачной БД рекомендуется указать правильный путь к сертификату');
        console.warn('   💡 Или установите DB_SSL_REJECT_UNAUTHORIZED=false (менее безопасно)');
        sslConfig.rejectUnauthorized = false;
      }
    } else {
      // Если путь не указан явно, для облачных БД отключаем проверку
      if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && !process.env.DB_HOST.startsWith('127.0.0.1')) {
        console.warn('⚠️  SSL сертификат не указан для облачной БД');
        console.warn('   Отключаем проверку сертификата (DB_SSL_REJECT_UNAUTHORIZED=false)');
        sslConfig.rejectUnauthorized = false;
      }
    }
  }

  return sslConfig;
}

// Создание пула подключений
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bot_remind',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: getSslConfig(),
  max: 20, // Максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Функция для выполнения запросов
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Логируем только медленные запросы (>100ms) или ошибки
    if (duration > 100) {
      console.log(`⚠️  Медленный запрос (${duration}ms):`, text.substring(0, 100) + '...');
    }
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('   Query:', text.substring(0, 200));
    throw error;
  }
}

// Функция для получения клиента из пула (для транзакций)
export async function getClient() {
  return await pool.connect();
}

// Функция для проверки подключения
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Подключение к базе данных успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Закрытие пула подключений
export async function closePool() {
  await pool.end();
}

export default pool;
