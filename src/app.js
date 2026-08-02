const express = require('express');
const path = require('path');
const healthRoutes = require('./routes/healthRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const eventRoutes = require('./routes/eventRoutes');
const lectureRoutes = require('./routes/lectureRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const examRoutes = require('./routes/examRoutes');
const courseRoutes = require('./routes/courseRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const classRoutes = require('./routes/classRoutes');
const { notFoundHandler, errorHandler } = require('./utils/errorHandler');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/health', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/events', eventRoutes);
app.use('/lectures', lectureRoutes);
app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/exams', examRoutes);
app.use('/courses', courseRoutes);
app.use('/settings', settingsRoutes);
app.use('/telegram', telegramRoutes);
app.use('/classes', classRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;