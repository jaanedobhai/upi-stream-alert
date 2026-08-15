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
  alertDuration: 8000,
  enableTts: true,
  ttsVoice: 'Kalpana', // Kalpana (Hindi Female), Raveena (Indian English), Brian (UK), etc.
  ttsDelay: 2, // 2-second delay
  ttsVolume: 0.9,
  minAmount: 1,
  soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  enableChatBot: true,
  chatMessageFormat: '[username] thanks for the ₹[amount] UPI boss😎😎. [username] op guys🍻🍻',
  nightbotToken: '',
  seJwtToken: '',
  seChannelId: ''
};

// StreamElements native initialization event
window.addEventListener('onWidgetLoad', function (obj) {
  const fieldData = obj.detail.fieldData || {};
  const channel = obj.detail.channel || {};
  
  if (channel.id) config.seChannelId = channel.id;
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
  if (typeof fieldData.enableChatBot !== 'undefined') config.enableChatBot = fieldData.enableChatBot;
  if (fieldData.chatMessageFormat) config.chatMessageFormat = fieldData.chatMessageFormat;
  if (fieldData.nightbotToken) config.nightbotToken = fieldData.nightbotToken;
  if (fieldData.seJwtToken) config.seJwtToken = fieldData.seJwtToken;

  initConnection();
});

let resolvedSeChannelId = '';
let lastChatSentMsg = '';
let lastChatSentTime = 0;

/**
 * Sends automated chat message to YouTube/Twitch live chat via StreamElements Bot or Nightbot
 */
async function sendChatThankYouMessage(name, amount) {
  try {
    const template = config.chatMessageFormat || '[username] thanks for the ₹[amount] UPI boss😎😎. [username] op guys🍻🍻';
    const message = template
      .replace(/\[username\]/gi, name)
      .replace(/\[amount\]/gi, amount);

    const now = Date.now();
    // 5-second deduplication: Never send exact same message twice
    if (lastChatSentMsg === message && now - lastChatSentTime < 5000) {
      console.log('[UPI Widget] Duplicate chat message ignored.');
      return;
    }
    lastChatSentMsg = message;
    lastChatSentTime = now;

    console.log(`[UPI Widget] 💬 Sending Single Live Chat Message: "${message}"`);

    // Priority 1: StreamElements Bot REST API (for YouTube & Twitch via JWT Token)
    if (config.seJwtToken && config.seJwtToken.trim() !== '') {
      const token = config.seJwtToken.trim();

      if (!resolvedSeChannelId) {
        try {
          const meRes = await fetch('https://api.streamelements.com/kappa/v2/channels/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            resolvedSeChannelId = meData._id || meData.id;
            console.log('[UPI Widget] ✅ StreamElements Channel ID Resolved:', resolvedSeChannelId);
          }
        } catch (e) {
          console.warn('[UPI Widget] Failed to fetch channel ID:', e);
        }
      }

      const targetChannelId = resolvedSeChannelId || config.seChannelId;
      if (targetChannelId) {
        const botRes = await fetch(`https://api.streamelements.com/kappa/v2/bot/${targetChannelId}/say`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: message })
        });
        if (botRes.ok) {
          console.log('[UPI Widget] ✅ Bot Message successfully posted to Live Chat!');
          return; // Sent successfully, exit to avoid duplicate
        }
      }
    }

    // Priority 2: Nightbot REST API (if configured)
    if (config.nightbotToken && config.nightbotToken.trim() !== '') {
      fetch('https://api.nightbot.tv/1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.nightbotToken.trim()}`
        },
        body: JSON.stringify({ message: message })
      }).catch(e => {});
      return;
    }

    // Priority 3: Fallback Native StreamElements Overlay Chat Dispatch
    if (window.SE_API && typeof window.SE_API.sendChatMessage === 'function') {
      window.SE_API.sendChatMessage(message);
    }
  } catch (err) {
    console.error('[UPI Widget] Chat message dispatch error:', err);
  }
}

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
  const progressFillEl = document.getElementById('alert-progress-fill');

  const rawName = data.username || 'Anonymous';
  const name = formatIndianName(rawName);
  donorNameEl.textContent = name;
  donorAmountEl.textContent = data.formattedAmount || `₹${Math.round(data.amount)}`;
  avatarInitialEl.textContent = name.charAt(0).toUpperCase();
  appTagEl.textContent = data.sourceApp || 'UPI';

  // 1. Play alert sound instantly (0ms)
  playAlertSound();

  const formattedAmt = Math.round(data.amount);

  // 2. Send automated Chat Message (Nightbot / StreamElements Bot)
  if (config.enableChatBot) {
    sendChatThankYouMessage(name, formattedAmt);
  }

  // 3. Play TTS speech after short delay (1.2s so sound chime plays first)
  if (config.enableTts) {
    const speechText = `${name} ne ${formattedAmt} rupees U.P.I. kiye hain!`;
    const ttsDelay = typeof config.ttsDelay !== 'undefined' ? parseInt(config.ttsDelay) * 1000 : 1200;

    setTimeout(() => {
      playTTS(speechText);
    }, ttsDelay);
  }

  // 3. Instant Visual Entrance
  progressFillEl.style.transition = 'none';
  progressFillEl.style.width = '100%';
  
  container.classList.remove('hidden');
  container.classList.add('active');

  setTimeout(() => {
    progressFillEl.style.transition = `width ${config.alertDuration}ms linear`;
    progressFillEl.style.width = '0%';
  }, 20);

  // Hide alert after duration
  setTimeout(() => {
    container.classList.remove('active');
    container.classList.add('hidden');
    
    setTimeout(() => {
      isPlaying = false;
      processQueue();
    }, 400);
  }, config.alertDuration);
}

