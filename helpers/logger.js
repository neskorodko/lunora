// helpers/logger.js - модуль для логування
const fs = require('fs');
const path = require('path');

// Створюємо директорію для логів, якщо її немає
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Записує лог у файл
 * @param {String} level - Рівень логу (info, error, warning)
 * @param {String} message - Повідомлення для запису
 * @param {Object} data - Додаткові дані для запису
 */
function writeLog(level, message, data = null) {
  const now = new Date();
  const dateStr = now.toISOString();
  const logFileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.log`;
  const logPath = path.join(logDir, logFileName);
  
  let logEntry = `[${dateStr}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    if (data instanceof Error) {
      logEntry += `\nStack: ${data.stack}`;
    } else {
      try {
        logEntry += `\nData: ${JSON.stringify(data)}`;
      } catch (e) {
        logEntry += `\nData: [Cannot stringify data]`;
      }
    }
  }
  
  logEntry += '\n';
  
  fs.appendFile(logPath, logEntry, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
  
  // Також виводимо в консоль для розробки
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}] ${message}`);
    if (data && data instanceof Error) {
      console.error(data);
    }
  }
}

/**
 * Запис інформаційного повідомлення
 * @param {String} message - Повідомлення для запису
 * @param {Object} data - Додаткові дані для запису
 */
function info(message, data = null) {
  writeLog('info', message, data);
}

/**
 * Запис попередження
 * @param {String} message - Повідомлення для запису
 * @param {Object} data - Додаткові дані для запису
 */
function warning(message, data = null) {
  writeLog('warning', message, data);
}

/**
 * Запис помилки
 * @param {String} message - Повідомлення для запису
 * @param {Object} data - Додаткові дані для запису
 */
function error(message, data = null) {
  writeLog('error', message, data);
}

/**
 * Запис повідомлення про дію користувача
 * @param {Object} ctx - Контекст Telegraf
 * @param {String} action - Тип дії
 * @param {Object} data - Додаткові дані для запису
 */
function userAction(ctx, action, data = null) {
  const userId = ctx.from ? ctx.from.id : 'unknown';
  const username = ctx.from ? ctx.from.username || 'no username' : 'unknown';
  
  const message = `User ${userId} (${username}) performed action: ${action}`;
  writeLog('info', message, data);
}

module.exports = {
  info,
  warning,
  error,
  userAction
};
