/**
 * modes/numerology.js
 * Numerology mode functionality for Lunora Telegram bot
 */

const { Markup } = require('telegraf');
const { deductCoins } = require('../helpers/utils');
const axios = require('axios');

/**
 * Configuration for numerology readings
 */
const config = {
  NUMEROLOGY_COST: 2, // Cost in coins
  LIFE_PATH_COST: 1,
  DESTINY_NUMBER_COST: 1,
  FULL_ANALYSIS_COST: 3
};

/**
 * Initialize the numerology mode handlers
 * @param {Object} bot - Telegraf bot instance
 */
function initNumerologyHandlers(bot) {
  // Main numerology menu
  bot.hears('🔢 Нумерологія', async (ctx) => {
    ctx.session.mode = 'numerology';
    ctx.session.numerologyState = 'menu';
    
    await ctx.reply(
      '🔢 *Нумерологія* - розкрийте таємниці чисел у вашому житті!\n\n' +
      'Оберіть тип нумерологічного аналізу:',
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['🛣️ Число життєвого шляху', '🌟 Число долі'],
          ['📊 Повний нумерологічний аналіз'],
          ['🔙 Назад до головного меню']
        ]).resize()
      }
    );
  });

  // Life Path Number
  bot.hears('🛣️ Число життєвого шляху', async (ctx) => {
    if (!deductCoins(ctx, config.LIFE_PATH_COST)) {
      return ctx.reply(
        `❌ Недостатньо монет! Необхідно: ${config.LIFE_PATH_COST} монет.\n` +
        'Перевірте баланс (/balance) або поповніть рахунок (/shop)'
      );
    }

    ctx.session.numerologyState = 'life_path_date';
    await ctx.reply(
      '🛣️ *Число життєвого шляху* розкриває ваші вроджені таланти і випробування.\n\n' +
      'Введіть дату вашого народження у форматі ДД.ММ.РРРР:',
      { parse_mode: 'Markdown' }
    );
  });

  // Destiny Number
  bot.hears('🌟 Число долі', async (ctx) => {
    if (!deductCoins(ctx, config.DESTINY_NUMBER_COST)) {
      return ctx.reply(
        `❌ Недостатньо монет! Необхідно: ${config.DESTINY_NUMBER_COST} монет.\n` +
        'Перевірте баланс (/balance) або поповніть рахунок (/shop)'
      );
    }

    ctx.session.numerologyState = 'destiny_name';
    await ctx.reply(
      '🌟 *Число долі* (або число виразу) розкриває ваші таланти та цілі.\n\n' +
      'Введіть ваше повне ім\'я при народженні:',
      { parse_mode: 'Markdown' }
    );
  });

  // Full Numerology Analysis
  bot.hears('📊 Повний нумерологічний аналіз', async (ctx) => {
    if (!deductCoins(ctx, config.FULL_ANALYSIS_COST)) {
      return ctx.reply(
        `❌ Недостатньо монет! Необхідно: ${config.FULL_ANALYSIS_COST} монет.\n` +
        'Перевірте баланс (/balance) або поповніть рахунок (/shop)'
      );
    }

    ctx.session.numerologyState = 'full_date';
    await ctx.reply(
      '📊 *Повний нумерологічний аналіз* включає всі важливі числа та їх вплив на ваше життя.\n\n' +
      'Спочатку введіть дату вашого народження у форматі ДД.ММ.РРРР:',
      { parse_mode: 'Markdown' }
    );
  });

  // Text input handler for numerology mode
  bot.on('text', async (ctx) => {
    if (ctx.session.mode !== 'numerology' || !ctx.session.numerologyState) {
      return;
    }

    const text = ctx.message.text;

    if (text === '🔙 Назад до головного меню') {
      ctx.session.mode = null;
      ctx.session.numerologyState = null;
      return ctx.scene.enter('home');
    }

    // Process input based on current state
    switch (ctx.session.numerologyState) {
      case 'life_path_date':
        await processLifePathDate(ctx, text);
        break;
      
      case 'destiny_name':
        await processDestinyName(ctx, text);
        break;
      
      case 'full_date':
        if (validateDateFormat(text)) {
          ctx.session.numerologyData = { birthDate: text };
          ctx.session.numerologyState = 'full_name';
          await ctx.reply('Тепер введіть ваше повне ім\'я при народженні:');
        } else {
          await ctx.reply('❌ Невірний формат дати. Будь ласка, використовуйте формат ДД.ММ.РРРР');
        }
        break;
      
      case 'full_name':
        await processFullAnalysis(ctx, ctx.session.numerologyData.birthDate, text);
        break;
    }
  });
}

