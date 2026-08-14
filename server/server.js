const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS for all origins (OBS / StreamElements iframe access)
app.use(cors({ origin: '*' }));
app.use(express.json());

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'upi_stream_secret_123';

// In-memory history of recent donations
const recentDonations = [];
const MAX_HISTORY = 50;

// Serve static overlay widget files directly for OBS browser source
app.use('/overlay', express.static(path.join(__dirname, '../streamelements-widget')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Get recent donation history
app.get('/api/donations', (req, res) => {
  res.json({
    donations: recentDonations
  });
});

/**
 * Webhook endpoint invoked by Android UPINotificationListenerService
 * Payload expected:
 * {
 *   "username": "Rahul Kumar",
 *   "amount": 250,
 *   "currency": "INR",
 *   "sourceApp": "Google Pay",
 *   "rawText": "...",
 *   "timestamp": 1723650000000
 * }
 */
app.post('/api/alert', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
  if (AUTH_TOKEN && authHeader && authHeader !== AUTH_TOKEN && authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Token' });
  }

  let { username, amount, currency, sourceApp, message, timestamp } = req.body;

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: 'Invalid or missing amount' });
  }

  const donation = {
    id: 'upi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    username: (username || 'Anonymous Supporter').trim(),
    amount: parseFloat(amount),
    currency: currency || 'INR',
    formattedAmount: `₹${parseFloat(amount).toLocaleString('en-IN')}`,
    alertText: `${(username || 'Anonymous Supporter').trim()} donated ₹${parseFloat(amount).toLocaleString('en-IN')} on UPI!`,
    sourceApp: sourceApp || 'UPI',
    message: message || '',
    timestamp: timestamp || Date.now()
  };

  recentDonations.unshift(donation);
  if (recentDonations.length > MAX_HISTORY) {
    recentDonations.pop();
  }

  console.log(`[UPI DONATION RECEIVED] ${donation.alertText} (via ${donation.sourceApp})`);

  // Broadcast to all connected StreamElements widgets & OBS overlays
  io.emit('donation_alert', donation);

  res.status(200).json({
    success: true,
    message: 'Alert broadcasted successfully',
    data: donation
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[OVERLAY CONNECTED] Client ID: ${socket.id} (Total: ${io.engine.clientsCount})`);

  // Send the last donation on connect if requested
  socket.on('get_last_donation', () => {
    if (recentDonations.length > 0) {
      socket.emit('last_donation', recentDonations[0]);
    }
  });

  // Allow test trigger from overlay UI directly
  socket.on('trigger_test_alert', (customData) => {
    const testDonation = {
      id: 'test_' + Date.now(),
      username: (customData && customData.username) || 'GamerRaju',
      amount: (customData && customData.amount) || 100,
      currency: 'INR',
      formattedAmount: `₹${(customData && customData.amount) || 100}`,
      alertText: `${(customData && customData.username) || 'GamerRaju'} donated ₹${(customData && customData.amount) || 100} on UPI!`,
      sourceApp: 'Google Pay (Test)',
      message: 'Keep up the great stream! 🔥',
      timestamp: Date.now()
    };
    console.log(`[TEST ALERT TRIGGERED] ${testDonation.alertText}`);
    io.emit('donation_alert', testDonation);
  });

  socket.on('disconnect', () => {
    console.log(`[OVERLAY DISCONNECTED] Client ID: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 UPI StreamElements Relay Server running on port ${PORT}`);
  console.log(`📡 Webhook URL for Android App: http://<YOUR-IP>:${PORT}/api/alert`);
  console.log(`🎨 Standalone Overlay URL for OBS: http://localhost:${PORT}/overlay/standalone-overlay.html`);
  console.log(`🔑 Auth Token: ${AUTH_TOKEN}`);
  console.log(`=======================================================`);
});
