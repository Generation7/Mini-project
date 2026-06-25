function info(message, meta = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...meta }));
}

function error(message, meta = {}) {
  console.error(JSON.stringify({ level: 'error', message, ...meta }));
}

module.exports = { info, error };
