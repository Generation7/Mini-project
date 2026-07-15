const lectureService = require('./lectureService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');

const DAY_TO_ICAL = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
  Sunday: 'SU',
};

const DAY_TO_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTimeUTC(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  while (i < line.length) {
    chunks.push((i === 0 ? '' : ' ') + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

function nextDateForWeekday(weekdayName, hour, minute) {
  const now = new Date();
  const targetDay = DAY_TO_INDEX[weekdayName];
  if (targetDay === undefined) return null;

  const result = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0));
  const currentDay = result.getUTCDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

function buildLectureEvents(userId) {
  const lectures = lectureService.getLecturesByUserId(userId);
  const events = [];

  for (const lec of lectures) {
    const [hourStr, minuteStr] = (lec.lectureTime || '00:00').split(':');
    const hour = parseInt(hourStr, 10) || 0;
    const minute = parseInt(minuteStr, 10) || 0;

    const start = nextDateForWeekday(lec.lectureDay, hour, minute);
    if (!start) continue;

    const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1hr duration
    const icalDay = DAY_TO_ICAL[lec.lectureDay];

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:lecture-${lec.id}@acadia`,
        `DTSTAMP:${formatDateTimeUTC(new Date())}`,
        `DTSTART:${formatDateTimeUTC(start)}`,
        `DTEND:${formatDateTimeUTC(end)}`,
        icalDay ? `RRULE:FREQ=WEEKLY;BYDAY=${icalDay}` : '',
        `SUMMARY:${escapeText(`${lec.courseCode} Lecture`)}`,
        `DESCRIPTION:${escapeText(lec.courseName)}`,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
    );
  }

  return events;
}

function buildAssignmentEvents(userId) {
  const assignments = assignmentService.getAssignmentsByUserId(userId);
  const events = [];

  for (const a of assignments) {
    if (!a.dueDate) continue;
    const [hourStr, minuteStr] = (a.dueTime || '23:59').split(':');
    const hour = parseInt(hourStr, 10) || 23;
    const minute = parseInt(minuteStr, 10) || 59;
    const [year, month, day] = a.dueDate.split('-').map(Number);
    if (!year || !month || !day) continue;

    const start = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:assignment-${a.id}@acadia`,
        `DTSTAMP:${formatDateTimeUTC(new Date())}`,
        `DTSTART:${formatDateTimeUTC(start)}`,
        `DTEND:${formatDateTimeUTC(end)}`,
        `SUMMARY:${escapeText(`${a.courseCode} — ${a.title} due`)}`,
        `DESCRIPTION:${escapeText(`Status: ${a.status}`)}`,
        'END:VEVENT',
      ].join('\r\n')
    );
  }

  return events;
}

function buildExamEvents(userId) {
  const exams = examService.getExamsByUserId(userId);
  const events = [];

  for (const e of exams) {
    if (!e.examDate) continue;
    const [hourStr, minuteStr] = (e.examTime || '08:00').split(':');
    const hour = parseInt(hourStr, 10) || 8;
    const minute = parseInt(minuteStr, 10) || 0;
    const [year, month, day] = e.examDate.split('-').map(Number);
    if (!year || !month || !day) continue;

    const start = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2hr exam block

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:exam-${e.id}@acadia`,
        `DTSTAMP:${formatDateTimeUTC(new Date())}`,
        `DTSTART:${formatDateTimeUTC(start)}`,
        `DTEND:${formatDateTimeUTC(end)}`,
        `SUMMARY:${escapeText(`${e.courseCode} Exam`)}`,
        e.venue ? `LOCATION:${escapeText(e.venue)}` : '',
        `DESCRIPTION:${escapeText(`Status: ${e.status}`)}`,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
    );
  }

  return events;
}

function buildCalendarFeed(userId) {
  const events = [
    ...buildLectureEvents(userId),
    ...buildAssignmentEvents(userId),
    ...buildExamEvents(userId),
  ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Acadia//Academic Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Acadia Schedule',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    ...events,
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = { buildCalendarFeed };