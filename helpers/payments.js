// helpers/payments.js - логіка Telegram Payments
const { Markup } = require('telegraf');
const logger = require('./logger');

/**
 * Відображає магазин з різними пакетами монет
 * @param {Object} ctx - Контекст Telegraf
 */
function showShop(ctx) {
  const currency = process.env.CURRENCY || 'UAH';
  
  const prices = [
    { label: '20 монет', amount: 20, price: 29 },
    { label: '50 монет', amount: 50, price: 59 },
    { label: '100 монет', amount: 100, price: 99 },
    { label: '200 монет', amount: 200, price: 179 }
  ];
  
  const buttons = prices.map(item => {
    return [
      Markup.button.callback(
        `${item.label} - ${item.price} ${currency}`, 
        `buy_${item.amount}_${item.price}`
      )
    ];
  });
  
  ctx.reply('🛒 Оберіть пакет монет для покупки:', {
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [Markup.button.callback('❌ Закрити', 'close_shop')]
      ]
    }
  });
}

/**
 * Обробляє колбек для покупки монет
 * @param {Object} ctx - Контекст Telegraf
 */
function handleBuyCallback(ctx) {
  const match = ctx.match[0].match(/buy_(\d+)_(\d+)/);
  if (!match) return;
  
  const amount = parseInt(match[1]);
  const price = parseInt(match[2]);
  const currency = process.env.CURRENCY || 'UAH';
  
  if (!process.env.PROVIDER_TOKEN) {
    ctx.reply('⚠️ Налаштування платежів не завершено. Зверніться до адміністратора.');
    logger.error('PROVIDER_TOKEN не налаштовано');
    return;
  }
  
  // Створення платіжного інвойса
  ctx.replyWithInvoice({
    title: `${amount} монет для Lunora`,
    description: `Поповнення балансу на ${amount} монет для більше доступу до функцій`,
    payload: `coins_${amount}`,
    provider_token: process.env.PROVIDER_TOKEN,
    currency,
    prices: [{ label: `${amount} монет`, amount: price * 100 }], // у копійках
    start_parameter: 'get_coins'
  });
  
  logger.info(`User ${ctx.from.id} initiated purchase of ${amount} coins`);
}

/**
 * Обробник pre_checkout_query для Telegram Payments
 * @param {Object} ctx - Контекст Telegraf
 */
function handlePreCheckout(ctx) {
  // Підтвердження запиту на передплату
  ctx.answerPreCheckoutQuery(true);
  logger.info(`Pre-checkout confirmed for user ${ctx.from.id}`);
}

/**
 * Обробник successful_payment для Telegram Payments
 * @param {Object} ctx - Контекст Telegraf
 */
function handleSuccessfulPayment(ctx) {
  const payload = ctx.update.message.successful_payment.invoice_payload;
  const match = payload.match(/coins_(\d+)/);
  
  if (!match) {
    logger.error(`Invalid payment payload: ${payload}`);
    ctx.reply('⚠️ Помилка з платежем. Зверніться до підтримки.');
    return;
  }
  
  const amount = parseInt(match[1]);
  
  // Ініціалізація користувача, якщо це перший платіж
  if (!ctx.session.user) {
    ctx.session.user = {
      id: ctx.from.id,
      coins: 0,
      subscriptions: []
    };
  }
  
  // Додавання монет користувачу
  ctx.session.user.coins += amount;
  
  ctx.reply(
    `✅ Оплата успішна!\n\n` +
    `🪙 Додано ${amount} монет до вашого балансу.\n` +
    `💰 Новий баланс: ${ctx.session.user.coins} монет`
  );
  
  logger.info(`User ${ctx.from.id} successfully purchased ${amount} coins. New balance: ${ctx.session.user.coins}`);
}

/**
 * Закриття вікна магазину
 * @param {Object} ctx - Контекст Telegraf
 */
function closeShop(ctx) {
  ctx.deleteMessage();
  ctx.answerCbQuery('Магазин закрито');
}

// Реєстрація обробників магазину
function registerHandlers(bot) {
  bot.action(/buy_\d+_\d+/, handleBuyCallback);
  bot.action('close_shop', closeShop);
}

module.exports = {
  showShop,
  handlePreCheckout,
  handleSuccessfulPayment,
  registerHandlers
};