/**
 * Calculate Life Path Number from birth date
 * @param {string} dateStr - Birth date in DD.MM.YYYY format
 * @returns {number} - Life Path Number (1-9, 11, 22, or 33)
 */
function calculateLifePathNumber(dateStr) {
  // Extract day, month, and year
  const [day, month, year] = dateStr.split('.').map(Number);
  
  // Sum all digits
  let daySum = sumDigits(day);
  let monthSum = sumDigits(month);
  let yearSum = sumDigits(year);
  
  // Sum the reduced numbers
  let sum = daySum + monthSum + yearSum;
  
  // Reduce to a single digit, preserving master numbers
  return reduceToSingleDigit(sum);
}

/**
 * Calculate Destiny Number from full name
 * @param {string} name - Full name
 * @returns {number} - Destiny Number (1-9, 11, 22, or 33)
 */
function calculateDestinyNumber(name) {
  const letterValues = {
    'a': 1, 'j': 1, 's': 1, 'а': 1, 'и': 1, 'с': 1, 'ъ': 1,
    'b': 2, 'k': 2, 't': 2, 'б': 2, 'й': 2, 'т': 2, 'ы': 2,
    'c': 3, 'l': 3, 'u': 3, 'в': 3, 'к': 3, 'у': 3, 'ь': 3,
    'd': 4, 'm': 4, 'v': 4, 'г': 4, 'л': 4, 'ф': 4, 'э': 4,
    'e': 5, 'n': 5, 'w': 5, 'д': 5, 'м': 5, 'х': 5, 'ю': 5,
    'f': 6, 'o': 6, 'x': 6, 'е': 6, 'н': 6, 'ц': 6, 'я': 6,
    'g': 7, 'p': 7, 'y': 7, 'ё': 7, 'о': 7, 'ч': 7, 'є': 7,
    'h': 8, 'q': 8, 'z': 8, 'ж': 8, 'п': 8, 'ш': 8, 'і': 8,
    'i': 9, 'r': 9, 'з': 9, 'р': 9, 'щ': 9, 'ї': 9,
  };
  
  // Convert to lowercase and remove non-alphabetic characters
  const cleanName = name.toLowerCase().replace(/[^a-zа-яїієъыьэюя]/g, '');
  
  // Sum up the values of each letter
  let sum = 0;
  for (const letter of cleanName) {
    if (letterValues[letter]) {
      sum += letterValues[letter];
    }
  }
  
  // Reduce to a single digit, preserving master numbers
  return reduceToSingleDigit(sum);
}

/**
 * Sum all digits in a number
 * @param {number} num - Number to sum digits from
 * @returns {number} - Sum of all digits
 */
function sumDigits(num) {
  return num.toString().split('').reduce((sum, digit) => sum + parseInt(digit), 0);
}

/**
 * Reduce a number to a single digit, preserving master numbers
 * @param {number} num - Number to reduce
 * @returns {number} - Reduced number (1-9, 11, 22, or 33)
 */
function reduceToSingleDigit(num) {
  // Check for master numbers
  if (num === 11 || num === 22 || num === 33) {
    return num;
  }
  
  // Reduce to a single digit
  while (num > 9) {
    num = sumDigits(num);
    // Check for master numbers after reduction
    if (num === 11 || num === 22 || num === 33) {
      return num;
    }
  }
  
  return num;
}

/**
 * Validate date format (DD.MM.YYYY)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} - True if valid format
 */
function validateDateFormat(dateStr) {
  // Simple regex for DD.MM.YYYY format
  const regex = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!regex.test(dateStr)) return false;
  
  // Extract parts and validate
  const [day, month, year] = dateStr.split('.').map(Number);
  
  // Basic validation
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  // More accurate day validation based on month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;
  
  return true;
}

/**
 * Get numerology interpretation from OpenAI
 * @param {Object} data - Numerology data
 * @returns {Promise<string>} - Interpretation text
 */
