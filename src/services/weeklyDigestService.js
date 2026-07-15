const lectureService = require('./lectureService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function buildLectureSection(userId) {
  const lectures = lectureService.getLecturesByUserId(userId);
  if (!lectures.length) return '';

  const byDay = {};
  for (const lec of lectures) {
    if (!byDay[lec.lectureDay]) byDay[lec.lectureDay] = [];
    byDay[lec.lectureDay].push(lec);
  }

  const orderedDays = DAY_ORDER.filter(day => byDay[day]);
  if (!orderedDays.length) return '';

  let section = '\n🗓️ *This Week\'s Lectures*\n';
  for (const day of orderedDays) {
    section += `\n*${day}*\n`;
    const dayLectures = byDay[day].sort((a, b) => a.lectureTime.localeCompare(b.lectureTime));
    for (const lec of dayLectures) {
      section += `  • ${lec.lectureTime} — ${lec.courseCode} (${lec.courseName})\n`;
    }
  }
  return section;
}

function buildAssignmentSection(userId, weekStart, weekEnd) {
  const pending = assignmentService.getPendingAssignments(userId);
  const dueThisWeek = pending.filter(a => a.dueDate >= weekStart && a.dueDate <= weekEnd);
  if (!dueThisWeek.length) return '';

  dueThisWeek.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let section = '\n📚 *Assignments Due This Week*\n';
  for (const a of dueThisWeek) {
    section += `  • ${a.courseCode} — ${a.title} (due ${a.dueDate} at ${a.dueTime || '23:59'})\n`;
  }
  return section;
}

function buildExamSection(userId, weekStart, weekEnd) {
  const upcoming = examService.getUpcomingExams(userId);
  const examsThisWeek = upcoming.filter(e => e.examDate >= weekStart && e.examDate <= weekEnd);
  if (!examsThisWeek.length) return '';

  examsThisWeek.sort((a, b) => a.examDate.localeCompare(b.examDate));

  let section = '\n📝 *Exams This Week*\n';
  for (const e of examsThisWeek) {
    const venue = e.venue ? `, venue: ${e.venue}` : '';
    section += `  • ${e.courseCode} — ${e.examDate} at ${e.examTime || '08:00'}${venue}\n`;
  }
  return section;
}

function buildWeeklyDigest(userId, referenceDate = new Date()) {
  const weekStart = toDateOnly(referenceDate);
  const weekEnd = toDateOnly(addDays(referenceDate, 7));

  const lectureSection = buildLectureSection(userId);
  const assignmentSection = buildAssignmentSection(userId, weekStart, weekEnd);
  const examSection = buildExamSection(userId, weekStart, weekEnd);

  if (!lectureSection && !assignmentSection && !examSection) {
    return null;
  }

  let message = '📬 *Your Weekly Acadia Digest*\n';
  message += lectureSection;
  message += assignmentSection;
  message += examSection;
  message += '\nHave a productive week! 💪';

  return message;
}

module.exports = { buildWeeklyDigest };