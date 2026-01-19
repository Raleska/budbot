import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import pkg from 'pg';
const { Pool } = pkg;
import { query, testConnection } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REQUIRED_TABLES = ['users', 'user_states', 'reminders', 'user_analytics'];

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

function getSslConfig() {
  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  
  if (!useSsl) {
    return false;
  }

  const sslConfig = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  const certPath = process.env.DB_SSL_CA || join(homedir(), '.cloud-certs', 'root.crt');
  
  try {
    const cert = readFileSync(certPath, 'utf-8');
    sslConfig.ca = cert;
    } catch (error) {
      if (process.env.DB_SSL_CA) {
        console.warn(`⚠️  SSL сертификат не найден по пути: ${certPath}`);
      }
      const dbHost = process.env.DB_HOST || 'localhost';
    if (dbHost !== 'localhost' && !dbHost.startsWith('127.0.0.1')) {
      console.warn('   Отключаем проверку сертификата для облачной БД');
      sslConfig.rejectUnauthorized = false;
    }
  }

  return sslConfig;
}

export async function checkDatabaseExists() {
  const dbName = process.env.DB_NAME || 'bot_remind';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  const isCloudDb = dbHost !== 'localhost' && !dbHost.startsWith('127.0.0.1');
  
  if (isCloudDb) {
    try {
      const sslConfig = getSslConfig();
      const testPool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        ssl: sslConfig,
        connectionTimeoutMillis: 3000,
      });
      
      await testPool.query('SELECT 1');
      await testPool.end();
      return true;
    } catch (e) {
      return false;
    }
  }

  try {
    const sslConfig = getSslConfig();
    const adminPool = new Pool({
      host: dbHost,
      port: dbPort,
      database: 'postgres', // Подключаемся к системной БД
      user: dbUser,
      password: dbPassword,
      ssl: sslConfig,
      connectionTimeoutMillis: 2000,
    });

    const result = await adminPool.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);

    await adminPool.end();
    
    return result.rows.length > 0;
  } catch (error) {
    try {
      const sslConfig = getSslConfig();
      const testPool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        ssl: sslConfig,
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

export async function createDatabase() {
  const dbName = process.env.DB_NAME || 'bot_remind';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  try {
    console.log(`📦 Создание базы данных "${dbName}"...`);
    
    const sslConfig = getSslConfig();
    const adminPool = new Pool({
      host: dbHost,
      port: dbPort,
      database: 'postgres',
      user: dbUser,
      password: dbPassword,
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    });

    const checkResult = await adminPool.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);

    if (checkResult.rows.length > 0) {
      console.log(`✅ База данных "${dbName}" уже существует`);
      await adminPool.end();
      return true;
    }

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

export async function ensureDatabaseInitialized() {
  try {
    const connected = await testConnection();
    if (!connected) {
      const dbExists = await checkDatabaseExists();
      
      if (!dbExists) {
        console.log('📦 База данных не найдена, пытаемся создать автоматически...');
        try {
          await createDatabase();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const reconnected = await testConnection();
          if (!reconnected) {
            throw new Error('Не удалось подключиться к только что созданной базе данных');
          }
        } catch (createError) {
          console.error('❌ Не удалось автоматически создать базу данных');
          console.error('💡 Для облачных БД создайте базу данных вручную через панель управления провайдера');
          throw createError;
        }
      } else {
        throw new Error('База данных существует, но подключение не удалось. Проверьте настройки подключения.');
      }
    }

    console.log('🔍 Проверка структуры базы данных...');
    
    const tablesCheck = await checkTablesExist();
    
    if (!tablesCheck.allExist) {
      console.log('📦 Обнаружены отсутствующие таблицы:', tablesCheck.missingTables.join(', '));
      console.log('📦 Инициализация схемы базы данных...');
      await initDatabase();
      console.log('✅ База данных успешно инициализирована');
      return true;
    }
    
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

export async function initDatabase() {
  try {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Не удалось подключиться к базе данных');
    }

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    await query(schema);
    
    console.log('✅ База данных успешно инициализирована');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    throw error;
  }
}
