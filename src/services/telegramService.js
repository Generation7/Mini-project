const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const lectureService = require('./lectureService');
const userService = require('./userService');
const logger = require('../utils/logger');

let bot;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function processMessage(chatId, userMessage) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Acadia, a friendly AI assistant for students at KNUST Ghana.
You help students manage lectures, assignments, exams and reminders.
When a student wants to add a lecture, respond with ONLY this JSON (nothing else):
{"action":"ADD_LECTURE","courseCode":"X","lectureDay":"X","lectureTime":"HH:MM"}
For listing lectures respond with ONLY: {"action":"LIST_LECTURES"}
For everything else, just reply normally in plain friendly English.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.3-70b-versatile',
    });

    const response = completion.choices[0]?.message?.content?.trim();
    console.log('Groq response:', response);

    try {
      const parsed = JSON.parse(response);

      if (parsed.action === 'ADD_LECTURE') {
        const user = userService.findOrCreateByPhoneNumber(chatId.toString());
        lectureService.createLecture({
          userId: user.id,
          courseCode: parsed.courseCode,
          courseName: parsed.courseCode,
          lectureDay: parsed.lectureDay,
          lectureTime: parsed.lectureTime,
        });
        return `✅ Added *${parsed.courseCode}* on *${parsed.lectureDay}* at *${parsed.lectureTime}*! You'll get a reminder the day before.`;
      }

      if (parsed.action === 'LIST_LECTURES') {
        const user = userService.findOrCreateByPhoneNumber(chatId.toString());
        const lectures = lectureService.getLecturesByUserId
          ? lectureService.getLecturesByUserId(user.id)
          : [];
        if (!lectures.length) return "You have no lectures yet. Tell me your timetable!";
        return `📚 *Your Lectures:*\n${lectures.map(l => `• ${l.courseCode} - ${l.lectureDay} at ${l.lectureTime}`).join('\n')}`;
      }
    } catch (e) {
      return response;
    }

    return response;
  } catch (err) {
    console.error('Groq error:', err.message);
    throw err;
  }
}

function startTelegramBot() {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'Student';
    bot.sendMessage(msg.chat.id,
      `👋 Hi ${name}! I'm *Acadia*, your AI academic assistant!\n\nI can help you with:\n📚 Lecture timetable\n⏰ Reminders\n📝 Assignments\n📅 Exams\n\nJust talk to me naturally!`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    console.log('Received message:', msg.text);
    try {
      await bot.sendChatAction(chatId, 'typing');
      const response = await processMessage(chatId, msg.text);
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Bot error:', err.message);
      bot.sendMessage(chatId, "Sorry, I ran into an issue. Please try again!");
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
  });

  logger.info('Telegram bot started');
}

module.exports = { startTelegramBot };