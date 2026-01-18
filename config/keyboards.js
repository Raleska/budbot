/**
 * Клавиатуры для бота
 */

import { Markup } from 'telegraf';

export const getMainKeyboard = () => {
  return Markup.keyboard([
    ['➕ Создать напоминание', '📋 Список напоминаний']
  ]).resize();
};

export const getCancelKeyboard = () => {
  return Markup.keyboard([
    ['❌ Отмена']
  ]).resize();
};

export const removeKeyboard = () => {
  return Markup.removeKeyboard();
};
