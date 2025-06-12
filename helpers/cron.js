// helpers/cron.js - заплановані завдання
const CronJob = require('cron');
const logger = require('./logger');
const tarotModule = require('../modes/tarot');
const utils = require('./utils');

/**
 * Відправляє щоденний розклад ТАРО підписникам
 * @param {Object} bot - Екземпляр бота Telegraf
 */
async function sendDailyTarotReading(bot) {
  logger.info('Starting daily tarot reading task');
  
  try {
    // Отримуємо сесії усіх користувачів через прямий доступ до localSession
    const sessions = bot.context.session.DB.get('sessions').value();
    
    if (!sessions || !Array.isArray(sessions)) {
      logger.warning('No sessions found for daily tarot reading');
      return;
    }
    
    // Проходимо по всіх сесіях та перевіряємо підписки
    let sentCount = 0;
    
    for (const session of sessions) {
      // Перевіряємо наявність user та subscriptions
      if (!session.user || !session.user.subscriptions || !Array.isArray(session.user.subscriptions)) {
        continue;
      }
      
      // Фільтруємо активні щоденні підписки на ТАРО
      const activeTarotDailySubscriptions = session.user.subscriptions.filter(sub => {
        return sub.type === 'TAROT' && 
               sub.frequency === 'daily' && 
               new Date(sub.expiresAt) > new Date();
      });
      
      // Якщо є активні підписки - відправляємо розклад
      if (activeTarotDailySubscriptions.length > 0) {
        try {
          await tarotModule.sendDailyTarotReading(bot, session.user.id);
          sentCount++;
        } catch (err) {
          logger.error(`Failed to send daily tarot reading to user ${session.user.id}`, err);
        }
      }
    }
    
    logger.info(`Daily tarot readings sent to ${sentCount} subscribers`);
  } catch (error) {
    logger.error('Error in daily tarot reading cron job', error);
  }
}

/**
 * Відправляє щотижневий розклад ТАРО підписникам
 * @param {Object} bot - Екземпляр бота Telegraf
 */
async function sendWeeklyTarotReading(bot) {
  logger.info('Starting weekly tarot reading task');
  
  try {
    // Отримуємо сесії усіх користувачів через прямий доступ до localSession
    const sessions = bot.context.session.DB.get('sessions').value();
    
    if (!sessions || !Array.isArray(sessions)) {
      logger.warning('No sessions found for weekly tarot reading');
      return;
    }
    
    // Проходимо по всіх сесіях та перевіряємо підписки
    let sentCount = 0;
    
    for (const session of sessions) {
      // Перевіряємо наявність user та subscriptions
      if (!session.user || !session.user.subscriptions || !Array.isArray(session.user.subscriptions)) {
        continue;
      }
      
      // Фільтруємо активні щотижневі підписки на ТАРО
      const activeTarotWeeklySubscriptions = session.user.subscriptions.filter(sub => {
        return sub.type === 'TAROT' && 
               sub.frequency === 'weekly' && 
               new Date(sub.expiresAt) > new Date();
      });
      
      // Якщо є активні підписки - відправляємо розклад
      if (activeTarotWeeklySubscriptions.length > 0) {
        try {
          await tarotModule.sendWeeklyTarotReading(bot, session.user.id);
          sentCount++;
        } catch (err) {
          logger.error(`Failed to send weekly tarot reading to user ${session.user.id}`, err);
        }
      }
    }
    
    logger.info(`Weekly tarot readings sent to ${sentCount} subscribers`);
  } catch (error) {
    logger.error('Error in weekly tarot reading cron job', error);
  }
}

/**
 * Очищення старих підписок, які закінчились
 * @param {Object} bot - Екземпляр бота Telegraf
 */
async function cleanupExpiredSubscriptions(bot) {
  logger.info('Starting expired subscriptions cleanup task');
  
  try {
    // Отримуємо сесії усіх користувачів через прямий доступ до localSession
    const sessions = bot.context.session.DB.get('sessions').value();
    
    if (!sessions || !Array.isArray(sessions)) {
      logger.warning('No sessions found for cleanup');
      return;
    }
    
    const now = new Date();
    let cleanupCount = 0;
    
    for (const session of sessions) {
      // Перевіряємо наявність user та subscriptions
      if (!session.user || !session.user.subscriptions || !Array.isArray(session.user.subscriptions)) {
        continue;
      }
      
      const originalCount = session.user.subscriptions.length;
      
      // Фільтруємо та залишаємо тільки активні підписки
      session.user.subscriptions = session.user.subscriptions.filter(sub => {
        return new Date(sub.expiresAt) > now;
      });
      
      const removedCount = originalCount - session.user.subscriptions.length;
      cleanupCount += removedCount;
      
      // Якщо були видалені підписки - повідомляємо користувача
      if (removedCount > 0) {
        try {
          await bot.telegram.sendMessage(
            session.user.id,
            `📢 *Повідомлення про підписки*\n\n${removedCount} ${removedCount === 1 ? 'підписка закінчилась' : 'підписок закінчились'}. Ви можете оновити їх у меню "📅 Мої підписки".`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          logger.error(`Failed to notify user ${session.user.id} about expired subscriptions`, err);
        }
      }
    }
    
    // Зберігаємо оновлені сесії
    bot.context.session.DB.write();
    
    logger.info(`Cleaned up ${cleanupCount} expired subscriptions`);
  } catch (error) {
    logger.error('Error in expired subscriptions cleanup job', error);
  }
}

/**
 * Ініціалізує всі заплановані завдання
 * @param {Object} bot - Екземпляр бота Telegraf
 */
function initCronJobs(bot) {
  // Щоденний розклад ТАРО (о 8:00)
  const dailyTarotJob = new CronJob.CronJob(
    '0 8 * * *', // кожен день о 8:00
    () => sendDailyTarotReading(bot),
    null,
    true,
    'Europe/Kiev'
  );
  
  // Щотижневий розклад ТАРО (щопонеділка о 9:00)
  const weeklyTarotJob = new CronJob.CronJob(
    '0 9 * * 1', // щопонеділка о 9:00
    () => sendWeeklyTarotReading(bot),
    null,
    true,
    'Europe/Kiev'
  );
  
  // Очищення старих підписок (щодня о 3:00)
  const cleanupSubscriptionsJob = new CronJob.CronJob(
    '0 3 * * *', // щодня о 3:00
    () => cleanupExpiredSubscriptions(bot),
    null,
    true,
    'Europe/Kiev'
  );
  
  logger.info('All cron jobs initialized');
  
  return {
    dailyTarotJob,
    weeklyTarotJob,
    cleanupSubscriptionsJob
  };
}

module.exports = {
  initCronJobs,
  sendDailyTarotReading,
  sendWeeklyTarotReading,
  cleanupExpiredSubscriptions
};
