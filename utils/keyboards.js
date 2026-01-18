import { Markup } from 'telegraf';
import { BUTTONS, TIMEZONES } from '../config/texts.js';
import { hasReminder } from '../services/index.js';

// Создание inline-кнопок для разных шагов

export const keyboards = {
  // Главное меню (динамически показывает кнопку активных напоминаний)
  async mainMenu(userId = null) {
    const buttons = [
      [Markup.button.callback(BUTTONS.ABOUT_COMPANY, 'action:about_company')],
      [Markup.button.callback(BUTTONS.START_VITAMINS, 'action:start_vitamins')],
    ];
    
    // Показываем кнопку активных напоминаний только если они есть
    if (userId && await hasReminder(userId)) {
      buttons.push([
        Markup.button.callback(BUTTONS.ACTIVE_REMINDERS, 'action:active_reminders'),
      ]);
    }
    
    return Markup.inlineKeyboard(buttons);
  },

  // Выбор частоты приема
  dosageSelection() {
    return Markup.inlineKeyboard([
      [Markup.button.callback(BUTTONS.ONE_CAPSULE, 'action:one_capsule')],
      [Markup.button.callback(BUTTONS.TWO_CAPSULES, 'action:two_capsules')],
      [Markup.button.callback(BUTTONS.BACK, 'action:back_to_start')],
    ]);
  },

  // Выбор часового пояса
  timezoneSelection() {
    const buttons = TIMEZONES.map(tz => [
      Markup.button.callback(tz.label, `action:timezone:${tz.value}`)
    ]);
    buttons.push([Markup.button.callback(BUTTONS.BACK, 'action:back_to_dosage')]);
    return Markup.inlineKeyboard(buttons);
  },

  // Выбор времени (стандартные варианты)
  timeSelection() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(BUTTONS.TIME_8, 'action:time:08:00'),
        Markup.button.callback(BUTTONS.TIME_12, 'action:time:12:00'),
      ],
      [
        Markup.button.callback(BUTTONS.TIME_18, 'action:time:18:00'),
        Markup.button.callback(BUTTONS.TIME_21, 'action:time:21:00'),
      ],
      [Markup.button.callback(BUTTONS.CUSTOM_TIME, 'action:custom_time')],
      [Markup.button.callback(BUTTONS.BACK, 'action:back_to_timezone')],
    ]);
  },

  // Ввод своего времени
  customTimeInput() {
    return Markup.inlineKeyboard([
      [Markup.button.callback(BUTTONS.BACK, 'action:back_to_time_selection')],
    ]);
  },

  // Подтверждение
  confirmation() {
    return Markup.inlineKeyboard([
      [Markup.button.callback(BUTTONS.CONFIRM, 'action:confirm')],
      [Markup.button.callback(BUTTONS.BACK, 'action:back_to_time_selection')],
    ]);
  },

  // Главное меню (после настройки)
  async mainMenuAfterSetup(userId = null) {
    return await keyboards.mainMenu(userId);
  },
};
