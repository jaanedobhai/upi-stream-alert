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
  ttsVoice: 'Kalpana', // Kalpana (Hindi Female), Raveena (Indian English), Brian (UK), etc.
  ttsDelay: 2, // 2-second delay
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
  if (typeof fieldData.ttsDelay !== 'undefined') config.ttsDelay = parseInt(fieldData.ttsDelay);
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

  const rawName = data.username || 'Anonymous';
  const name = formatIndianName(rawName);
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

  // 2-second delay before TTS starts speaking
  if (config.enableTts) {
    const formattedAmt = Math.round(data.amount);
    const speechText = `${name} ne ${formattedAmt} rupees U.P.I. kiye hain!`;
    const ttsDelay = typeof config.ttsDelay !== 'undefined' ? parseInt(config.ttsDelay) * 1000 : 2000;

    setTimeout(() => {
      playTTS(speechText);
    }, ttsDelay);
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

  const voice = config.ttsVoice || 'Kalpana';
  const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
  
  // 1. Kalpana Voice (Clear Natural Hindi Female Voice)
  let ttsUrl = '';
  if (voice.toLowerCase() === 'kalpana') {
    ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
  } else {
    // 2. StreamElements Cloud Voices (Brian, Raveena, Aditi, etc.)
    ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(cleanText)}`;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const ttsAudio = new Audio();
      ttsAudio.crossOrigin = "anonymous";
      ttsAudio.src = ttsUrl;

      const source = ctx.createMediaElementSource(ttsAudio);
      const gainNode = ctx.createGain();
      
      // 200% Volume Boost (2.0x Gain)
      gainNode.gain.setValueAtTime(2.0, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      ttsAudio.play().then(() => {
        console.log(`[UPI Widget] 🎙️ Playing 200% Boosted TTS (${voice}): "${cleanText}"`);
      }).catch(err => {
        // Fallback without Web Audio routing if browser policy limits
        const directAudio = new Audio(ttsUrl);
        directAudio.volume = 1.0;
        directAudio.play().catch(e => playBrowserFallbackTTS(cleanText));
      });
      return;
    }

    const directAudio = new Audio(ttsUrl);
    directAudio.volume = 1.0;
    directAudio.play().catch(e => playBrowserFallbackTTS(cleanText));
  } catch (err) {
    const directAudio = new Audio(ttsUrl);
    directAudio.volume = 1.0;
    directAudio.play().catch(e => playBrowserFallbackTTS(cleanText));
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

function formatIndianName(raw) {
  if (!raw) return "Anonymous";
  let name = raw.trim().replace(/[\(\)\[\]]/g, "").trim();

  // If already contains spaces, just title case
  if (name.includes(" ")) {
    return name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }

  // Segment joined names like RAJUALIKHAN, RAHULKUMAR, AMITSINGH
  const lower = name.toLowerCase();
  
  const patterns = [
    // 3 parts: e.g. rajualikhan
    /^(raju|rahul|amit|rohit|mohd|md|aman|vikas|vikram|priya|neha|pooja|anil|sunil|deepak|sanjay|ajay|vijay|rajesh|suresh|manoj|dinesh|santosh|pankaj|ashok|mukesh|kamlesh|sachin|vinod|dhanraj|harsh|ankit|tarun|sahil)(ali|kumar|singh|raj|chand|nath|kant|lal|ram|dev|das|pal)(khan|sharma|verma|gupta|yadav|singh|patel|kumar|das|roy|reddy|nair|joshi|bose|kaur|devi|ahmed|alam|ansari|hussain|sheikh|raza|mallick|tiwari|pandey|mishra|jha|shah|jain|agarwal|choudhury|chaudhary|malik)$/i,
    // 2 parts: e.g. rajukhan, alikhan, rahulkumar, amitsingh
    /^(raju|rahul|amit|rohit|mohd|md|aman|vikas|vikram|priya|neha|pooja|anil|sunil|deepak|sanjay|ajay|vijay|rajesh|suresh|manoj|dinesh|santosh|pankaj|ashok|mukesh|kamlesh|sachin|vinod|harsh|ankit|tarun|sahil|ali|arif|asif|salman|aamir|shahrukh|irfan|farhan|zaheer|wasim|danish|adnan|faizan|sohail|sameer|rizwan|nadeem|imran|tariq|zubair|rehan|akash|abhishek|ayush|sourabh|shivam|subhash|prashant|gaurav|mayank|kunal|nikhil|vivek|mayur|alok|arun|varun|karan|chetan|naveen|praveen|rakesh|naresh|mahesh|umesh|hemant|jay|dev|ram|krishna|radhe|gopal|govind|madhav|vishnu|shiva|ganesh|surya|om)(khan|kumar|singh|sharma|verma|gupta|yadav|patel|das|roy|reddy|nair|joshi|bose|kaur|devi|ahmed|alam|ansari|hussain|sheikh|raza|mallick|tiwari|pandey|mishra|jha|shah|jain|agarwal|choudhury|chaudhary|malik|ali|begum|khatun|parveen|siddiqui|bano|akter|biwi|sen|ghosh|mukherjee|banerjee|chatterjee|dutta|pal|mitra|saha|biswas|paul|sarkar|mondal|rao|hegde|bhat|shetty|rai|gowda|naidu|pillai|menon|nambiar|iyer|iyengar|deshmukh|patil|pawar|kadam|shinde|gaikwad|jadhav|bhosale|sawant|chavan|more|salunkhe)$/i
  ];

  for (const regex of patterns) {
    const match = lower.match(regex);
    if (match) {
      return match.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }

  // Fallback: Title case
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
