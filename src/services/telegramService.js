const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const lectureService = require('./lectureService');
const userService = require('./userService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');
const logger = require('../utils/logger');
const { sendMessageWithRetry, withTelegramRetry } = require('../utils/telegramRetry');

let bot;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Best-effort typing indicator - not worth retrying, it's just a UI nicety
// and the flaky network case is already covered by the retried sendMessage
// call that follows it.
async function safeSendChatAction(chatId, action) {
  try {
    await bot.sendChatAction(chatId, action);
  } catch (err) {
    console.warn(`sendChatAction(chat ${chatId}) failed, continuing anyway: ${err.message}`);
  }
}

async function processMessage(chatId, userMessage, user) {
  try {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayWeekday = weekdayNames[now.getDay()];
    const tomorrowWeekday = weekdayNames[(now.getDay() + 1) % 7];

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Acadia, a friendly AI assistant for students at KNUST Ghana.
You help students manage lectures, assignments, exams and reminders.

When a student wants to ADD a lecture, respond with ONLY this JSON:
{"action":"ADD_LECTURE","courseCode":"X","lectureDay":"X","lectureTime":"HH:MM"}

When a student wants to DELETE/REMOVE a lecture, respond with ONLY this JSON:
{"action":"DELETE_LECTURE","courseCode":"X","lectureDay":"X"}

When a student wants to EDIT/UPDATE/CHANGE a lecture time or day, respond with ONLY this JSON:
{"action":"EDIT_LECTURE","courseCode":"X","oldLectureDay":"X","newLectureDay":"X","newLectureTime":"HH:MM"}

When a student asks about their lectures or timetable for ALL days, respond with ONLY:
{"action":"LIST_LECTURES"}

When a student asks about their lectures for a SPECIFIC day (e.g. "today", "tomorrow", "Monday", "what do I have on Wednesday"), respond with ONLY this JSON, using the actual weekday name (never the words "today"/"tomorrow" themselves):
{"action":"LIST_LECTURES","day":"Monday"}
Today is ${todayWeekday} (${todayDate}). Tomorrow is ${tomorrowWeekday}. Resolve relative day references against this before responding.

When a student mentions an assignment or homework due on a date/time, respond with ONLY this JSON:
{"action":"ADD_ASSIGNMENT","courseCode":"X","title":"X","dueDate":"YYYY-MM-DD","dueTime":"HH:MM"}
If no time is mentioned, use "23:59" as the default dueTime.

When a student asks about their assignments or what is due, respond with ONLY:
{"action":"LIST_ASSIGNMENTS"}

When a student says they submitted or completed an assignment, respond with ONLY this JSON:
{"action":"COMPLETE_ASSIGNMENT","courseCode":"X"}

When a student wants to delete/remove an assignment, respond with ONLY this JSON:
{"action":"DELETE_ASSIGNMENT","courseCode":"X"}

When a student mentions an exam on a date/time, respond with ONLY this JSON:
{"action":"ADD_EXAM","courseCode":"X","examDate":"YYYY-MM-DD","examTime":"HH:MM","venue":"X"}
If no time is mentioned use "08:00". If no venue is mentioned use null.

When a student asks about their exams, respond with ONLY:
{"action":"LIST_EXAMS"}

When a student says they completed/finished an exam, respond with ONLY this JSON:
{"action":"COMPLETE_EXAM","courseCode":"X"}

When a student wants to delete/remove an exam, respond with ONLY this JSON:
{"action":"DELETE_EXAM","courseCode":"X"}

For everything else, reply normally in plain friendly English.
Today's date is ${todayDate}.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.3-70b-versatile',
    });

    const textResponse = completion.choices[0]?.message?.content?.trim();
    console.log('Groq response:', textResponse);

    try {
      const parsed = JSON.parse(textResponse);
      if (!user) return "Sorry, I'm having trouble accessing your account. Please try again.";

      switch (parsed.action) {
        case 'ADD_LECTURE': {
          lectureService.createLecture({
            userId: user.id,
            courseCode: parsed.courseCode,
            courseName: parsed.courseCode,
            lectureDay: parsed.lectureDay,
            lectureTime: parsed.lectureTime,
          });
          return `✅ Added *${parsed.courseCode}* on *${parsed.lectureDay}* at *${parsed.lectureTime}*! You'll get a reminder the day before.`;
        }

        case 'DELETE_LECTURE': {
          const allLectures = lectureService.getLecturesByUserId(user.id);
          const lecture = allLectures.find(l =>
            l.courseCode.replace(/\s/g, '').toLowerCase() === parsed.courseCode.replace(/\s/g, '').toLowerCase() &&
            l.lectureDay.toLowerCase() === parsed.lectureDay.toLowerCase()
          );
          if (!lecture) return `❌ I couldn't find *${parsed.courseCode}* on *${parsed.lectureDay}*.`;
          lectureService.deleteLecture(lecture.id);
          return `🗑️ Removed *${parsed.courseCode}* on *${parsed.lectureDay}* from your timetable.`;
        }

        case 'EDIT_LECTURE': {
          const allLectures = lectureService.getLecturesByUserId(user.id);
          const lecture = allLectures.find(l =>
            l.courseCode.replace(/\s/g, '').toLowerCase() === parsed.courseCode.replace(/\s/g, '').toLowerCase() &&
            l.lectureDay.toLowerCase() === parsed.oldLectureDay.toLowerCase()
          );
          if (!lecture) return `❌ I couldn't find *${parsed.courseCode}* on *${parsed.oldLectureDay}*.`;
          lectureService.updateLecture(lecture.id, { lectureDay: parsed.newLectureDay, lectureTime: parsed.newLectureTime });
          return `✏️ Updated *${parsed.courseCode}* to *${parsed.newLectureDay}* at *${parsed.newLectureTime}*!`;
        }

        case 'LIST_LECTURES': {
          const lectures = lectureService.getLecturesByUserId(user.id);
          const day = parsed.day ? parsed.day.trim() : null;
          const filtered = day
            ? lectures.filter(l => l.lectureDay.toLowerCase() === day.toLowerCase())
            : lectures;

          if (!lectures.length) return "You have no lectures yet. Send me a photo of your timetable!";
          if (day && !filtered.length) return `You have no lectures on *${day}*.`;

          const label = day ? `📚 *Your Lectures on ${day}:*` : `📚 *Your Lectures:*`;
          return `${label}\n${filtered.map(l => `• ${l.courseCode} - ${l.lectureDay} at ${l.lectureTime}`).join('\n')}`;
        }

        case 'ADD_ASSIGNMENT': {
          assignmentService.createAssignment({
            userId: user.id,
            courseCode: parsed.courseCode,
            title: parsed.title,
            dueDate: parsed.dueDate,
            dueTime: parsed.dueTime || '23:59',
          });
          return `📝 Added assignment for *${parsed.courseCode}*!\n📌 *${parsed.title}*\n📅 Due: *${parsed.dueDate} at ${parsed.dueTime || '23:59'}*\n\nI'll remind you 2 days before, 1 day before, and 3 hours before the deadline!`;
        }

        case 'LIST_ASSIGNMENTS': {
          const pending = assignmentService.getPendingAssignments(user.id);
          if (!pending.length) return "🎉 You have no pending assignments!";
          return `📝 *Your Pending Assignments:*\n${pending.map(a => `• *${a.courseCode}* - ${a.title}\n  📅 Due: ${a.dueDate} at ${a.due_time || '23:59'}`).join('\n')}`;
        }

        case 'COMPLETE_ASSIGNMENT': {
          const assignment = assignmentService.markAssignmentDone(user.id, parsed.courseCode);
          if (!assignment) return `❌ I couldn't find a pending assignment for *${parsed.courseCode}*.`;
          return `✅ Great work! Marked your *${parsed.courseCode}* assignment as submitted!`;
        }

        case 'DELETE_ASSIGNMENT': {
          const assignment = assignmentService.deleteAssignment(user.id, parsed.courseCode);
          if (!assignment) return `❌ I couldn't find an assignment for *${parsed.courseCode}*.`;
          return `🗑️ Removed the *${parsed.courseCode}* assignment.`;
        }

        case 'ADD_EXAM': {
          examService.createExam({
            userId: user.id,
            courseCode: parsed.courseCode,
            examDate: parsed.examDate,
            examTime: parsed.examTime || '08:00',
            venue: parsed.venue || null,
          });
          const venueText = parsed.venue ? `\n📍 Venue: *${parsed.venue}*` : '';
          return `🎓 Added *${parsed.courseCode}* exam!\n📅 Date: *${parsed.examDate}*\n⏰ Time: *${parsed.examTime || '08:00'}*${venueText}\n\nI'll remind you 7 days, 3 days, 1 day and 3 hours before!`;
        }

        case 'LIST_EXAMS': {
          const upcoming = examService.getUpcomingExams(user.id);
          if (!upcoming.length) return "🎉 You have no upcoming exams!";
          return `🎓 *Your Upcoming Exams:*\n${upcoming.map(e => `• *${e.courseCode}*\n  📅 ${e.examDate} at ${e.exam_time || e.examTime || '08:00'}${e.venue ? `\n  📍 ${e.venue}` : ''}`).join('\n')}`;
        }

        case 'COMPLETE_EXAM': {
          const exam = examService.markExamDone(user.id, parsed.courseCode);
          if (!exam) return `❌ I couldn't find an upcoming exam for *${parsed.courseCode}*.`;
          return `✅ Great job completing your *${parsed.courseCode}* exam! Hope it went well! 🍀`;
        }

        case 'DELETE_EXAM': {
          const exam = examService.deleteExam(user.id, parsed.courseCode);
          if (!exam) return `❌ I couldn't find an exam for *${parsed.courseCode}*.`;
          return `🗑️ Removed the *${parsed.courseCode}* exam.`;
        }
      }
    } catch (e) {
      return textResponse;
    }

    return textResponse;
  } catch (err) {
    console.error('Groq error:', err.message);
    throw err;
  }
}

