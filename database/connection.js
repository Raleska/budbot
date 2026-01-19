// Подключение к PostgreSQL базе данных

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

// Настройка SSL для подключения
const getSslConfig = () => {
  const sslMode = process.env.DB_SSLMODE || 'prefer';
  
  // Если SSL отключен явно
  if (sslMode === 'disable') {
    return false;
  }
  
  // Если указан путь к сертификату
  if (process.env.DB_SSLROOTCERT) {
    try {
      return {
        rejectUnauthorized: sslMode === 'verify-full' || sslMode === 'verify-ca',
        ca: readFileSync(process.env.DB_SSLROOTCERT).toString(),
      };
    } catch (error) {
      console.error('Ошибка при чтении SSL сертификата:', error.message);
      return { rejectUnauthorized: false };
    }
  }
  
  // Если используется connection string с SSL параметрами
  if (sslMode === 'require' || sslMode === 'verify-full' || sslMode === 'verify-ca') {
    return {
      rejectUnauthorized: sslMode === 'verify-full' || sslMode === 'verify-ca',
    };
  }
  
  // По умолчанию для локальных подключений SSL не требуется
  return false;
};

// Создание пула подключений
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bot_remind',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Добавляем SSL конфигурацию, если нужно
const sslConfig = getSslConfig();
if (sslConfig !== false) {
  poolConfig.ssl = sslConfig;
}

const pool = new Pool(poolConfig);

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
