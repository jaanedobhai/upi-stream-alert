// StreamElements Custom Widget JavaScript — Cloud & Serverless Ready

let alertQueue = [];
let isPlaying = false;
let socket = null;
let lastAlertTimestamp = Date.now();

// Configuration defaults — 100% Zero-Setup Instant Cloud
let config = {
  connectionMode: 'instant', // 'instant' (Zero Setup), 'firebase', or 'websocket'
  cloudChannelUrl: 'https://ntfy.sh/upi_alert_jaanedobhai_live',
  firebaseDbUrl: '',
  relayUrl: 'http://localhost:3000',
  alertDuration: 6000,
  enableTts: true,
  ttsVoice: 'Brian', // Brian, Raveena, Aditi, Amy, Matthew, etc.
  ttsVolume: 0.9,
  minAmount: 1,
  soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
};

// StreamElements native initialization event
window.addEventListener('onWidgetLoad', function (obj) {
  const fieldData = obj.detail.fieldData || {};
  
  if (fieldData.cloudChannelUrl) config.cloudChannelUrl = fieldData.cloudChannelUrl;
  if (fieldData.connectionMode) config.connectionMode = fieldData.connectionMode;
  if (fieldData.firebaseDbUrl) config.firebaseDbUrl = fieldData.firebaseDbUrl;
  if (fieldData.relayUrl) config.relayUrl = fieldData.relayUrl;
  if (fieldData.alertDuration) config.alertDuration = parseInt(fieldData.alertDuration) * 1000;
  if (typeof fieldData.enableTts !== 'undefined') config.enableTts = fieldData.enableTts;
  if (fieldData.ttsVoice) config.ttsVoice = fieldData.ttsVoice;
  if (fieldData.ttsVolume) config.ttsVolume = parseFloat(fieldData.ttsVolume) / 100;
  if (fieldData.soundUrl) config.soundUrl = fieldData.soundUrl;

  initConnection();
});

// Standalone fallback initialization if opened outside StreamElements
if (typeof window.SE_API === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initConnection();
  });
}

function initConnection() {
  if (config.connectionMode === 'firebase' && config.firebaseDbUrl) {
    initFirebaseConnection();
  } else if (config.connectionMode === 'websocket') {
    initSocketConnection();
  } else {
    initInstantCloudConnection();
  }
}

/**
 * Option 1: 100% Zero-Setup Instant Cloud (No Account or Server Needed)
 */
function initInstantCloudConnection() {
  let sseUrl = config.cloudChannelUrl.trim().replace(/\/+$/, '');
  if (!sseUrl.endsWith('/sse')) sseUrl += '/sse';

  console.log(`[UPI Widget] ⚡ Connecting to Zero-Config Cloud Channel: ${sseUrl}`);

  try {
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log('[UPI Widget] ✅ Connected to Zero-Config Cloud Relay!');
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const donation = JSON.parse(payload.message);
          console.log('[UPI Widget] 💰 Received Live UPI Donation:', donation);
          queueAlert(donation);
        }
      } catch (err) {
        console.error('[UPI Widget] Error parsing event message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[UPI Widget] SSE Reconnecting...', err);
    };
  } catch (err) {
    console.error('[UPI Widget] SSE Init Error:', err);
  }
}

/**
 * Option 1: Cloud WebSocket Server (Render / Railway / Glitch)
 */
function initSocketConnection() {
  if (typeof io === 'undefined') {
    setTimeout(initSocketConnection, 1000);
    return;
  }

  console.log(`[UPI Widget] Connecting via Cloud WebSocket: ${config.relayUrl}`);
  
  try {
    socket = io(config.relayUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log('[UPI Widget] ✅ Connected to Cloud Relay Server!');
    });

    socket.on('donation_alert', (data) => {
      console.log('[UPI Widget] Received donation event:', data);
      queueAlert(data);
    });

    socket.on('disconnect', () => {
      console.log('[UPI Widget] ❌ Disconnected from Cloud Server.');
    });
  } catch (err) {
    console.error('[UPI Widget] Connection error:', err);
  }
}

/**
 * Option 2: Serverless Firebase Realtime Database (100% Free & No Server to Host)
 */
