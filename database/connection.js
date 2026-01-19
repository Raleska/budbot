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
  } catch (error) {
    if (process.env.DB_SSL_CA) {
      // Если путь указан явно, но файл не найден - предупреждаем
      console.warn(`⚠️  SSL сертификат не найден по пути: ${certPath}`);
      console.warn('   Продолжаем без SSL сертификата');
    }
    // Если путь не указан явно, просто используем SSL без сертификата
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
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
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
    const result = await query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Закрытие пула подключений
export async function closePool() {
  await pool.end();
}

export default pool;
