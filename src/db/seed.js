require('./init');

const userService = require('../services/userService');
const ruleService = require('../services/ruleService');
const lectureService = require('../services/lectureService');

const user = userService.findOrCreateByPhoneNumber('233000000000');

ruleService.createRule({
  userId: user.id,
  trigger: 'assignment_created',
  condition: {},
  action: 'notify',
});

lectureService.createLecture({
  userId: user.id,
  courseCode: 'CSM258',
  courseName: 'CSM258',
  lectureDay: 'Tuesday',
  lectureTime: '08:00',
});

console.log('Seed data created.');