function initFirebaseConnection() {
  if (typeof firebase === 'undefined') {
    setTimeout(initFirebaseConnection, 1000);
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({ databaseURL: config.firebaseDbUrl });
    }
    const db = firebase.database();
    console.log('[UPI Widget] ✅ Connected to Firebase Realtime Database!');

    // Listen only for newly added alerts after page load
    db.ref('alerts').orderByChild('timestamp').startAt(lastAlertTimestamp).on('child_added', (snapshot) => {
      const data = snapshot.val();
      if (data && data.timestamp >= lastAlertTimestamp) {
        lastAlertTimestamp = data.timestamp + 1;
        queueAlert(data);
      }
    });
  } catch (err) {
    console.error('[UPI Widget] Firebase connection error:', err);
  }
}

function queueAlert(data) {
  if (!data || data.amount < config.minAmount) return;
  alertQueue.push(data);
  processQueue();
}

function processQueue() {
  if (isPlaying || alertQueue.length === 0) return;
  
  isPlaying = true;
  const item = alertQueue.shift();
  showAlert(item);
}

function showAlert(data) {
  const container = document.getElementById('upi-alert-container');
  const donorNameEl = document.getElementById('donor-name');
  const donorAmountEl = document.getElementById('donor-amount');
  const avatarInitialEl = document.getElementById('avatar-initial');
  const appTagEl = document.getElementById('alert-app-tag');
  const messageEl = document.getElementById('alert-message');
  const progressFillEl = document.getElementById('alert-progress-fill');

  const name = data.username || 'Anonymous';
  donorNameEl.textContent = name;
  donorAmountEl.textContent = data.formattedAmount || `₹${data.amount}`;
  avatarInitialEl.textContent = name.charAt(0).toUpperCase();
  appTagEl.textContent = data.sourceApp || 'UPI';

  if (data.message && data.message.trim() !== '') {
    messageEl.textContent = `"${data.message}"`;
    messageEl.classList.remove('hidden');
  } else {
    messageEl.classList.add('hidden');
  }

  playAlertSound();

  if (config.enableTts && 'speechSynthesis' in window) {
    playTTS(`${name} donated ${data.amount} rupees on UPI!`);
  }

  progressFillEl.style.transition = 'none';
  progressFillEl.style.width = '100%';
  
  container.classList.remove('hidden');
  container.classList.add('active');

  setTimeout(() => {
    progressFillEl.style.transition = `width ${config.alertDuration}ms linear`;
    progressFillEl.style.width = '0%';
  }, 50);

  setTimeout(() => {
    container.classList.remove('active');
    container.classList.add('hidden');
    
    setTimeout(() => {
      isPlaying = false;
      processQueue();
    }, 600);
  }, config.alertDuration);
}

function playAlertSound() {
  try {
    if (config.soundUrl) {
      const audio = new Audio(config.soundUrl);
      audio.volume = 0.8;
      audio.play().catch(e => playFallbackSynthSound());
    } else {
      playFallbackSynthSound();
    }
  } catch (e) {
    playFallbackSynthSound();
  }
}

function playFallbackSynthSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + index * 0.1;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  } catch (err) {
    console.log('Web audio synth failed:', err);
  }
}

function playTTS(text) {
  if (!config.enableTts || !text) return;

  // 1. Try StreamElements Native Cloud Voice (Brian, Raveena, Aditi, etc.)
  const voice = config.ttsVoice || 'Brian';
  const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
  const seTtsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(cleanText)}`;

  try {
    const ttsAudio = new Audio(seTtsUrl);
    ttsAudio.volume = config.ttsVolume || 0.9;
    ttsAudio.play().then(() => {
      console.log(`[UPI Widget] Playing Native StreamElements TTS (${voice}): "${cleanText}"`);
    }).catch(err => {
      console.warn('[UPI Widget] StreamElements native TTS blocked, falling back to browser synthesis:', err);
      playBrowserFallbackTTS(cleanText);
    });
  } catch (err) {
    playBrowserFallbackTTS(cleanText);
  }
}

function playBrowserFallbackTTS(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = config.ttsVolume || 0.9;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en-US'));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Browser TTS failed:', err);
  }
}
