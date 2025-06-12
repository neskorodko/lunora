// bot.js - основний файл запуску бота Lunora
require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const fs = require('fs');
const path = require('path');

// Імпорт хелперів
const sessionHelper   = require('./helpers/session');
const paymentsHelper  = require('./helpers/payments');
const utils           = require('./helpers/utils');
const { setupTarotMode }       = require('./modes/tarot');
const { setupPalmReadingMode } = require('./modes/palmreading');
const { setupAstrologyMode }   = require('./modes/astrology');
const { initNumerologyHandlers } = require('./modes/numerology');
const cronJobs        = require('./helpers/cron');
const logger          = require('./helpers/logger');

// Створення директорій, якщо вони не існують
['logs', 'sessions'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    logger.info(`Created directory: ${dir}`);
  }
});

// Ініціалізація бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Налаштування сесій
const localSession = new LocalSession({
  database: 'sessions/sessions.json',
  storage: LocalSession.storageFileAsync,
  format: {
    serialize: (obj) => JSON.stringify(obj, null, 2),
    deserialize: (str) => JSON.parse(str),
  },
});

// Підключення middleware для сесій
bot.use(localSession.middleware());

// Середовище для обробки помилок
bot.catch((err, ctx) => {
  logger.error(`Error for ${ctx.updateType}`, err);
  ctx.reply('Сталася помилка. Спробуйте пізніше або зверніться до адміністратора.');
});

// Налаштування режимів перед стартом
setupTarotMode(bot);
setupPalmReadingMode(bot);
setupAstrologyMode(bot);
initNumerologyHandlers(bot);

// Команда запуску
bot.start(async (ctx) => {
  logger.info(`User ${ctx.from.id} started the bot`);
  // Ініціалізація користувача при першому запуску
  if (!ctx.session.user) {
    utils.initUser(ctx);
    await ctx.reply(`🌙 Вітаємо у Lunora! ${ctx.from.first_name}, ви отримали 5 монет на початок.`);
  } else {
    await ctx.reply(`🌙 З поверненням до Lunora, ${ctx.from.first_name}!`);
  }
  // Відображення головного меню
  showMainMenu(ctx);
});

// Команда перегляду балансу
bot.command('balance', (ctx) => {
  if (!ctx.session.user) utils.initUser(ctx);
  ctx.reply(`💰 Ваш баланс: ${ctx.session.user.coins} монет`);
});

// Команда магазину
bot.command('shop', (ctx) => {
  paymentsHelper.showShop(ctx);
});

// Обробка платежів
bot.on('pre_checkout_query', paymentsHelper.handlePreCheckout);
bot.on('successful_payment', paymentsHelper.handleSuccessfulPayment);

// Функція відображення головного меню
function showMainMenu(ctx) {
  ctx.reply('Оберіть режим:', {
    reply_markup: {
      keyboard: [
        [{ text: '🎴 ТАРО' }, { text: '✋ Гадання по руці' }],
        [{ text: '✨ Астрологія' }, { text: '🔢 Нумерологія' }],
        [{ text: '💰 Баланс' }, { text: '🛒 Магазин' }],
        [{ text: '📅 Мої підписки' }, { text: '❓ Допомога' }]
      ],
      resize_keyboard: true
    }
  });
}

// Обробники меню балансу та магазину
bot.hears('💰 Баланс', (ctx) => {
  if (!ctx.session.user) utils.initUser(ctx);
  ctx.reply(`💰 Ваш баланс: ${ctx.session.user.coins} монет`);
});

bot.hears('🛒 Магазин', (ctx) => {
  paymentsHelper.showShop(ctx);
});

// Обробник "Мої підписки"
bot.hears('📅 Мої підписки', (ctx) => {
  if (!ctx.session.user) utils.initUser(ctx);
  const subs = ctx.session.user.subscriptions || [];
  if (subs.length === 0) {
    return ctx.reply('У вас немає активних підписок. Ви можете оформити їх у відповідних розділах.');
  }
  let message = '📊 Ваші активні підписки:\n\n';
  subs.forEach((sub, i) => {
    message += `${i+1}. ${sub.type} - ${sub.frequency} (до ${new Date(sub.expiresAt).toLocaleDateString()})\n`;
  });
  message += '\nЩоб скасувати підписку, натисніть на відповідну кнопку нижче.';
  const buttons = subs.map((sub, i) => [{ text: `❌ Скасувати: ${sub.type} (${sub.frequency})`, callback_data: `unsub_${i}` }]);
  ctx.reply(message, { reply_markup: { inline_keyboard: buttons } });
});

// Обробник допомоги
bot.hears('❓ Допомога', (ctx) => {
  ctx.reply(
    '🌙 *Lunora* - ваш персональний бот для езотеричних практик\n\n' +
    '*Доступні режими:*\n' +
    '🎴 *ТАРО* - отримайте щоденний розклад або задайте конкретне питання\n' +
    '✋ *Гадання по руці* - завантажте фото своєї долоні для аналізу\n' +
    '✨ *Астрологія* - створіть вашу натальну карту\n' +
    '🔢 *Нумерологія* - розрахунок за іменем та датою народження\n\n' +
    '*Команди:*\n' +
    '/start - головне меню\n' +
    '/balance - перевірити баланс монет\n' +
    '/shop - придбати монети\n\n' +
    'За додатковими питаннями звертайтесь до підтримки: @lunora_support',
    { parse_mode: 'Markdown' }
  );
});

// Обробка колбеків для відписки
bot.action(/unsub_(\d+)/, (ctx) => {
  const idx = parseInt(ctx.match[1]);
  if (!ctx.session.user || !ctx.session.user.subscriptions) {
    return ctx.answerCbQuery('Помилка: підписки не знайдено');
  }
  if (idx >= 0 && idx < ctx.session.user.subscriptions.length) {
    const removed = ctx.session.user.subscriptions.splice(idx, 1)[0];
    ctx.answerCbQuery(`Ви скасували підписку: ${removed.type}`);
    ctx.reply(`✅ Підписка ${removed.type} (${removed.frequency}) успішно скасована!`);
    // Оновлення списку
    if (ctx.session.user.subscriptions.length === 0) {
      return ctx.editMessageText('У вас немає активних підписок.');
    }
    let msg = '📊 Ваші активні підписки:\n\n';
    ctx.session.user.subscriptions.forEach((sub, i) => {
      msg += `${i+1}. ${sub.type} - ${sub.frequency} (до ${new Date(sub.expiresAt).toLocaleDateString()})\n`;
    });
    const btns = ctx.session.user.subscriptions.map((sub, i) => [{ text: `❌ Скасувати: ${sub.type} (${sub.frequency})`, callback_data: `unsub_${i}` }]);
    ctx.editMessageText(msg, { reply_markup: { inline_keyboard: btns } });
  } else {
    ctx.answerCbQuery('Помилка: підписка не знайдена');
  }
});

// Запуск запланованих задач
cronJobs.initCronJobs(bot);

// Запуск бота
bot.launch()
  .then(() => {
    logger.info('🌙 Lunora bot успішно запущено!');
    console.log('🌙 Lunora bot успішно запущено!');
  })
  .catch(err => {
    logger.error('Помилка запуску бота:', err);
    console.error('Помилка запуску бота:', err);
  });

// Обробка завершення роботи
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
