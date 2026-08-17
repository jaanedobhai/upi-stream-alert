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
  chatMessageFormat: '_[username]_ thanks for the ₹[amount] UPI boss😎😎. _[username]_ op guys🍻🍻',
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
  if (typeof fieldData.minAmount !== 'undefined') config.minAmount = parseFloat(fieldData.minAmount) || 1;
  if (typeof fieldData.enableChatBot !== 'undefined') config.enableChatBot = fieldData.enableChatBot;
  if (fieldData.chatMessageFormat) config.chatMessageFormat = fieldData.chatMessageFormat;
  if (fieldData.nightbotToken) config.nightbotToken = fieldData.nightbotToken;
  if (fieldData.seJwtToken) config.seJwtToken = fieldData.seJwtToken;

  console.log('[UPI Widget] Loaded Config - Minimum Amount Filter: ₹' + config.minAmount);

  initConnection();
});

function toUnicodeItalics(str) {
  if (!str) return '';
  const italicMap = {
    'a': '𝘢', 'b': '𝘣', 'c': '𝘤', 'd': '𝘥', 'e': '𝘦', 'f': '𝘧', 'g': '𝘨', 'h': '𝘩', 'i': '𝘪', 'j': '𝘫',
    'k': '𝘬', 'l': '𝘭', 'm': '𝘮', 'n': '𝘯', 'o': '𝘰', 'p': '𝘱', 'q': '𝘲', 'r': '𝘳', 's': '𝘴', 't': '𝘵',
    'u': '𝘶', 'v': '𝘷', 'w': '𝘸', 'x': '𝘹', 'y': '𝘺', 'z': '𝘻',
    'A': '𝘈', 'B': '𝘉', 'C': '𝘊', 'D': '𝘋', 'E': '𝘌', 'F': '𝘍', 'G': '𝘎', 'H': '𝘏', 'I': '𝘐', 'J': '𝘑',
    'K': '𝘒', 'L': '𝘓', 'M': '𝘔', 'N': '𝘕', 'O': '𝘖', 'P': '𝘗', 'Q': '𝘘', 'R': '𝘙', 'S': '𝘚', 'T': '𝘛',
    'U': '𝘜', 'V': '𝘝', 'W': '𝘞', 'X': '𝘟', 'Y': '𝘠', 'Z': '𝘡'
  };
  return str.split('').map(c => italicMap[c] || c).join('');
}

let resolvedSeChannelId = '';
let lastChatSentAlertKey = '';
let lastChatSentTime = 0;

/**
 * Sends automated chat message to YouTube/Twitch live chat via StreamElements Bot or Nightbot
 */
async function sendChatThankYouMessage(name, amount) {
  try {
    // 1. If running in Chrome Editor Preview iframe (and NOT OBS), skip chat POST
    // (This guarantees that when you have both Chrome Editor and OBS open, ONLY OBS broadcasts)
    const isObsStudio = (typeof window.obsstudio !== 'undefined');
    const isEditorIframe = (window.self !== window.top) || window.location.href.includes('/dashboard');

    if (isEditorIframe && !isObsStudio) {
      console.log('[UPI Widget] ℹ️ Chrome Editor preview detected: Skipping chat POST so OBS Live Stream sends the single message.');
      return;
    }

    const alertKey = `upi_chat_${name.toLowerCase().trim()}_${Math.round(amount)}`;
    const now = Date.now();

    // 1. In-memory 12-second deduplication
    if (alertKey === lastChatSentAlertKey && (now - lastChatSentTime) < 12000) {
      console.log('[UPI Widget] Duplicate chat alert blocked by in-memory lock:', alertKey);
      return;
    }

    // 2. Storage-level 12-second deduplication across any reloaded/parallel scopes
    try {
      const storageTime = parseInt(sessionStorage.getItem(alertKey) || '0', 10);
      if (now - storageTime < 12000) {
        console.log('[UPI Widget] Duplicate chat alert blocked by session storage lock:', alertKey);
        return;
      }
      sessionStorage.setItem(alertKey, now.toString());
    } catch (e) {}

    lastChatSentAlertKey = alertKey;
    lastChatSentTime = now;

    // True Unicode Italics (renders natively on YouTube, Mobile, PC, OBS)
    const italicName = toUnicodeItalics(name);

    let template = config.chatMessageFormat || '[username] thanks for the ₹[amount] UPI boss😎😎. [username] op guys🍻🍻';
    
    // Clean any literal underscores and replace with actual Unicode Italics
    let message = template
      .replace(/_?\[username\]_?/gi, italicName)
      .replace(/\[amount\]/gi, amount);

    console.log(`[UPI Widget] 💬 Sending EXACTLY ONE Live Chat Message: "${message}"`);

    // METHOD A: StreamElements Bot REST API (for YouTube & Twitch via JWT Token)
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
        fetch(`https://api.streamelements.com/kappa/v2/bot/${targetChannelId}/say`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: message })
        }).then(res => {
          console.log('[UPI Widget] ✅ Bot Message successfully POSTed to Live Chat (Status: ' + res.status + ')');
        }).catch(err => {
          console.warn('[UPI Widget] Bot say error:', err);
        });
      }
      return; // EXCLUSIVE RETURN: Never run any other method
    }

    // METHOD B: Nightbot REST API
    if (config.nightbotToken && config.nightbotToken.trim() !== '') {
      fetch('https://api.nightbot.tv/1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.nightbotToken.trim()}`
        },
        body: JSON.stringify({ message: message })
      }).catch(e => {});
      return; // EXCLUSIVE RETURN
    }

    // METHOD C: Native StreamElements Overlay Chat (Twitch only when no JWT provided)
    if (window.SE_API && typeof window.SE_API.sendChatMessage === 'function') {
      window.SE_API.sendChatMessage(message);
      return;
    }
  } catch (err) {
    console.error('[UPI Widget] Chat message dispatch error:', err);
  }
}

