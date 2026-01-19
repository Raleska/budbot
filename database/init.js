// Инициализация базы данных

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Pool } = pkg;
import { query, testConnection } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Список обязательных таблиц
const REQUIRED_TABLES = ['users', 'user_states', 'reminders', 'user_analytics'];

// Проверка наличия всех таблиц
export async function checkTablesExist() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const existingTables = result.rows.map(row => row.table_name);
    const missingTables = REQUIRED_TABLES.filter(table => !existingTables.includes(table));
    
    return {
      allExist: missingTables.length === 0,
      existingTables,
      missingTables
    };
  } catch (error) {
    console.error('Ошибка при проверке таблиц:', error);
    return {
      allExist: false,
      existingTables: [],
      missingTables: REQUIRED_TABLES
    };
  }
}

// Проверка наличия функции update_updated_at_column
export async function checkFunctionExists() {
  try {
    const result = await query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'update_updated_at_column'
    `);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Ошибка при проверке функции:', error);
    return false;
  }
}

// Проверка существования базы данных
export async function checkDatabaseExists() {
  const dbName = process.env.DB_NAME || 'bot_remind';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  try {
    // Подключаемся к системной базе данных postgres для проверки
    const adminPool = new Pool({
      host: dbHost,
      port: dbPort,
      database: 'postgres', // Подключаемся к системной БД
      user: dbUser,
      password: dbPassword,
      connectionTimeoutMillis: 2000,
    });

    const result = await adminPool.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);

    await adminPool.end();
    
    return result.rows.length > 0;
  } catch (error) {
    // Если не удалось подключиться к postgres, пробуем подключиться напрямую к нужной БД
    try {
      const testPool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        connectionTimeoutMillis: 2000,
      });
      
      await testPool.query('SELECT 1');
      await testPool.end();
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Создание базы данных
export async function createDatabase() {
  const dbName = process.env.DB_NAME || 'bot_remind';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  try {
    console.log(`📦 Создание базы данных "${dbName}"...`);
    
    // Подключаемся к системной базе данных postgres
    const adminPool = new Pool({
      host: dbHost,
      port: dbPort,
      database: 'postgres',
      user: dbUser,
      password: dbPassword,
      connectionTimeoutMillis: 5000,
    });

    // Проверяем, существует ли база данных
    const checkResult = await adminPool.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);

    if (checkResult.rows.length > 0) {
      console.log(`✅ База данных "${dbName}" уже существует`);
      await adminPool.end();
      return true;
    }

    // Создаем базу данных
    await adminPool.query(`CREATE DATABASE ${dbName}`);
    await adminPool.end();
    
    console.log(`✅ База данных "${dbName}" успешно создана`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка при создании базы данных "${dbName}":`, error.message);
    
    if (error.message.includes('permission denied') || error.message.includes('must be superuser')) {
      console.error('');
      console.error('💡 Решение:');
      console.error('   Пользователь БД не имеет прав на создание баз данных.');
      console.error('   Создайте базу данных вручную:');
      console.error(`   sudo -u postgres psql -c "CREATE DATABASE ${dbName};"`);
      console.error(`   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};"`);
    }
    
    throw error;
  }
}

// Проверка и инициализация базы данных
export async function ensureDatabaseInitialized() {
  try {
    // Сначала проверяем существование базы данных
    const dbExists = await checkDatabaseExists();
    
    if (!dbExists) {
      console.log('📦 База данных не найдена, пытаемся создать автоматически...');
      try {
        await createDatabase();
        // Небольшая задержка для завершения создания БД
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (createError) {
        console.error('❌ Не удалось автоматически создать базу данных');
        console.error('💡 Создайте базу данных вручную и перезапустите бота');
        throw createError;
      }
    }

    // Проверяем подключение к базе данных
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Не удалось подключиться к базе данных');
    }

    console.log('🔍 Проверка структуры базы данных...');
    
    // Проверяем наличие таблиц
    const tablesCheck = await checkTablesExist();
    
    if (!tablesCheck.allExist) {
      console.log('📦 Обнаружены отсутствующие таблицы:', tablesCheck.missingTables.join(', '));
      console.log('📦 Инициализация схемы базы данных...');
      await initDatabase();
      console.log('✅ База данных успешно инициализирована');
      return true;
    }
    
    // Проверяем наличие функции
    const functionExists = await checkFunctionExists();
    if (!functionExists) {
      console.log('📦 Обнаружена отсутствующая функция update_updated_at_column');
      console.log('📦 Инициализация схемы базы данных...');
      await initDatabase();
      console.log('✅ База данных успешно инициализирована');
      return true;
    }
    
    console.log('✅ Все таблицы и функции существуют');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при проверке базы данных:', error.message);
    throw error;
  }
}

// Инициализация схемы БД
export async function initDatabase() {
  try {
    // Проверяем подключение
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Не удалось подключиться к базе данных');
    }

    // Читаем SQL схему
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Выполняем SQL схему
    await query(schema);
    
    console.log('✅ База данных успешно инициализирована');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    throw error;
  }
}
