function healthCheck(req, res) {
  res.json({ status: 'ok', service: 'mini-project-rule-engine' });
}

module.exports = { healthCheck };