let globalAudioCtx = null;
function getAudioContext() {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      globalAudioCtx = new AudioContext();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(e => {});
  }
  return globalAudioCtx;
}

// Unlock audio on first interaction in preview
document.addEventListener('click', () => {
  getAudioContext();
});

function playAlertSound() {
  try {
    if (config.soundUrl) {
      const audio = new Audio(config.soundUrl);
      audio.volume = 0.7; // Pleasant chime volume
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
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + index * 0.1;
      gain.gain.setValueAtTime(0.4, startTime);
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

let currentTtsAudio = null;

function playTTS(text) {
  if (!config.enableTts || !text) return;

  const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
  const kalpanaUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

  try {
    // Stop any previous playing audio to prevent overlapping echo
    if (currentTtsAudio) {
      try {
        currentTtsAudio.pause();
        currentTtsAudio.currentTime = 0;
      } catch (e) {}
    }

    currentTtsAudio = new Audio(kalpanaUrl);
    currentTtsAudio.volume = 1.0;
    currentTtsAudio.play().then(() => {
      console.log(`[UPI Widget] 🎙️ Clean Single Kalpana Voice Played: "${cleanText}"`);
    }).catch(err => {
      console.warn('[UPI Widget] HTML5 audio error:', err);
    });
  } catch (err) {
    console.error('[UPI Widget] TTS error:', err);
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
  let name = raw.trim()
    .replace(/\(.*?\)/g, "")
    .replace(/[\[\]{}<>]/g, "")
    .replace(/[._\-+@/\\#]/g, " ")
    .trim();

  // 1. Convert PascalCase / CamelCase (e.g. RajuAliKhan, AmanSharma, TechnicalGuruji)
  name = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  // If already separated by spaces, capitalize each word
  if (name.includes(" ")) {
    return name.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }

  // 2. Universal Unspaced compound names (e.g. RAJUALIKHAN, ROHITSHARMA, VIRATKOHLI, HARSHITGUPTA)
  const lower = name.toLowerCase();
  
  const dict = [
    // Surnames / Endings
    "sharma", "verma", "gupta", "singh", "kumar", "khan", "patel", "yadav", "mishra", "pandey", "tiwari", 
    "dubey", "shukla", "tripathi", "pathak", "chaubey", "dwivedi", "jha", "mandal", "paswan", "thakur", 
    "chaudhary", "choudhury", "malik", "mallick", "ansari", "ahmed", "ahmad", "hussain", "husain", "sheikh", 
    "shaikh", "alam", "raza", "khatun", "khatoon", "parveen", "begum", "siddiqui", "bano", "akhtar", 
    "shah", "jain", "agarwal", "agrawal", "mittal", "bansal", "goyal", "saxena", "bhatnagar", "srivastava", 
    "mathur", "kulshrestha", "rastogi", "nigam", "sinha", "ghosh", "mukherjee", "banerjee", "chatterjee", 
    "ganguly", "bhattacharya", "pal", "chandra", "dutta", "chakraborty", "mitra", "sengupta", "dasgupta", 
    "majumdar", "bhowmick", "saha", "halder", "barman", "paul", "biswas", "roy", "ray", "sarkar", "mondal", 
    "adiga", "rao", "murthy", "hegde", "bhat", "shetty", "rai", "gowda", "naidu", "chowdary", "reddy", 
    "nair", "pillai", "menon", "kurup", "panicker", "nambiar", "iyer", "iyengar", "deshmukh", "patil", 
    "pawar", "kadam", "shinde", "gaikwad", "chavan", "more", "salunkhe", "jadhav", "bhosale", "sawant", 
    "kohli", "pandya", "gill", "jaiswal", "pant", "dhoni", "rahane", "pujara", "ashwin", "bumrah", "shami", 
    "siraj", "kuldeep", "chahal", "tewatia", "samson", "kishan", "rathi", "badoni", "varma", "mehta", 
    "joshi", "bose", "kaur", "devi", "prasad", "prakash", "narayan", "swamy", "swami", "nathan", "mani",
    
    // Middle components / Connectors
    "ali", "kumar", "singh", "raj", "chand", "chandra", "nath", "kant", "lal", "ram", "dev", "das", "pal", 
    "deep", "preet", "meet", "jeet", "inder", "ender", "wati", "rani", "sen",
    
    // First names / Prefixes
    "raju", "rahul", "amit", "rohit", "mohd", "md", "syed", "aman", "vikas", "vikram", "priya", "neha", 
    "pooja", "anil", "sunil", "deepak", "sanjay", "ajay", "vijay", "rajesh", "suresh", "manoj", "dinesh", 
    "santosh", "pankaj", "ashok", "mukesh", "kamlesh", "sachin", "vinod", "dhanraj", "harsh", "harshit", 
    "ankit", "tarun", "sahil", "akash", "abhishek", "ayush", "sourabh", "saurabh", "shivam", "subhash", 
    "prashant", "gaurav", "mayank", "kunal", "nikhil", "vivek", "mayur", "alok", "arun", "varun", "karan", 
    "chetan", "naveen", "praveen", "rakesh", "naresh", "mahesh", "umesh", "hemant", "jay", "dev", "ram", 
    "krishna", "radhe", "gopal", "govind", "madhav", "vishnu", "shiva", "ganesh", "surya", "om", "arif", 
    "asif", "salman", "aamir", "amir", "shahrukh", "irfan", "farhan", "zaheer", "wasim", "danish", "adnan", 
    "faizan", "sohail", "suhail", "sameer", "samir", "rizwan", "nadeem", "imran", "tariq", "zubair", 
    "rehan", "virat", "hardik", "rishabh", "shubman", "yashasvi", "sanju", "ishan", "jasprit", "mohammed", 
    "ravindra", "kl", "surya", "tilak", "axar", "shreyas", "ruturaj", "sarfaraz", "yuvraj", "gautam", 
    "virender", "sourav", "kapil", "sunil", "ravi", "anil", "zaheer", "harbhajan", "ashish", "munaf", 
    "bhuvneshwar", "umesh", "ishant", "deepak", "shardul", "prasidh", "arshdeep", "mukesh", "yuzvendra", 
    "ravi", "kuldeep", "varun", "washington", "shahbaz", "krunal", "venkatesh", "rahul", "nitish", "riyan"
  ];

  for (let i = 3; i <= lower.length - 3; i++) {
    const p1 = lower.substring(0, i);
    const rest = lower.substring(i);

    // 3 parts (first + middle + last)
    for (let j = 2; j <= rest.length - 2; j++) {
      const p2 = rest.substring(0, j);
      const p3 = rest.substring(j);
      if (dict.includes(p1) && dict.includes(p2) && dict.includes(p3)) {
        return [p1, p2, p3].map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // 2 parts (first + last)
    if (dict.includes(p1) && dict.includes(rest)) {
      return [p1, rest].map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  // Fallback: Title case
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
