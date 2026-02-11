const USE_DATABASE = process.env.USE_DATABASE !== 'false';

let userStateService, reminderService, analyticsService;

if (USE_DATABASE) {
  const userStateModule = await import('./userState.js');
  userStateService = userStateModule.userStateService;
  reminderService = await import('./reminderService.js');
  analyticsService = await import('./userAnalytics.js');
} else {
  const userStateModule = await import('./userStateMemory.js');
  userStateService = userStateModule.userStateServiceMemory;
  reminderService = await import('./reminderServiceMemory.js');
  analyticsService = await import('./userAnalyticsMemory.js');
}

export { userStateService };
export const {
  addReminder,
  removeReminder,
  getReminder,
  hasReminder,
  getAllReminders,
  loadAllReminders,
  scheduleSnooze,
} = reminderService;

export const {
  trackInteraction,
  trackReminderSetup,
  trackReminderChange,
  trackTimezoneSelection,
  trackTimeSelection,
  getUserData,
  getAllUserData,
  getStatistics,
  exportData,
} = analyticsService;
