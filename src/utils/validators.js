function requireFields(data, fields) {
  const errors = [];

  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field} is required`);
    }
  }

  return errors;
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value || '');
}

module.exports = { requireFields, isValidTime };