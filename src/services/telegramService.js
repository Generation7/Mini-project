const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const lectureService = require('./lectureService');
const userService = require('./userService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');
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

When a student wants to ADD a lecture, respond with ONLY this JSON:
{"action":"ADD_LECTURE","courseCode":"X","lectureDay":"X","lectureTime":"HH:MM"}

When a student wants to DELETE/REMOVE a lecture, respond with ONLY this JSON:
{"action":"DELETE_LECTURE","courseCode":"X","lectureDay":"X"}

When a student wants to EDIT/UPDATE/CHANGE a lecture time or day, respond with ONLY this JSON:
{"action":"EDIT_LECTURE","courseCode":"X","oldLectureDay":"X","newLectureDay":"X","newLectureTime":"HH:MM"}

When a student asks about their lectures or timetable, respond with ONLY:
{"action":"LIST_LECTURES"}

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
Today's date is ${new Date().toISOString().slice(0, 10)}.`
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
      const user = userService.findOrCreateByPhoneNumber(chatId.toString());
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
          if (!lectures.length) return "You have no lectures yet. Send me a photo of your timetable!";
          return `📚 *Your Lectures:*\n${lectures.map(l => `• ${l.courseCode} - ${l.lectureDay} at ${l.lectureTime}`).join('\n')}`;
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

  bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'Student';
    const chatId = msg.chat.id;
    const user = userService.findOrCreateByPhoneNumber(chatId.toString());
    userService.saveTelegramChatId(user.id, chatId);
    bot.sendMessage(chatId,
      `👋 Hi ${name}! I'm *Acadia*, your AI academic assistant!\n\nI can help you with:\n📚 Lecture timetable\n📝 Assignment tracking\n🎓 Exam reminders\n⏰ Smart notifications\n\nJust talk to me naturally or send a photo of your timetable!`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const user = userService.findOrCreateByPhoneNumber(chatId.toString());
    userService.saveTelegramChatId(user.id, chatId);

    try {
      await bot.sendChatAction(chatId, 'typing');
      await bot.sendMessage(chatId, "📸 Got your timetable! Let me read it...");

      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const caption = msg.caption || '';
      const group = caption.toLowerCase().includes('2') ? '2' : '1';

      const visionCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `This is a KNUST B.Sc Computer Science timetable. Each day has TWO rows - top row is Group 1, bottom row is Group 2. Some classes span both rows (joint classes for ALL LECTURERS).

Extract EVERY lecture for Group ${group} by going through each day and each period carefully:
- Include top row (Group 1) entries
- Include any entry labeled "ALL LECTURERS" or with no group label (joint classes)
- Skip bottom row (Group 2) entries only

Return ONLY a JSON array with no explanation:
[{"courseCode":"CSM388","lectureDay":"Monday","lectureTime":"10:30"},...]

Period to time mapping:
1=08:00, 2=09:00, 3=10:30, 4=11:30, 5=13:00, 6=14:00, 7=15:00, 8=16:00, 9=17:00, 10=18:00

Be thorough - check every single cell in the timetable carefully.`
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

      const visionResponse = visionCompletion.choices[0]?.message?.content?.trim();
      console.log('Vision response:', visionResponse);

      const jsonMatch = visionResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return bot.sendMessage(chatId, "Sorry, I couldn't read the timetable clearly. Try a clearer photo!");
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
    const user = userService.findOrCreateByPhoneNumber(chatId.toString());
    userService.saveTelegramChatId(user.id, chatId);
    console.log('Received message:', msg.text);
    try {
      await bot.sendChatAction(chatId, 'typing');
      const textResponse = await processMessage(chatId, msg.text);
      await bot.sendMessage(chatId, textResponse, { parse_mode: 'Markdown' }).catch(() => {
        bot.sendMessage(chatId, textResponse);
      });
    } catch (err) {
      console.error('Bot error:', err.message);
      bot.sendMessage(chatId, "Sorry, I ran into an issue. Please try again!");
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
  });

  logger.info('Telegram bot started');
  return bot;
}

module.exports = { startTelegramBot };