// helpers/utils.js - допоміжні функції
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Ініціалізує нового користувача в сесії
 * @param {Object} ctx - Контекст Telegraf
 * @returns {Object} Об'єкт користувача
 */
function initUser(ctx) {
  ctx.session.user = {
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name || '',
    username: ctx.from.username || '',
    coins: 5, // Стартовий бонус
    subscriptions: [],
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString()
  };
  
  logger.info(`Initialized user: ${ctx.from.id} (${ctx.from.username || 'no username'})`);
  return ctx.session.user;
}

/**
 * Списує монети з балансу користувача
 * @param {Object} ctx - Контекст Telegraf
 * @param {Number} amount - Кількість монет для списання
 * @returns {Boolean} Результат операції (true - успіх, false - недостатньо монет)
 */
function deductCoins(ctx, amount) {
  if (!ctx.session.user) {
    initUser(ctx);
  }
  
  if (ctx.session.user.coins < amount) {
    return false;
  }
  
  ctx.session.user.coins -= amount;
  logger.info(`User ${ctx.from.id} spent ${amount} coins. New balance: ${ctx.session.user.coins}`);
  return true;
}

/**
 * Додає монети до балансу користувача
 * @param {Object} ctx - Контекст Telegraf
 * @param {Number} amount - Кількість монет для додавання
 * @returns {Number} Новий баланс користувача
 */
function addCoins(ctx, amount) {
  if (!ctx.session.user) {
    initUser(ctx);
  }
  
  ctx.session.user.coins += amount;
  logger.info(`User ${ctx.from.id} received ${amount} coins. New balance: ${ctx.session.user.coins}`);
  return ctx.session.user.coins;
}

/**
 * Випадково обирає елемент з масиву
 * @param {Array} array - Масив елементів
 * @returns {*} Випадковий елемент з масиву
 */
function drawRandom(array) {
  if (!Array.isArray(array) || array.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

/**
 * Випадково обирає набір унікальних елементів з масиву
 * @param {Array} array - Масив елементів
 * @param {Number} count - Кількість елементів для вибору
 * @returns {Array} Масив випадково обраних унікальних елементів
 */
function drawRandomSet(array, count) {
  if (!Array.isArray(array) || array.length === 0 || count <= 0) {
    return [];
  }
  
  // Обмежуємо кількість до доступного масиву
  count = Math.min(count, array.length);
  
  // Копіюємо масив для перемішування
  const shuffled = [...array];
  
  // Алгоритм Фішера-Єйтса для перемішування
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Повертаємо перші n елементів
  return shuffled.slice(0, count);
}

/**
 * Завантажує список файлів з вказаної директорії
 * @param {String} dir - Шлях до директорії
 * @param {String} ext - Розширення файлів для фільтрації (наприклад, '.jpg')
 * @returns {Array} Масив шляхів до файлів
 */
function loadFilesFromDir(dir, ext = '') {
  try {
    const dirPath = path.resolve(dir);
    if (!fs.existsSync(dirPath)) {
      logger.error(`Directory not found: ${dirPath}`);
      return [];
    }
    
    const files = fs.readdirSync(dirPath);
    
    if (ext) {
      return files
        .filter(file => file.endsWith(ext))
        .map(file => path.join(dirPath, file));
    }
    
    return files.map(file => path.join(dirPath, file));
  } catch (error) {
    logger.error('Error loading files:', error);
    return [];
  }
}

/**
 * Форматує дату для відображення користувачу
 * @param {Date|String} date - Об'єкт дати або рядок ISO
 * @returns {String} Форматована дата
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Генерує унікальний ID для об'єкту сесії
 * @returns {String} Унікальний ID
 */
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Додає підписку користувачу
 * @param {Object} ctx - Контекст Telegraf
 * @param {String} type - Тип підписки (TAROT, ASTROLOGY, etc.)
 * @param {String} frequency - Частота (daily, weekly)
 * @param {Number} durationDays - Тривалість підписки в днях
 * @returns {Object} Об'єкт підписки
 */
function addSubscription(ctx, type, frequency, durationDays) {
  if (!ctx.session.user) {
    initUser(ctx);
  }
  
  if (!ctx.session.user.subscriptions) {
    ctx.session.user.subscriptions = [];
  }
  
  // Видаляємо існуючу підписку того ж типу та частоти, якщо є
  ctx.session.user.subscriptions = ctx.session.user.subscriptions.filter(
    sub => !(sub.type === type && sub.frequency === frequency)
  );
  
  // Створюємо нову підписку
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  
  const subscription = {
    id: generateUniqueId(),
    type,
    frequency,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  
  ctx.session.user.subscriptions.push(subscription);
  logger.info(`User ${ctx.from.id} subscribed to ${type} (${frequency}) for ${durationDays} days`);
  
  return subscription;
}

module.exports = {
  initUser,
  deductCoins,
  addCoins,
  drawRandom,
  drawRandomSet,
  loadFilesFromDir,
  formatDate,
  generateUniqueId,
  addSubscription
};
