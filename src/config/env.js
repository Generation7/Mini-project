require('dotenv').config();

const env = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || './data/app.db',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'change_me_verify_token',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
  reminderPhone: process.env.REMINDER_PHONE || '',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
};

if (process.env.NODE_ENV === 'production' && env.jwtSecret === 'dev_only_insecure_secret_change_me') {
  throw new Error('JWT_SECRET must be set to a strong secret in production. Set it in your .env file.');
}

module.exports = env;