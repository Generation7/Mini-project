const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const lectureService = require('./lectureService');
const userService = require('./userService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');
const logger = require('../utils/logger');
const { sendMessageWithRetry, withTelegramRetry } = require('../utils/telegramRetry');
const conversationService = require('./conversationService');

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

// Runs one turn through Groq and returns the reply string. Pure - does not
// touch conversation history storage itself, so it can be tested/reasoned
// about independently of the save step in processMessage() below.
async function computeReply(chatId, userMessage, user, history) {
  try {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayWeekday = weekdayNames[now.getDay()];
    const tomorrowWeekday = weekdayNames[(now.getDay() + 1) % 7];
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Filters a list of items with a "date" field (dueDate/examDate) down to
    // either a single exact date or a rolling window of N days from today.
    // Returns null if no filter was requested (parsed.date / parsed.withinDays absent).
    function filterByDateWindow(items, dateField, parsed) {
      if (parsed.date) {
        return { filtered: items.filter(i => i[dateField] === parsed.date), windowLabel: parsed.date };
      }
      if (parsed.withinDays) {
        const cutoff = new Date(now.getTime() + Number(parsed.withinDays) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return {
          filtered: items.filter(i => i[dateField] >= todayDate && i[dateField] <= cutoff),
          windowLabel: `the next ${parsed.withinDays} days`,
        };
      }
      return null;
    }

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
Today is ${todayWeekday} (${todayDate}). Tomorrow is ${tomorrowWeekday} (${tomorrowDate}). Resolve relative day references against these before responding.

When a student mentions an assignment or homework due on a date/time, respond with ONLY this JSON:
{"action":"ADD_ASSIGNMENT","courseCode":"X","title":"X","dueDate":"YYYY-MM-DD","dueTime":"HH:MM"}
If no time is mentioned, use "23:59" as the default dueTime.

When a student asks about ALL their assignments or what is due in general, respond with ONLY:
{"action":"LIST_ASSIGNMENTS"}

When a student asks what's due on a SPECIFIC day (e.g. "today", "tomorrow", a weekday name, or an exact date), respond with ONLY this JSON, resolving the day to an exact "YYYY-MM-DD" date using today's/tomorrow's date above:
{"action":"LIST_ASSIGNMENTS","date":"YYYY-MM-DD"}

When a student asks what's due within a range (e.g. "this week", "in the next 3 days"), respond with ONLY this JSON, where days is how many days ahead to include:
{"action":"LIST_ASSIGNMENTS","withinDays":7}

When a student says they submitted or completed an assignment, respond with ONLY this JSON:
{"action":"COMPLETE_ASSIGNMENT","courseCode":"X"}

When a student wants to delete/remove an assignment, respond with ONLY this JSON:
{"action":"DELETE_ASSIGNMENT","courseCode":"X"}

When a student mentions an exam on a date/time, respond with ONLY this JSON:
{"action":"ADD_EXAM","courseCode":"X","examDate":"YYYY-MM-DD","examTime":"HH:MM","venue":"X"}
If no time is mentioned use "08:00". If no venue is mentioned use null.

When a student asks about ALL their exams in general, respond with ONLY:
{"action":"LIST_EXAMS"}

When a student asks about exams on a SPECIFIC day (e.g. "today", "tomorrow", a weekday name, or an exact date), respond with ONLY this JSON, resolving the day to an exact "YYYY-MM-DD" date using today's/tomorrow's date above:
{"action":"LIST_EXAMS","date":"YYYY-MM-DD"}

When a student asks about exams within a range (e.g. "this week", "in the next 3 days"), respond with ONLY this JSON, where days is how many days ahead to include:
{"action":"LIST_EXAMS","withinDays":7}

When a student says they completed/finished an exam, respond with ONLY this JSON:
{"action":"COMPLETE_EXAM","courseCode":"X"}

When a student wants to delete/remove an exam, respond with ONLY this JSON:
{"action":"DELETE_EXAM","courseCode":"X"}

When a student clearly and explicitly asks to clear/delete/remove ALL of their lectures or timetable, respond with ONLY this JSON:
{"action":"CLEAR_LECTURES"}

When a student clearly and explicitly asks to clear/delete/remove ALL of their assignments, respond with ONLY this JSON:
{"action":"CLEAR_ASSIGNMENTS"}

When a student clearly and explicitly asks to clear/delete/remove ALL of their exams, respond with ONLY this JSON:
{"action":"CLEAR_EXAMS"}

The three CLEAR actions above are destructive and cannot be undone by you, so only use them when the student has been unambiguous about wanting everything gone (words like "all", "everything", "clear my X"). If a request is vague (e.g. just "clear things"), do NOT return a CLEAR action — instead reply in plain English asking exactly what they'd like cleared (lectures, assignments, or exams).

For everything else, reply normally in plain friendly English.
Today's date is ${todayDate}.`
        },
        ...history.map(m => ({ role: m.role, content: m.content })),
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

          const window = filterByDateWindow(pending, 'dueDate', parsed);
          const list = window ? window.filtered : pending;
          if (window && !list.length) return `🎉 Nothing due on *${window.windowLabel}*.`;

          const label = window ? `📝 *Assignments Due (${window.windowLabel}):*` : `📝 *Your Pending Assignments:*`;
          return `${label}\n${list.map(a => `• *${a.courseCode}* - ${a.title}\n  📅 Due: ${a.dueDate} at ${a.due_time || '23:59'}`).join('\n')}`;
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

          const window = filterByDateWindow(upcoming, 'examDate', parsed);
          const list = window ? window.filtered : upcoming;
          if (window && !list.length) return `🎉 No exams on *${window.windowLabel}*.`;

          const label = window ? `🎓 *Exams (${window.windowLabel}):*` : `🎓 *Your Upcoming Exams:*`;
          return `${label}\n${list.map(e => `• *${e.courseCode}*\n  📅 ${e.examDate} at ${e.exam_time || e.examTime || '08:00'}${e.venue ? `\n  📍 ${e.venue}` : ''}`).join('\n')}`;
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

        case 'CLEAR_LECTURES': {
          const allLectures = lectureService.getLecturesByUserId(user.id);
          if (!allLectures.length) return "You don't have any lectures to clear.";
          allLectures.forEach(l => lectureService.deleteLecture(l.id));
          return `🗑️ Cleared *${allLectures.length}* lecture${allLectures.length === 1 ? '' : 's'} from your timetable.`;
        }

        case 'CLEAR_ASSIGNMENTS': {
          const pending = assignmentService.getPendingAssignments(user.id);
          if (!pending.length) return "You don't have any pending assignments to clear.";
          pending.forEach(a => assignmentService.deleteAssignment(user.id, a.courseCode));
          return `🗑️ Cleared *${pending.length}* assignment${pending.length === 1 ? '' : 's'}.`;
        }

        case 'CLEAR_EXAMS': {
          const upcoming = examService.getUpcomingExams(user.id);
          if (!upcoming.length) return "You don't have any upcoming exams to clear.";
          upcoming.forEach(e => examService.deleteExam(user.id, e.courseCode));
          return `🗑️ Cleared *${upcoming.length}* exam${upcoming.length === 1 ? '' : 's'}.`;
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

// Public entry point: loads recent history, gets a reply, then persists this
// turn for next time. Kept separate from computeReply so a Groq failure
// (which throws before we have a reply) never gets saved to history - only
// completed exchanges are stored.
async function processMessage(chatId, userMessage, user) {
  const history = user ? conversationService.getRecentMessages(user.id) : [];
  const reply = await computeReply(chatId, userMessage, user, history);

  if (user) {
    try {
      conversationService.addMessage(user.id, 'user', userMessage);
      conversationService.addMessage(user.id, 'assistant', reply);
    } catch (err) {
      // Losing history for one turn isn't worth failing the reply over -
      // the user still gets their answer, just without it being remembered.
      console.error(`Failed to save conversation history for user ${user.id}: ${err.message}`);
    }
  }

  return reply;
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