let isInitialized = false;

// Standalone fallback initialization if opened outside StreamElements
if (typeof window.SE_API === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!isInitialized) {
      isInitialized = true;
      initConnection();
    }
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

let lastProcessedAlertKey = '';
let lastProcessedAlertTime = 0;

function queueAlert(data) {
  if (!data) return;

  const amount = parseFloat(data.amount) || 0;
  const minAmt = parseFloat(config.minAmount) || 1;

  if (amount < minAmt) {
    console.log(`[UPI Widget] ℹ️ Donation of ₹${amount} is below minimum threshold ₹${minAmt} — Alert Skipped.`);
    return;
  }

  const rawName = data.username || 'Anonymous';
  const alertKey = `q_${rawName.toLowerCase().trim()}_${Math.round(amount)}`;
  const now = Date.now();

  // Deduplication: Ignore identical alerts arriving within 10 seconds
  if (alertKey === lastProcessedAlertKey && (now - lastProcessedAlertTime) < 10000) {
    console.log('[UPI Widget] Duplicate alert event ignored in queue:', alertKey);
    return;
  }
  lastProcessedAlertKey = alertKey;
  lastProcessedAlertTime = now;

  alertQueue.push(data);
  processQueue();
}

function processQueue() {
  if (isPlaying || alertQueue.length === 0) return;
  
  isPlaying = true;
  const item = alertQueue.shift();
  showAlert(item);
}

let activeEventSource = null;

/**
 * Option 1: 100% Zero-Setup Instant Cloud (No Account or Server Needed)
 */
function initInstantCloudConnection() {
  // Close any existing active EventSource to prevent duplicate listeners
  if (activeEventSource) {
    try {
      activeEventSource.close();
      console.log('[UPI Widget] Closed previous EventSource connection.');
    } catch (e) {}
    activeEventSource = null;
  }

  let sseUrl = config.cloudChannelUrl.trim().replace(/\/+$/, '');
  if (!sseUrl.endsWith('/sse')) sseUrl += '/sse';

  console.log(`[UPI Widget] ⚡ Connecting to Zero-Config Cloud Channel: ${sseUrl}`);

  try {
    activeEventSource = new EventSource(sseUrl);

    activeEventSource.onopen = () => {
      console.log('[UPI Widget] ✅ Connected to Zero-Config Cloud Relay!');
    };

    activeEventSource.onmessage = (event) => {
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

    activeEventSource.onerror = (err) => {
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

let currentTtsSource = null;
let currentDirectAudio = null;

let currentKalpanaAudio = null;

function playTTS(text) {
  if (!config.enableTts || !text) return;

  const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
  const kalpanaUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

  try {
    // 1. Cancel any native speech synthesis to guarantee zero parallel echo
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    // 2. Stop any existing audio instance immediately
    if (currentKalpanaAudio) {
      try {
        currentKalpanaAudio.pause();
        currentKalpanaAudio.currentTime = 0;
      } catch (e) {}
      currentKalpanaAudio = null;
    }

    // 3. Play EXACTLY 1 dedicated crisp single voice stream
    currentKalpanaAudio = new Audio(kalpanaUrl);
    currentKalpanaAudio.volume = 1.0;
    
    currentKalpanaAudio.play().then(() => {
      console.log(`[UPI Widget] 🎙️ Crystal-Clear Single Kalpana Voice Played: "${cleanText}"`);
    }).catch(err => {
      console.warn('[UPI Widget] HTML5 Audio playback fallback:', err);
      playBrowserFallbackTTS(cleanText);
    });
  } catch (err) {
    console.error('[UPI Widget] TTS playback error:', err);
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
