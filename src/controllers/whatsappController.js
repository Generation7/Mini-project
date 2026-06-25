const { getQRCode, getStatus, sendMessage } = require('../services/whatsappWebService');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

async function getQRCodeEndpoint(req, res) {
  const qrCode = getQRCode();
  if (!qrCode) {
    return res.status(202).json({
      status: 'waiting',
      message: 'QR code not yet generated. WhatsApp Web is initializing. Please wait...',
    });
  }
  res.json({ qrCode });
}

async function getStatusEndpoint(req, res) {
  const status = getStatus();
  res.json(status);
}

async function getQRPageEndpoint(req, res) {
  const qrCode = getQRCode();
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp QR Code</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
          font-size: 24px;
        }
        .status {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }
        img {
          max-width: 300px;
          margin: 20px 0;
        }
        .waiting {
          color: #ff9800;
          padding: 20px;
          background: #fff3e0;
          border-radius: 8px;
          margin: 20px 0;
        }
        .instructions {
          color: #555;
          font-size: 14px;
          margin-top: 20px;
          text-align: left;
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
        }
        .instructions li {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📱 WhatsApp Connection</h1>
        ${qrCode
          ? `<div class="status">✅ QR Code Ready</div>
             <img src='${qrCode}' alt="WhatsApp QR Code" style="border: 2px solid #667eea; padding: 10px; border-radius: 8px;">
             <div class="instructions">
               <strong>Instructions:</strong>
               <ol>
                 <li>Open WhatsApp on your phone</li>
                 <li>Go to Settings → Linked Devices</li>
                 <li>Tap "Link a Device"</li>
                 <li>Point your phone camera at this QR code</li>
               </ol>
             </div>`
          : `<div class="waiting">⏳ Initializing WhatsApp Web... Please wait (usually takes 20-30 seconds)</div>
             <p class="status">This page will auto-refresh when the QR code is ready.</p>
             <script>
               setTimeout(() => location.reload(), 3000);
             </script>`
        }
      </div>
    </body>
    </html>
  `;
  res.send(html);
}

module.exports = { getQRCodeEndpoint, getStatusEndpoint, getQRPageEndpoint, resetConnection, sendTestMessage };

async function resetConnection(req, res) {
  try {
    const authPath = path.join(__dirname, '../../.wwebjs_auth');
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      logger.info('WhatsApp session cleared');
    }
    res.json({ success: true, message: 'Session cleared. Restart server to generate new QR code.' });
  } catch (err) {
    logger.error('Failed to clear session', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

async function sendTestMessage(req, res) {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'phoneNumber required' });
  }

  try {
    const result = await sendMessage(phoneNumber, '✅ WhatsApp Integration Test\n\nIf you see this message, your WhatsApp automation is working! 🎉');
    res.json(result);
  } catch (err) {
    logger.error('Failed to send test message', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}
