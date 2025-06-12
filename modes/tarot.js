/**
 * Модуль для роботи з Таро - читання, розклади, інтерпретації
 * @module modes/tarot
 */

const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { deductCoins, logActivity } = require('../helpers/utils');
const { callOpenAI } = require('../helpers/openai');


// Шлях до директорії з картами ТАРО
const TAROT_PATH = path.join(__dirname, '../assets/tarot');

// Масив з усіма картами ТАРО (буде заповнений після перевірки директорії)
let tarotCards = [];

/**
 * Завантаження всіх карт ТАРО з директорії
 */
function loadTarotCards() {
  try {
    if (fs.existsSync(TAROT_PATH)) {
      const files = fs.readdirSync(TAROT_PATH);
      tarotCards = files
        .filter(file => file.endsWith('.jpg'))
        .map(file => {
          const nameWithoutExt = file.replace('.jpg', '');
          const [number, ...nameParts] = nameWithoutExt.split('-');
          const name = nameParts.join('-');
          return {
            id: number,
            name: name,
            file: file,
            path: path.join(TAROT_PATH, file)
          };
        });
      console.log(`Завантажено ${tarotCards.length} карт ТАРО`);
    } else {
      console.warn(`Директорія з картами ТАРО не знайдена: ${TAROT_PATH}`);
    }
  } catch (err) {
    console.error('Помилка при завантаженні карт ТАРО:', err);
  }
}

/**
 * Вибір випадкової карти ТАРО
 * @returns {Object|null} Випадкова карта або null, якщо карт немає
 */
function drawRandomCard() {
  if (tarotCards.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * tarotCards.length);
  return tarotCards[randomIndex];
}

/**
 * Вибір вказаної кількості випадкових карт без повторень
 * @param {number} count - Кількість карт для вибору
 * @returns {Array} Масив унікальних випадкових карт
 */
function drawMultipleCards(count) {
  if (tarotCards.length === 0) return [];
  const cardsCopy = [...tarotCards];
  const selectedCards = [];
  
  for (let i = 0; i < count && cardsCopy.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * cardsCopy.length);
    selectedCards.push(cardsCopy.splice(randomIndex, 1)[0]);
  }
  
  return selectedCards;
}

/**
 * Налаштування режиму ТАРО для бота
 * @param {Telegraf} bot - Екземпляр Telegraf бота
 */
