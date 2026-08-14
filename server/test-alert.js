const http = require('http');

console.log("=== Testing Relay Server & Alert Dispatch ===");

const payload = JSON.stringify({
  username: "Vikram Malhotra",
  amount: 250,
  currency: "INR",
  sourceApp: "Google Pay",
  message: "GG bro, best streamer!"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/alert',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer upi_stream_secret_123',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`HTTP Status: ${res.statusCode}`);
    console.log(`Response: ${body}`);
    if (res.statusCode === 200) {
      console.log("✅ Alert successfully posted to Relay Server!");
      process.exit(0);
    } else {
      console.error("❌ Failed with status", res.statusCode);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error("❌ Request error (Make sure server is running):", err.message);
  process.exit(1);
});

req.write(payload);
req.end();
