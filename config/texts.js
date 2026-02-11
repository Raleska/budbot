import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let textsData;
try {
  const textsPath = join(__dirname, 'texts.json');
  const textsContent = readFileSync(textsPath, 'utf-8');
  textsData = JSON.parse(textsContent);
} catch (error) {
  console.error('❌ Ошибка при загрузке texts.json:', error.message);
  console.error('💡 Убедитесь, что файл config/texts.json существует');
  console.error('💡 Вы можете скопировать config/texts.example.json в config/texts.json');
  process.exit(1);
}

function replacePlaceholders(text, params = {}) {
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export const TEXTS = {
  WELCOME: textsData.TEXTS.WELCOME,
  SELECT_DOSAGE: textsData.TEXTS.SELECT_DOSAGE,
  SELECT_TIMEZONE: textsData.TEXTS.SELECT_TIMEZONE,
  SELECT_TIME_SINGLE: textsData.TEXTS.SELECT_TIME_SINGLE,
  SELECT_TIME_FIRST: textsData.TEXTS.SELECT_TIME_FIRST,
  SELECT_TIME_SECOND: textsData.TEXTS.SELECT_TIME_SECOND,
  ENTER_CUSTOM_TIME: textsData.TEXTS.ENTER_CUSTOM_TIME,
  
  CONFIRM_TIME_SINGLE: (time) => replacePlaceholders(textsData.TEXTS.CONFIRM_TIME_SINGLE, { time }),
  CONFIRM_TIME_FIRST: (time) => replacePlaceholders(textsData.TEXTS.CONFIRM_TIME_FIRST, { time }),
  CONFIRM_TIME_SECOND: (time) => replacePlaceholders(textsData.TEXTS.CONFIRM_TIME_SECOND, { time }),
  
  REMINDER_SET_SINGLE: (capsules, time, timezone) => 
    replacePlaceholders(textsData.TEXTS.REMINDER_SET_SINGLE, { time, timezone }),
  
  REMINDER_SET_DOUBLE: (capsules, time1, time2, timezone) => 
    replacePlaceholders(textsData.TEXTS.REMINDER_SET_DOUBLE, { time1, time2, timezone }),
  
  REMINDER_MESSAGE: (capsules) => textsData.TEXTS.REMINDER_MESSAGE,
  REMINDER_TAKEN_TEXT: textsData.TEXTS.REMINDER_TAKEN_TEXT,

  ACTIVE_REMINDERS_LIST: textsData.TEXTS.ACTIVE_REMINDERS_LIST,
  
  REMINDER_DETAILS: (capsules, time1, time2 = null) => {
    if (capsules === 1) {
      return replacePlaceholders(textsData.TEXTS.REMINDER_DETAILS_ONE, { time: time1 });
    } else {
      return replacePlaceholders(textsData.TEXTS.REMINDER_DETAILS_TWO, { time1, time2: time2 || time1 });
    }
  },
  
  NO_ACTIVE_REMINDERS: textsData.TEXTS.NO_ACTIVE_REMINDERS,
  ABOUT_COMPANY: textsData.TEXTS.ABOUT_COMPANY,
  INVALID_TIME_FORMAT: textsData.TEXTS.INVALID_TIME_FORMAT,
  INVALID_TIME_RANGE: textsData.TEXTS.INVALID_TIME_RANGE,
};

export const BUTTONS = textsData.BUTTONS;
export const TIMEZONES = textsData.TIMEZONES;