function setupTarotMode(bot) {
  // Завантаження карт при ініціалізації
  loadTarotCards();

  // Головне меню ТАРО
  const tarotMenuKeyboard = Markup.keyboard([
    ['🔮 Карта дня', '🌙 Простий розклад'],
    ['💫 Кельтський хрест', '💝 Любовний розклад'],
    ['🔄 Повернутися в головне меню']
  ]).resize();

  // Обробка вибору режиму ТАРО
  bot.hears('🎴 ТАРО', async (ctx) => {
    ctx.session.mode = 'tarot';
    await ctx.reply('Ви вибрали режим ТАРО. Оберіть тип розкладу:', tarotMenuKeyboard);
    logActivity(ctx, 'Відкрив режим ТАРО');
  });

  // Повернення в головне меню
  bot.hears('🔄 Повернутися в головне меню', async (ctx) => {
    ctx.session.mode = null;
    await ctx.reply('Головне меню:', Markup.keyboard([
      ['🎴 ТАРО', '✋ Гадання по руці'],
      ['✨ Астрологія', '🔢 Нумерологія'],
      ['💰 Баланс', '🛒 Магазин']
    ]).resize());
  });

  // Карта дня - безкоштовно раз на добу
  bot.hears('🔮 Карта дня', async (ctx) => {
    const user = ctx.session.user;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Перевірка, чи користувач вже брав карту дня сьогодні
    if (user.lastDailyCard && user.lastDailyCard >= today) {
      await ctx.reply('Ви вже отримували карту дня сьогодні. Спробуйте завтра або виберіть інший тип розкладу.');
      return;
    }

    const card = drawRandomCard();
    if (!card) {
      await ctx.reply('На жаль, карти ТАРО недоступні. Спробуйте пізніше.');
      return;
    }

    // Оновлення часу останньої карти дня
    user.lastDailyCard = now.getTime();
    
    try {
      // Спочатку відправляємо фото карти
      if (fs.existsSync(card.path)) {
        await ctx.replyWithPhoto({ source: card.path }, { caption: `Ваша карта дня: ${card.name}` });
      } else {
        await ctx.reply(`Ваша карта дня: ${card.name} (зображення недоступне)`);
      }

      // Запит до OpenAI для інтерпретації
      await ctx.reply('Отримую інтерпретацію карти...');
      const prompt = `Ти - експерт з Таро. Дай детальну інтерпретацію карти "${card.name}" як карти дня. 
      Опиши її значення, символіку та як вона може вплинути на різні аспекти життя людини сьогодні. 
      Дай практичні поради на день з огляду на енергію цієї карти. Зроби інтерпретацію глибокою, але 
      доступною для розуміння. Пиши українською мовою.`;
      
      const interpretation = await callOpenAI(prompt);
      await ctx.reply(interpretation);

      logActivity(ctx, `Отримав карту дня: ${card.name}`);
    } catch (error) {
      console.error('Помилка при обробці карти дня:', error);
      await ctx.reply('Виникла помилка при обробці карти. Спробуйте пізніше.');
    }
  });

  // Простий розклад (3 карти) - 2 монети
  bot.hears('🌙 Простий розклад', async (ctx) => {
    const COST = 2;
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для простого розкладу. Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }

    const cards = drawMultipleCards(3);
    if (cards.length < 3) {
      await ctx.reply('На жаль, карти ТАРО недоступні. Спробуйте пізніше.');
      // Повертаємо монети
      ctx.session.user.coins += COST;
      return;
    }

    try {
      await ctx.reply(`Простий розклад "Минуле-Теперішнє-Майбутнє" (витрачено ${COST} монет):`);
      
      // Відправляємо кожну карту по черзі
      for (let i = 0; i < cards.length; i++) {
        const positions = ['Минуле', 'Теперішнє', 'Майбутнє'];
        const card = cards[i];
        
        if (fs.existsSync(card.path)) {
          await ctx.replyWithPhoto({ source: card.path }, { caption: `${positions[i]}: ${card.name}` });
        } else {
          await ctx.reply(`${positions[i]}: ${card.name} (зображення недоступне)`);
        }
      }

      // Запит до OpenAI для інтерпретації
      await ctx.reply('Отримую інтерпретацію розкладу...');
      const prompt = `Ти - досвідчений таролог. Зроби інтерпретацію простого розкладу "Минуле-Теперішнє-Майбутнє" з таких карт:
      Минуле: ${cards[0].name}
      Теперішнє: ${cards[1].name}
      Майбутнє: ${cards[2].name}
      
      Дай детальну інтерпретацію кожної позиції і загальний висновок про ситуацію людини. 
      Поясни, як карти взаємодіють між собою та створюють єдину історію. Додай практичні поради.
      Зроби інтерпретацію глибокою, але доступною для розуміння. Пиши українською мовою.`;
      
      const interpretation = await callOpenAI(prompt);
      await ctx.reply(interpretation);

      logActivity(ctx, 'Отримав простий розклад ТАРО');
    } catch (error) {
      console.error('Помилка при обробці простого розкладу:', error);
      await ctx.reply('Виникла помилка при обробці розкладу. Спробуйте пізніше.');
      // Повертаємо монети у випадку помилки
      ctx.session.user.coins += COST;
    }
  });

  // Кельтський хрест (10 карт) - 5 монет
  bot.hears('💫 Кельтський хрест', async (ctx) => {
    const COST = 5;
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для розкладу "Кельтський хрест". Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }

    const cards = drawMultipleCards(10);
    if (cards.length < 10) {
      await ctx.reply('На жаль, карти ТАРО недоступні. Спробуйте пізніше.');
      // Повертаємо монети
      ctx.session.user.coins += COST;
      return;
    }

    try {
      await ctx.reply(`Розклад "Кельтський хрест" (витрачено ${COST} монет):`);
      
      const positions = [
        'Теперішня ситуація',
        'Перешкода',
        'Підсвідоме, минуле',
        'Недавнє минуле',
        'Найкращий результат',
        'Найближче майбутнє',
        'Ваші страхи і сумніви',
        'Зовнішні впливи',
        'Надії і сподівання',
        'Остаточний результат'
      ];

      // Відправляємо групу карт (може зайняти час)
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        
        if (fs.existsSync(card.path)) {
          await ctx.replyWithPhoto({ source: card.path }, { caption: `${i+1}. ${positions[i]}: ${card.name}` });
        } else {
          await ctx.reply(`${i+1}. ${positions[i]}: ${card.name} (зображення недоступне)`);
        }
      }

      // Запит до OpenAI для інтерпретації
      await ctx.reply('Отримую детальну інтерпретацію розкладу "Кельтський хрест"...');
      
      let prompt = `Ти - майстер Таро вищого рівня. Дай інтерпретацію розкладу "Кельтський хрест" з таких карт:
      1. Теперішня ситуація: ${cards[0].name}
      2. Перешкода: ${cards[1].name}
      3. Підсвідоме, минуле: ${cards[2].name}
      4. Недавнє минуле: ${cards[3].name}
      5. Найкращий результат: ${cards[4].name}
      6. Найближче майбутнє: ${cards[5].name}
      7. Ваші страхи і сумніви: ${cards[6].name}
      8. Зовнішні впливи: ${cards[7].name}
      9. Надії і сподівання: ${cards[8].name}
      10. Остаточний результат: ${cards[9].name}
      
      Розбий інтерпретацію на розділи за позиціями. Поясни значення кожної карти у своїй позиції.
      В кінці зроби загальний висновок про ситуацію та дай конкретні поради.
      Пиши українською мовою, детально, але доступно.`;
      
      const interpretation = await callOpenAI(prompt);
      
      // Відправляємо інтерпретацію частинами через обмеження Telegram
      const maxLength = 4000;
      for (let i = 0; i < interpretation.length; i += maxLength) {
        await ctx.reply(interpretation.substring(i, i + maxLength));
      }

      logActivity(ctx, 'Отримав розклад "Кельтський хрест"');
    } catch (error) {
      console.error('Помилка при обробці "Кельтського хреста":', error);
      await ctx.reply('Виникла помилка при обробці розкладу. Спробуйте пізніше.');
      // Повертаємо монети у випадку помилки
      ctx.session.user.coins += COST;
    }
  });

  // Любовний розклад (5 карт) - 3 монети
  bot.hears('💝 Любовний розклад', async (ctx) => {
    const COST = 3;
    
    if (!deductCoins(ctx, COST)) {
      await ctx.reply(`Недостатньо монет для "Любовного розкладу". Вартість: ${COST} монет. Поповніть баланс у магазині.`);
      return;
    }

    const cards = drawMultipleCards(5);
    if (cards.length < 5) {
      await ctx.reply('На жаль, карти ТАРО недоступні. Спробуйте пізніше.');
      // Повертаємо монети
      ctx.session.user.coins += COST;
      return;
    }

    try {
      await ctx.reply(`"Любовний розклад" (витрачено ${COST} монет):`);
      
      const positions = [
        'Ви',
        'Партнер/потенційний партнер',
        'Ваші почуття',
        'Їхні почуття',
        'Результат/розвиток відносин'
      ];

      // Відправляємо карти
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        
        if (fs.existsSync(card.path)) {
          await ctx.replyWithPhoto({ source: card.path }, { caption: `${positions[i]}: ${card.name}` });
        } else {
          await ctx.reply(`${positions[i]}: ${card.name} (зображення недоступне)`);
        }
      }

      // Запит до OpenAI для інтерпретації
      await ctx.reply('Отримую детальну інтерпретацію "Любовного розкладу"...');
      
      const prompt = `Ти - експерт з любовних розкладів Таро. Дай інтерпретацію "Любовного розкладу" з таких карт:
      1. Ви: ${cards[0].name}
      2. Партнер/потенційний партнер: ${cards[1].name}
      3. Ваші почуття: ${cards[2].name}
      4. Їхні почуття: ${cards[3].name}
      5. Результат/розвиток відносин: ${cards[4].name}
      
      Поясни значення кожної карти у контексті любовних відносин.
      Розкрий глибинну психологію обох партнерів на основі карт.
      Дай прогноз розвитку відносин і практичні поради для їх покращення.
      Пиши українською мовою, глибоко, але зрозуміло.`;
      
      const interpretation = await callOpenAI(prompt);
      await ctx.reply(interpretation);

      logActivity(ctx, 'Отримав "Любовний розклад"');
    } catch (error) {
      console.error('Помилка при обробці "Любовного розкладу":', error);
      await ctx.reply('Виникла помилка при обробці розкладу. Спробуйте пізніше.');
      // Повертаємо монети у випадку помилки
      ctx.session.user.coins += COST;
    }
  });

  // Підписка на щоденну карту ТАРО
  bot.command('subscribe_daily', async (ctx) => {
    const user = ctx.session.user;
    
    // Перевірка, чи користувач вже підписаний
    if (user.subscriptions && user.subscriptions.dailyTarot) {
      await ctx.reply('Ви вже підписані на щоденну карту ТАРО. Щоб відписатися, використайте команду /unsubscribe_daily');
      return;
    }
    
    // Ініціалізація підписок, якщо це перша підписка користувача
    if (!user.subscriptions) {
      user.subscriptions = {};
    }
    
    // Вартість підписки - 10 монет на місяць
    const SUBSCRIPTION_COST = 10;
    
    if (!deductCoins(ctx, SUBSCRIPTION_COST)) {
      await ctx.reply(`Недостатньо монет для підписки. Вартість: ${SUBSCRIPTION_COST} монет на місяць. Поповніть баланс у магазині.`);
      return;
    }
    
    // Встановлення підписки
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Підписка на 1 місяць
    
    user.subscriptions.dailyTarot = {
      active: true,
      subscribedAt: now.getTime(),
      expiresAt: expiryDate.getTime()
    };
    
    await ctx.reply(`Ви успішно підписалися на щоденну карту ТАРО! Вартість: ${SUBSCRIPTION_COST} монет.
    
Кожного ранку о 8:00 ви будете отримувати карту дня з детальною інтерпретацією.
    
Підписка дійсна до: ${expiryDate.toLocaleDateString()}
    
Щоб відписатися, використайте команду /unsubscribe_daily`);
    
    logActivity(ctx, 'Підписався на щоденну карту ТАРО');
  });
  
  // Відписка від щоденної карти ТАРО
  bot.command('unsubscribe_daily', async (ctx) => {
    const user = ctx.session.user;
    
    // Перевірка, чи користувач підписаний
    if (!user.subscriptions || !user.subscriptions.dailyTarot || !user.subscriptions.dailyTarot.active) {
      await ctx.reply('У вас немає активної підписки на щоденну карту ТАРО.');
      return;
    }
    
    // Відключення підписки
    user.subscriptions.dailyTarot.active = false;
    
    await ctx.reply('Ви успішно відписалися від щоденної карти ТАРО. Ви можете підписатися знову за допомогою команди /subscribe_daily');
    
    logActivity(ctx, 'Відписався від щоденної карти ТАРО');
  });
}

module.exports = {
  setupTarotMode,
  drawRandomCard,
  drawMultipleCards
};
