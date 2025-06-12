let openai = null;
if (process.env.OPENAI_API_KEY) {
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.warn("OPENAI_API_KEY missing — AI-функції вимкнено");
}

async function callOpenAI(options) {
  if (!openai) throw new Error("AI-сервіс вимкнено");
  return openai.chat.completions.create(options);
}

module.exports = { callOpenAI };