async function getNumerologyInterpretation(data) {
  try {
    // Replace with your OpenAI API call
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4.1-2025-04-14",
      messages: [
        {
          role: "system", 
          content: "You are a skilled numerologist. Provide an insightful interpretation for the user's numerology reading. Keep the tone mystical and reflective, but make it personal to their specific numbers."
        },
        {
          role: "user",
          content: `Generate a numerology reading for: ${JSON.stringify(data)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error getting numerology interpretation:', error);
    return 'Не вдалося отримати інтерпретацію. Спробуйте пізніше.';
  }
}

/**
 * Process Life Path Number calculation and send results
 * @param {Object} ctx - Telegraf context
 * @param {string} dateStr - Birth date string
 */
async function processLifePathDate(ctx, dateStr) {
  if (!validateDateFormat(dateStr)) {
    return ctx.reply('❌ Невірний формат дати. Будь ласка, використовуйте формат ДД.ММ.РРРР');
  }
  
  const lifePathNumber = calculateLifePathNumber(dateStr);
  
  ctx.reply('🔄 Обчислюю ваше число життєвого шляху...');
  
  // Get interpretation from OpenAI
  const interpretation = await getNumerologyInterpretation({
    type: 'lifePathNumber',
    number: lifePathNumber,
    birthDate: dateStr
  });
  
  await ctx.reply(
    `🛣️ *Ваше число життєвого шляху: ${lifePathNumber}*\n\n${interpretation}`,
    { 
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🔢 Нумерологія'],
        ['🔙 Назад до головного меню']
      ]).resize()
    }
  );
  
  ctx.session.numerologyState = 'menu';
}

/**
 * Process Destiny Number calculation and send results
 * @param {Object} ctx - Telegraf context
 * @param {string} name - Full name
 */
async function processDestinyName(ctx, name) {
  if (name.length < 2) {
    return ctx.reply('❌ Ім\'я занадто коротке. Будь ласка, введіть повне ім\'я.');
  }
  
  const destinyNumber = calculateDestinyNumber(name);
  
  ctx.reply('🔄 Обчислюю ваше число долі...');
  
  // Get interpretation from OpenAI
  const interpretation = await getNumerologyInterpretation({
    type: 'destinyNumber',
    number: destinyNumber,
    name: name
  });
  
  await ctx.reply(
    `🌟 *Ваше число долі: ${destinyNumber}*\n\n${interpretation}`,
    { 
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🔢 Нумерологія'],
        ['🔙 Назад до головного меню']
      ]).resize()
    }
  );
  
  ctx.session.numerologyState = 'menu';
}

/**
 * Process Full Numerology Analysis
 * @param {Object} ctx - Telegraf context
 * @param {string} dateStr - Birth date string
 * @param {string} name - Full name
 */
async function processFullAnalysis(ctx, dateStr, name) {
  const lifePathNumber = calculateLifePathNumber(dateStr);
  const destinyNumber = calculateDestinyNumber(name);
  const personalYearNumber = calculatePersonalYear(dateStr);
  
  ctx.reply('🔄 Створюю ваш повний нумерологічний аналіз...');
  
  // Get interpretation from OpenAI
  const interpretation = await getNumerologyInterpretation({
    type: 'fullAnalysis',
    lifePathNumber,
    destinyNumber,
    personalYearNumber,
    birthDate: dateStr,
    name: name
  });
  
  await ctx.reply(
    `📊 *Повний нумерологічний аналіз*\n\n` +
    `🛣️ *Число життєвого шляху:* ${lifePathNumber}\n` +
    `🌟 *Число долі:* ${destinyNumber}\n` +
    `📅 *Персональний рік:* ${personalYearNumber}\n\n` +
    interpretation,
    { 
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🔢 Нумерологія'],
        ['🔙 Назад до головного меню']
      ]).resize()
    }
  );
  
  ctx.session.numerologyState = 'menu';
  delete ctx.session.numerologyData;
}

/**
 * Calculate Personal Year Number
 * @param {string} birthDateStr - Birth date in DD.MM.YYYY format
 * @returns {number} - Personal Year Number
 */
function calculatePersonalYear(birthDateStr) {
  const [birthDay, birthMonth] = birthDateStr.split('.').map(Number);
  const currentYear = new Date().getFullYear();
  
  // Sum birth month, birth day and current year
  const sum = sumDigits(birthMonth) + sumDigits(birthDay) + sumDigits(currentYear);
  
  // Reduce to single digit
  return reduceToSingleDigit(sum);
}

module.exports = {
  initNumerologyHandlers,
  config
};
