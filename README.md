# Mini Project: WhatsApp Workflow Automation Backend

This project is a beginner-friendly backend for WhatsApp-based workflow automation.

- Express.js API
- SQLite database
- Drizzle ORM/query layer
- WhatsApp Web reminder sender
- WhatsApp Cloud API webhook endpoints retained
- WhatsApp command parser
- IF → THEN rules
- Rule engine
- Lecture schedule registration
- Daily lecture reminder scheduler

## Project Structure

```txt
src/
  config/       Environment config
  controllers/  HTTP request handlers
  db/           SQLite client, schema, init, seed
  routes/       Express routes
  services/     Business logic, events, rules, WhatsApp API
  utils/        Helpers
```

## Setup

```bash
cp .env.example .env
npm install
npm run db:init
npm run seed
npm run dev
```

On Windows CMD, if `cp` is unavailable, use:

```cmd
copy .env.example .env
```

Set your reminder receiver phone number in `.env`:

```txt
REMINDER_PHONE=233XXXXXXXXX
```

## WhatsApp Web Setup

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm run dev
```

3. Scan the QR code printed in the terminal using WhatsApp:

```txt
WhatsApp → Linked devices → Link a device
```

4. Wait for this log:

```txt
WhatsApp connected
```

5. Create a lecture using the API.

6. When the reminder scheduler finds a lecture happening tomorrow, it sends:

```txt
Reminder: {courseCode} lecture is tomorrow at {lectureTime}
```

to `REMINDER_PHONE`.

## Test Instructions

### Health check

```powershell
Invoke-RestMethod http://localhost:3000/health
```

### Test WhatsApp webhook verification

```powershell
Invoke-RestMethod "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=change_me_verify_token&hub.challenge=test_challenge"
```

Expected:

```txt
test_challenge
```

### Test ADD LECTURE command

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/webhook" -Method POST -ContentType "application/json" -Body '{"entry":[{"changes":[{"value":{"messages":[{"from":"233000000002","text":{"body":"ADD LECTURE CSM258 Tuesday 08:00"}}]}}]}]}'
```

### Test IF THEN rule creation

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/webhook" -Method POST -ContentType "application/json" -Body '{"entry":[{"changes":[{"value":{"messages":[{"from":"233000000001","text":{"body":"IF assignment_created THEN notify"}}]}}]}]}'
```

### Test event processing

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/events" -Method POST -ContentType "application/json" -Body '{"type":"assignment_created","data":{}}'
```

## WhatsApp Cloud API Webhook

The existing webhook endpoints are preserved for incoming webhook testing.

Configure Meta Developers webhook callback URL as:

```txt
https://your-public-domain.com/webhook
```

Use the same verify token as `WHATSAPP_VERIFY_TOKEN` in `.env`.

For local development, expose your server with a tunnel such as ngrok, then set the public URL in Meta Developers.

If WhatsApp credentials are missing, outgoing sends are safely skipped and logged instead of failing.
