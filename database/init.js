// Инициализация базы данных

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

// Проверка и инициализация базы данных
export async function ensureDatabaseInitialized() {
  try {
    // Проверяем подключение
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
    console.error('❌ Ошибка при проверке базы данных:', error);
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