function startTelegramBot() {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Student';
    const token = match && match[1] ? match[1].trim() : null;

    try {
      if (token) {
        const user = userService.findByValidTelegramLinkToken(token);
        if (!user) {
          return await sendMessageWithRetry(bot, chatId,
            `⚠️ That connection link has expired or is invalid. Please go back to the Acadia dashboard and click "Connect Telegram" again to get a fresh link.`
          );
        }
        userService.linkTelegramChatId(user.id, chatId);
        return await sendMessageWithRetry(bot, chatId,
          `✅ Connected! Hi ${user.name || name}, your Telegram is now linked to your Acadia account.\n\nI can help you with:\n📚 Lecture timetable\n📝 Assignment tracking\n🎓 Exam reminders\n⏰ Smart notifications\n\nJust talk to me naturally or send a photo of your timetable!`,
          { parse_mode: 'Markdown' }
        );
      }

      const existing = userService.findByTelegramChatId(chatId);
      if (existing) {
        return await sendMessageWithRetry(bot, chatId,
          `👋 Welcome back, ${existing.name || name}! Your account is already connected. Just talk to me naturally or send a photo of your timetable!`
        );
      }

      return await sendMessageWithRetry(bot, chatId,
        `👋 Hi ${name}! I'm *Acadia*, your AI academic assistant.\n\nTo get started, please connect your Telegram to your Acadia account:\n1️⃣ Log in to the Acadia dashboard\n2️⃣ Go to Settings\n3️⃣ Tap "Connect Telegram"\n\nThat'll bring you right back here, all linked up!`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      // Every retry attempt has already been exhausted (or the error was a
      // genuine Telegram rejection) by the time we get here - just log it,
      // there's nothing more this handler can do for that outgoing message.
      logger.error(`/start handler failed for chat ${chatId}: ${err.message}`);
    }
  });

  async function requireLinkedUser(chatId) {
    const user = userService.findByTelegramChatId(chatId);
    if (!user) {
      try {
        await sendMessageWithRetry(bot, chatId,
          `🔒 Your Telegram isn't connected to an Acadia account yet.\n\nPlease log in to the Acadia dashboard, go to Settings, and tap "Connect Telegram" to link your account.`
        );
      } catch (err) {
        logger.error(`requireLinkedUser notice failed for chat ${chatId}: ${err.message}`);
      }
      return null;
    }
    return user;
  }

  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const user = await requireLinkedUser(chatId);
    if (!user) return;

    try {
      await safeSendChatAction(chatId, 'typing');
      await sendMessageWithRetry(bot, chatId, "📸 Got your timetable! Let me read it...");

      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await withTelegramRetry(() => bot.getFile(fileId), { label: `getFile(chat ${chatId})` });
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const visionCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `This is a university lecture timetable. It may be laid out in different ways (rows, columns, a grid with days and time slots, etc).

Go through the entire image carefully and extract EVERY lecture you can find, regardless of layout or grouping. Do not skip any entries and do not filter by group, cohort, or section — include all of them.

For each lecture, capture:
- courseCode (or course name if no code is shown)
- lectureDay (the day of the week)
- lectureTime (in 24-hour HH:MM format, using the start time of the slot)

Return ONLY a JSON array with no explanation, for example:
[{"courseCode":"CSM388","lectureDay":"Monday","lectureTime":"10:30"},...]

If the timetable uses named time windows (e.g. "10:30 AM - 12:30 PM"), use the start time converted to 24-hour format (e.g. "10:30").

Be thorough - check every single cell in the timetable carefully.`
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl }
              }
            ]
          }
        ],
        model: 'qwen/qwen3.6-27b',
      });

      const visionResponse = visionCompletion.choices[0]?.message?.content?.trim();
      console.log('Vision response:', visionResponse);

      const jsonMatch = visionResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return await sendMessageWithRetry(bot, chatId, "Sorry, I couldn't read the timetable clearly. Try a clearer photo!");
      }

      const lecturesList = JSON.parse(jsonMatch[0]);
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

      await sendMessageWithRetry(bot, chatId,
        `✅ Done! I found *${lecturesList.length}* lectures and added *${added}* new ones to your timetable!\n\nSend "What lectures do I have?" to see them all.`,
        { parse_mode: 'Markdown' }
      );

    } catch (err) {
      console.error('Photo error:', err.message);
      try {
        await sendMessageWithRetry(bot, chatId, "Sorry, I had trouble reading that image. Please try again!");
      } catch (sendErr) {
        logger.error(`Photo error notice failed for chat ${chatId}: ${sendErr.message}`);
      }
    }
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const user = await requireLinkedUser(chatId);
    if (!user) return;
    console.log('Received message:', msg.text);
    try {
      await safeSendChatAction(chatId, 'typing');
      const textResponse = await processMessage(chatId, msg.text, user);
      try {
        await sendMessageWithRetry(bot, chatId, textResponse, { parse_mode: 'Markdown' });
      } catch (err) {
        // Markdown parse failures come back from Telegram immediately
        // (non-retryable, err.response is set) - fall back to plain text.
        // Genuine network failures already exhausted their retries above,
        // so this second attempt is specifically for the markdown case.
        if (err.response) {
          await sendMessageWithRetry(bot, chatId, textResponse);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error('Bot error:', err.message);
      try {
        await sendMessageWithRetry(bot, chatId, "Sorry, I ran into an issue. Please try again!");
      } catch (sendErr) {
        logger.error(`Error notice failed for chat ${chatId}: ${sendErr.message}`);
      }
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
  });

  logger.info('Telegram bot started');
  return bot;
}

module.exports = { startTelegramBot };