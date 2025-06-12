// helpers/session.js - ініціалізація і middleware сесій
const { session } = require('telegraf');
const logger = require('./logger');

/**
 * Ініціалізація стандартної сесії
 * @returns {Function} Middleware для сесії
 */
function initSession() {
  return session();
}

/**
 * Middleware для перевірки наявності користувача в сесії
 * та його ініціалізації при необхідності
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Наступний обробник
 */
async function userMiddleware(ctx, next) {
  // Пропускаємо, якщо немає об'єкта from
  if (!ctx.from) return next();
  
  // Ініціалізуємо сесію, якщо її немає
  if (!ctx.session) ctx.session = {};
  
  // Ініціалізуємо об'єкт користувача, якщо його немає
  if (!ctx.session.user) {
    ctx.session.user = {
      id: ctx.from.id,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name || '',
      username: ctx.from.username || '',
      coins: 5, // Стартовий бонус
      subscriptions: [],
      created_at: new Date().toISOString()
    };
    
    logger.info(`New user initialized: ${ctx.from.id} (${ctx.from.username || 'no username'})`);
  }
  
  return next();
}

/**
 * Middleware для відстеження активності користувача
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Наступний обробник
 */
async function activityTracker(ctx, next) {
  if (ctx.from && ctx.session && ctx.session.user) {
    ctx.session.user.last_activity = new Date().toISOString();
    
    // Відстеження типу дій користувача (для аналітики)
    if (!ctx.session.user.activities) {
      ctx.session.user.activities = {};
    }
    
    const actionType = ctx.updateType || 'unknown';
    ctx.session.user.activities[actionType] = (ctx.session.user.activities[actionType] || 0) + 1;
  }
  
  return next();
}

/**
 * Middleware для відстеження стану користувача та режиму
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Наступний обробник
 */
async function stateTracker(ctx, next) {
  if (!ctx.session) ctx.session = {};
  
  // Ініціалізація об'єкта стану, якщо його немає
  if (!ctx.session.state) {
    ctx.session.state = {
      mode: null, // Поточний режим (TAROT, PALMISTRY, ASTROLOGY, NUMEROLOGY)
      step: null, // Поточний крок у діалозі
      data: {},   // Дані для поточного режиму/кроку
      history: [] // Історія дій користувача
    };
  }
  
  return next();
}

module.exports = {
  initSession,
  userMiddleware,
  activityTracker,
  stateTracker
};
