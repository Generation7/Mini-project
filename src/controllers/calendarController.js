const userService = require('../services/userService');
const calendarFeedService = require('../services/calendarFeedService');

function getFeed(req, res) {
  const { token } = req.params;
  const user = userService.findByCalendarToken(token);

  if (!user) {
    return res.status(404).send('Calendar not found');
  }

  const icsContent = calendarFeedService.buildCalendarFeed(user.id);

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="acadia.ics"');
  return res.status(200).send(icsContent);
}

function getFeedLink(req, res) {
  const token = userService.getOrCreateCalendarToken(req.userId);
  if (!token) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const feedUrl = `${baseUrl}/calendar/${token}/feed.ics`;

  return res.status(200).json({ success: true, feedUrl });
}

module.exports = { getFeed, getFeedLink };