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
When a student sends a timetable photo, ask which group they are in (Group 1 or Group 2) before extracting lectures.
When a student wants to add a lecture, respond with ONLY this JSON (nothing else):
{"action":"ADD_LECTURE","courseCode":"X","lectureDay":"X","lectureTime":"HH:MM"}
For listing lectures respond with ONLY: {"action":"LIST_LECTURES"}
When a student says they are in Group 1 or Group 2, respond with ONLY: {"action":"SET_GROUP","group":"1"} or {"action":"SET_GROUP","group":"2"}
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
      `👋 Hi ${name}! I'm *Acadia*, your AI academic assistant!\n\nI can help you with:\n📚 Lecture timetable\n⏰ Reminders\n📝 Assignments\n📅 Exams\n\nJust talk to me naturally or send a photo of your timetable!`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
      await bot.sendChatAction(chatId, 'typing');
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' }).catch(() => {
  bot.sendMessage(chatId, response);
});

      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `This is a KNUST student timetable with Group 1 and Group 2 rows for each day.
Extract ONLY Group 1 lectures and return ONLY a JSON array like this:
[{"courseCode":"CSM388","lectureDay":"Monday","lectureTime":"08:00"},...]
Use 24-hour format for times based on the period numbers (1=08:00, 2=09:00, 3=10:30, 4=11:30, 5=13:00, 6=14:00, 7=15:00, 8=16:00, 9=17:00, 10=18:00).
Only include rows labeled Group 1. Ignore Group 2 rows.`
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl }
              }
            ]
          }
        ],
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      });

      const response = completion.choices[0]?.message?.content?.trim();
      console.log('Vision response:', response);

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return bot.sendMessage(chatId, "Sorry, I couldn't read the timetable clearly. Try a clearer photo!");
      }

      const lecturesList = JSON.parse(jsonMatch[0]);
      const user = userService.findOrCreateByPhoneNumber(chatId.toString());
      let added = 0;

      for (const lecture of lecturesList) {
        const result = lectureService.createLecture({
          userId: user.id,
          courseCode: lecture.courseCode,
          courseName: lecture.courseCode,
          lectureDay: lecture.lectureDay,
          lectureTime: lecture.lectureTime,
        });
        if (result.created) added++;
      }

      bot.sendMessage(chatId,
        `✅ Done! I found *${lecturesList.length}* lectures and added *${added}* new ones to your timetable!\n\nSend "What lectures do I have?" to see them all.`,
        { parse_mode: 'Markdown' }
      );

    } catch (err) {
      console.error('Photo error:', err.message);
      bot.sendMessage(chatId, "Sorry, I had trouble reading that image. Please try again!");
    }
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