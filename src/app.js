const express = require('express');
const path = require('path');
const healthRoutes = require('./routes/healthRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const eventRoutes = require('./routes/eventRoutes');
const lectureRoutes = require('./routes/lectureRoutes');
const userRoutes = require('./routes/userRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const examRoutes = require('./routes/examRoutes');
const { notFoundHandler, errorHandler } = require('./utils/errorHandler');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/health', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/events', eventRoutes);
app.use('/lectures', lectureRoutes);
app.use('/users', userRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/exams', examRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;