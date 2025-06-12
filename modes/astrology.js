/**
 * Модуль для режиму астрології
 * @module modes/astrology
 */

const { Markup } = require('telegraf');
const { deductCoins, logActivity } = require('../helpers/utils');
const { callOpenAI } = require('../helpers/openai');

/**
 * Регулярний вираз для перевірки дати у форматі DD.MM.YYYY
 */
const DATE_REGEX = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d\d$/;

/**
 * Регулярний вираз для перевірки часу у форматі HH:MM
 */
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Налаштування режиму астрології для бота
 * @param {Telegraf} bot - Екземпляр Telegraf бота
 */
function setupAstrologyMode(bot) {
  // Меню режиму астрології
  const astrologyMenuKeyboard = Markup.keyboard([
    ['🌟 Натальна карта', '🌓 Щоденний гороскоп'],
    ['🌙 Сумісність знаків', '📅 Астрологічний прогноз'],
    ['🔄 Повернутися в головне меню']
  ]).resize();

  // Клавіатура для вибору знаку зодіаку
  const zodiacSignsKeyboard = Markup.keyboard([
    ['♈ Овен', '♉ Телець', '♊ Близнюки'],
    ['♋ Рак', '♌ Лев', '♍ Діва'],
    ['♎ Терези', '♏ Скорпіон', '♐ Стрілець'],
    ['♑ Козеріг', '♒ Водолій', '♓ Риби'],
    ['🔄 Назад до меню астрології']
  ]).resize();

  // Обробка вибору режиму астрології
  bot.hears('✨ Астрологія', async (ctx) => {
    ctx.session.mode = 'astrology';
    ctx.session.astrologyData = {}; // Ініціалізація об'єкту для даних астрології
    await ctx.reply('Ви вибрали режим Астрології. Оберіть послугу:', astrologyMenuKeyboard);
    logActivity(ctx, 'Відкрив режим астрології');
  });

  // Повернення до меню астрології
  bot.hears('🔄 Назад до меню астрології', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    ctx.session.astrologyData = {}; // Скидання даних
    ctx.session.astrologyAction = null; // Скидання дії
    await ctx.reply('Оберіть послугу астрології:', astrologyMenuKeyboard);
  });

  // Створення натальної карти
  bot.hears('🌟 Натальна карта', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    const COST = 5; // Вартість створення натальної карти - 5 монет
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для створення натальної карти. Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }
    
    ctx.session.astrologyAction = 'natal_chart';
    ctx.session.astrologyData = {}; // Очищення попередніх даних
    
    await ctx.reply(`Створення натальної карти (витрачено ${COST} монет).
    
Будь ласка, вкажіть дату вашого народження у форматі ДД.ММ.РРРР
Наприклад: 15.06.1990`);
    
    logActivity(ctx, 'Почав створення натальної карти');
  });
  
  // Щоденний гороскоп (безкоштовно)
  bot.hears('🌓 Щоденний гороскоп', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    ctx.session.astrologyAction = 'daily_horoscope';
    await ctx.reply('Оберіть свій знак зодіаку для отримання щоденного гороскопу:', zodiacSignsKeyboard);
    
    logActivity(ctx, 'Запитав щоденний гороскоп');
  });
  
  // Сумісність знаків (2 монети)
  bot.hears('🌙 Сумісність знаків', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    const COST = 2; // Вартість аналізу сумісності - 2 монети
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для аналізу сумісності. Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }
    
    ctx.session.astrologyAction = 'compatibility';
    ctx.session.astrologyData = {
      cost: COST
    };
    
    await ctx.reply(`Аналіз сумісності знаків (витрачено ${COST} монет).
    
Спочатку оберіть перший знак зодіаку:`, zodiacSignsKeyboard);
    
    logActivity(ctx, 'Почав аналіз сумісності знаків');
  });
  
  // Астрологічний прогноз (3 монети)
  bot.hears('📅 Астрологічний прогноз', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    const COST = 3; // Вартість астрологічного прогнозу - 3 монети
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для астрологічного прогнозу. Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }
    
    ctx.session.astrologyAction = 'forecast';
    ctx.session.astrologyData = {};
    
    await ctx.reply(`Астрологічний прогноз на 3 місяці (витрачено ${COST} монет).
    
Будь ласка, вкажіть вашу дату народження у форматі ДД.ММ.РРРР
Наприклад: 15.06.1990`);
    
    logActivity(ctx, 'Почав отримання астрологічного прогнозу');
  });
  
  // Обробка вибору знаків зодіаку
  bot.hears([
    '♈ Овен', '♉ Телець', '♊ Близнюки', '♋ Рак', '♌ Лев', '♍ Діва',
    '♎ Терези', '♏ Скорпіон', '♐ Стрілець', '♑ Козеріг', '♒ Водолій', '♓ Риби'
  ], async (ctx) => {
    if (ctx.session.mode !== 'astrology') return; 
    
    const sign = ctx.message.text;
    const action = ctx.session.astrologyAction;
    
    if (!action) {
      await ctx.reply('Спочатку оберіть тип астрологічного аналізу з меню.');
      return;
    }
    
    // Щоденний гороскоп - безкоштовно
    if (action === 'daily_horoscope') {
      try {
        await ctx.reply(`Генерую щоденний гороскоп для знаку ${sign}...`);
        
        const prompt = `Ти - професійний астролог. Склади детальний щоденний гороскоп для знаку ${sign} на сьогодні.
        Включи загальну тенденцію дня, аспекти щодо кар'єри, фінансів, здоров'я, любові та особистого розвитку.
        Додай практичні рекомендації на день. Пиши українською мовою, глибоко, але доступно.`;
        
        const horoscope = await callOpenAI(prompt);
        await ctx.reply(horoscope);
        
        // Скидання дії
        ctx.session.astrologyAction = null;
        
        logActivity(ctx, `Отримав щоденний гороскоп для знаку ${sign}`);
      } catch (error) {
        console.error('Помилка при генерації щоденного гороскопу:', error);
        await ctx.reply('Виникла помилка при генерації гороскопу. Спробуйте пізніше.');
      }
      return;
    }
    
    // Аналіз сумісності - потрібні два знаки
    if (action === 'compatibility') {
      const data = ctx.session.astrologyData;
      
      if (!data.firstSign) {
        // Запам'ятовуємо перший знак
        data.firstSign = sign;
        await ctx.reply(`Перший знак: ${sign}
        
Тепер оберіть другий знак зодіаку для аналізу сумісності:`, zodiacSignsKeyboard);
      } else {
        // Маємо обидва знаки, робимо аналіз
        const firstSign = data.firstSign;
        const secondSign = sign;
        
        try {
          await ctx.reply(`Аналізую сумісність знаків ${firstSign} та ${secondSign}...`);
          
          const prompt = `Ти - професійний астролог з великим досвідом. Зроби детальний аналіз сумісності між знаками ${firstSign} та ${secondSign}.
          Розбери такі аспекти:
          - Загальна сумісність та потенціал відносин
          - Романтична та емоційна сумісність
          - Сексуальна гармонія
          - Інтелектуальне порозуміння
          - Довготривалі перспективи
          - Потенційні виклики у стосунках та як їх подолати
          
          Дай оцінку сумісності за 10-бальною шкалою для кожного аспекту.
          Пиши українською мовою, глибоко, але зрозуміло для людей без астрологічних знань.`;
          
          const compatibility = await callOpenAI(prompt);
          await ctx.reply(compatibility);
          
          // Скидання дії та даних
          ctx.session.astrologyAction = null;
          ctx.session.astrologyData = {};
          
          logActivity(ctx, `Отримав аналіз сумісності знаків ${firstSign} і ${secondSign}`);
        } catch (error) {
          console.error('Помилка при аналізі сумісності:', error);
          await ctx.reply('Виникла помилка при аналізі сумісності. Спробуйте пізніше.');
          
          // Повертаємо монети у випадку помилки
          ctx.session.user.coins += data.cost;
        }
      }
      return;
    }
  });
  
  // Обробка текстових повідомлень для введення дати та часу
  bot.on('text', async (ctx) => {
    if (ctx.session.mode !== 'astrology') return;
    
    const action = ctx.session.astrologyAction;
    if (!action) return; // Немає активної дії
    
    const text = ctx.message.text;
    const data = ctx.session.astrologyData || {};
    
    // Обробка дати народження для натальної карти або прогнозу
    if ((action === 'natal_chart' || action === 'forecast') && !data.birthDate) {
      if (DATE_REGEX.test(text)) {
        // Дата в правильному форматі
        data.birthDate = text;
        
        if (action === 'natal_chart') {
          await ctx.reply(`Дата народження: ${text}
          
Тепер вкажіть час народження у форматі ГГ:ХХ (наприклад 14:30)
Якщо точний час невідомий, вкажіть приблизний або напишіть "невідомо"`);
        } else if (action === 'forecast') {
          // Для прогнозу достатньо дати
          try {
            await ctx.reply(`Генерую астрологічний прогноз на 3 місяці для особи, що народилася ${data.birthDate}...`);
            
            const prompt = `Ти - професійний астролог з багаторічним досвідом. Створи детальний астрологічний прогноз на наступні 3 місяці для людини, що народилася ${data.birthDate}.
            
            Прогноз має містити:
            1. Загальні тенденції та ключові космічні впливи на період
            2. Окремі розділи по місяцях з точними датами важливих планетарних аспектів
            3. Детальний аналіз за сферами: кар'єра/робота, фінанси, здоров'я, особисті стосунки
            4. Особливо сприятливі та несприятливі дні
            5. Практичні рекомендації для максимально успішного проходження періоду
            
            Пиши українською мовою. Уникай загальних фраз, які підходять всім. Будь конкретним і давай чіткі прогнози з прив'язкою до дат.`;
            
            const forecast = await callOpenAI(prompt);
            await ctx.reply(forecast);
            
            // Скидання дії та даних
            ctx.session.astrologyAction = null;
            ctx.session.astrologyData = {};
            
            logActivity(ctx, 'Отримав астрологічний прогноз на 3 місяці');
          } catch (error) {
            console.error('Помилка при генерації прогнозу:', error);
            await ctx.reply('Виникла помилка при генерації прогнозу. Спробуйте пізніше.');
            
            // Повертаємо монети у випадку помилки (3 монети)
            ctx.session.user.coins += 3;
          }
        }
      } else {
        await ctx.reply('Невірний формат дати. Будь ласка, введіть дату у форматі ДД.ММ.РРРР (наприклад: 15.06.1990)');
      }
      return;
    }
    
    // Обробка часу народження для натальної карти
    if (action === 'natal_chart' && data.birthDate && !data.birthTime) {
      let validTime = true;
      
      if (text.toLowerCase() === 'невідомо') {
        data.birthTime = '12:00'; // Використовуємо полудень за замовчуванням
      } else if (TIME_REGEX.test(text)) {
        data.birthTime = text;
      } else {
        validTime = false;
        await ctx.reply('Невірний формат часу. Будь ласка, введіть час у форматі ГГ:ХХ (наприклад: 14:30) або напишіть "невідомо"');
      }
      
      if (validTime) {
        await ctx.reply(`Час народження: ${data.birthTime}
        
Тепер вкажіть місце народження (місто, країну)`);
      }
      return;
    }
    
    // Обробка місця народження для натальної карти
    if (action === 'natal_chart' && data.birthDate && data.birthTime && !data.birthPlace) {
      data.birthPlace = text;
      
      try {
        await ctx.reply(`Створюю натальну карту для:
        
Дата народження: ${data.birthDate}
Час народження: ${data.birthTime}
Місце народження: ${data.birthPlace}

Це може зайняти кілька хвилин...`);
        
        // Тут має бути логіка створення натальної карти
        // В реальній реалізації ми б використовували спеціалізовану бібліотеку
        // або API для побудови справжньої натальної карти
        
        // Запит до OpenAI для інтерпретації натальної карти
        const prompt = `Ти - професійний астролог з багаторічним досвідом. Створи детальну інтерпретацію натальної карти для людини з такими даними:
        
        Дата народження: ${data.birthDate}
        Час народження: ${data.birthTime}
        Місце народження: ${data.birthPlace}
        
        Аналіз має містити:
        1. Знак сонця, місяця та асцендент
        2. Положення всіх планет в знаках та домах
        3. Ключові аспекти між планетами
        4. Детальний опис особистості та характеру
        5. Таланти та сильні сторони
        6. Потенційні виклики та як їх подолати
        7. Рекомендації щодо життєвого шляху
        
        Пиши українською мовою, структуровано, з підзаголовками для кращого сприйняття. Уникай надто технічних астрологічних термінів.`;
        
        const interpretation = await callOpenAI(prompt);
        
        // Відправляємо інтерпретацію частинами через обмеження Telegram
        const maxLength = 4000;
        for (let i = 0; i < interpretation.length; i += maxLength) {
          await ctx.reply(interpretation.substring(i, i + maxLength));
        }
        
        // Скидання дії та даних
        ctx.session.astrologyAction = null;
        ctx.session.astrologyData = {};
        
        logActivity(ctx, 'Отримав натальну карту');
      } catch (error) {
        console.error('Помилка при створенні натальної карти:', error);
        await ctx.reply('Виникла помилка при створенні натальної карти. Спробуйте пізніше.');
        
        // Повертаємо монети у випадку помилки (5 монет)
        ctx.session.user.coins += 5;
      }
      return;
    }
  });
}

module.exports = {
  setupAstrologyMode
};
