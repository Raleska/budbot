export function isValidTime(timeString) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}

export function normalizeTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return '12:00';
  }
  
  const [hours, minutes] = timeString.split(':');
  if (!hours || !minutes) {
    return '12:00';
  }
  
  const normalizedHours = hours.padStart(2, '0');
  const normalizedMinutes = minutes.padStart(2, '0');
  return `${normalizedHours}:${normalizedMinutes}`;
}

export const validators = {
  isValidTime,
  normalizeTime,
};
