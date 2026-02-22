import './style.css';
import confetti from 'canvas-confetti';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, runTransaction } from 'firebase/database';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIza" + "SyDjEu" + "71FYxr8" + "Ebqhd3fy" + "SP-4qx" + "uWNxSC6Q",
  authDomain: "finger-of-shame.firebaseapp.com",
  storageBucket: "finger-of-shame.firebasestorage.app",
  databaseURL: "https://finger-of-shame-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- TRACK DATA ---
const audioFiles = [
  { file: 'Alice_s_Best_Day.mp3', title: "Alice's Best Day", icon: '🌟' },
  { file: 'Alice_s_Birthday_Bash.mp3', title: "Birthday Bash", icon: '🎉' },
  { file: 'Alice_s_Birthday_Orbit.mp3', title: "Birthday Orbit", icon: '🚀' },
  { file: 'Disneyland_Dreams.mp3', title: "Disneyland Dreams", icon: '🏰' },
  { file: 'Ten_Years_to_the_Sun.mp3', title: "Ten Years to the Sun", icon: '☀️' },
  { file: 'The_Best_Day_Ever_.mp3', title: "The Best Day Ever!", icon: '💖' }
];

const REACTIONS = [
  { emoji: '❤️', key: 'heart' },
  { emoji: '🔥', key: 'fire' },
  { emoji: '😂', key: 'laugh' },
  { emoji: '😍', key: 'love_eyes' },
  { emoji: '👑', key: 'crown' }
];

// --- DOM ELEMENTS ---
const grid = document.getElementById('audio-grid');
const nowPlayingContainer = document.getElementById('now-playing-container');
const nowPlayingTitle = document.getElementById('now-playing-title');
const visualizerCanvas = document.getElementById('visualizer-canvas');
const visualizerCtx = visualizerCanvas.getContext('2d');

let currentAudio = null;
let currentCard = null;
let audioContext = null;
let analyserNode = null;
let animationFrameId = null;

// --- AUDIO PRELOADING ---
const audioCache = {};
audioFiles.forEach(track => {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = `${import.meta.env.BASE_URL}Audio/${track.file}`;
  audioCache[track.file] = audio;
});

// ==============================
//  BIRTHDAY GREETING MODAL
// ==============================
function showBirthdayModal() {
  const modal = document.getElementById('birthday-modal');
  const dismissBtn = document.getElementById('modal-dismiss-btn');

  if (localStorage.getItem('alice-birthday-seen')) {
    modal.classList.add('hidden');
    return;
  }

  modal.classList.remove('hidden');

  // Big confetti burst for the modal
  setTimeout(() => {
    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.4 },
      colors: ['#ff007f', '#7a00cc', '#ffd700', '#ffffff', '#ff69b4']
    });
  }, 400);

  dismissBtn.addEventListener('click', () => {
    modal.classList.add('dismissing');
    localStorage.setItem('alice-birthday-seen', '1');

    // One more burst on dismiss
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#ff007f']
    });

    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('dismissing');
    }, 600);
  });
}

showBirthdayModal();

// ==============================
//  MAGICAL CONFETTI
// ==============================
function fireMagicalConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 8,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#ff007f', '#7a00cc', '#ffd700', '#ffffff'],
      disableForReducedMotion: true
    });
    confetti({
      particleCount: 8,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#ff007f', '#7a00cc', '#ffd700', '#ffffff'],
      disableForReducedMotion: true
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// ==============================
//  AUDIO VISUALIZER
// ==============================
function setupVisualizer(audioElement) {
  // Clean up old visualizer
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create analyser
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 64;

    // Connect source -> analyser -> destination
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyserNode);
    analyserNode.connect(audioContext.destination);

    drawVisualizer();
  } catch (e) {
    console.warn('Visualizer setup failed:', e);
  }
}

function drawVisualizer() {
  if (!analyserNode) return;

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const canvas = visualizerCanvas;
  const ctx = visualizerCtx;
  const barCount = 8;
  const barWidth = canvas.width / barCount - 2;

  function draw() {
    animationFrameId = requestAnimationFrame(draw);
    analyserNode.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * Math.floor(bufferLength / barCount)] || 0;
      const barHeight = (value / 255) * canvas.height;
      const x = i * (barWidth + 2);
      const y = canvas.height - barHeight;

      // Gradient from pink to gold
      const gradient = ctx.createLinearGradient(x, canvas.height, x, y);
      gradient.addColorStop(0, '#ff007f');
      gradient.addColorStop(1, '#ffd700');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  draw();
}

function stopVisualizer() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  // Clear canvas
  visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
}

// ==============================
//  REACTION SOUND EFFECTS
// ==============================
function playReactionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* ignore */ }
}

// ==============================
//  MAGIC PICKER CHIME SOUND
// ==============================
function playMagicChime(pitch = 1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Layer 1: Bell tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800 * pitch, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Layer 2: Harmonic overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1600 * pitch, ctx.currentTime);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Layer 3: Sparkle shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(2400 * pitch, ctx.currentTime);
    osc3.frequency.exponentialRampToValueAtTime(3200 * pitch, ctx.currentTime + 0.1);
    gain3.gain.setValueAtTime(0.04, ctx.currentTime);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc1.start(); osc1.stop(ctx.currentTime + 0.3);
    osc2.start(); osc2.stop(ctx.currentTime + 0.15);
    osc3.start(); osc3.stop(ctx.currentTime + 0.2);
  } catch (e) { /* ignore */ }
}

// ==============================
//  MOST LOVED TRACKER
// ==============================
const trackScores = {};
let currentMostLoved = null;

function updateMostLoved() {
  let maxScore = 0;
  let maxKey = null;

  for (const key of Object.keys(trackScores)) {
    const total = trackScores[key];
    if (total > maxScore) {
      maxScore = total;
      maxKey = key;
    }
  }

  // Remove old badge
  if (currentMostLoved && currentMostLoved !== maxKey) {
    const oldTrack = audioFiles.find(t => t.firebaseKey === currentMostLoved);
    if (oldTrack && oldTrack.cardElement) {
      oldTrack.cardElement.classList.remove('most-loved');
    }
  }

  // Add new badge (only if score > 0)
  if (maxKey && maxScore > 0) {
    const newTrack = audioFiles.find(t => t.firebaseKey === maxKey);
    if (newTrack && newTrack.cardElement) {
      newTrack.cardElement.classList.add('most-loved');
    }
    currentMostLoved = maxKey;
  }
}

// ==============================
//  BUILD AUDIO CARDS
// ==============================
audioFiles.forEach((track, index) => {
  const card = document.createElement('div');
  card.className = 'audio-card';
  card.style.animationDelay = `${index * 0.1}s`;

  const trackKey = track.file.replace(/[^a-zA-Z0-9]/g, '_');
  track.firebaseKey = trackKey;

  // Build reaction buttons HTML
  const reactionsHTML = REACTIONS.map(r =>
    `<button class="reaction-btn" data-reaction="${r.key}" onclick="event.stopPropagation()">
      <span class="reaction-emoji">${r.emoji}</span>
      <span class="reaction-count" data-count-key="${r.key}">0</span>
    </button>`
  ).join('');

  card.innerHTML = `
    <div class="most-loved-badge">👑 Most Loved</div>
    <div class="card-content" style="cursor: pointer;">
      <div class="card-icon">${track.icon}</div>
      <div class="card-title-container">
        <div class="card-title">${track.title}</div>
        <button class="share-track-btn" title="Share this track">🔗</button>
      </div>
    </div>
    <div class="reactions-container" onclick="event.stopPropagation()">
      ${reactionsHTML}
    </div>
    <div class="play-count">This song has been played 0 times</div>
  `;

  const cardContent = card.querySelector('.card-content');
  const playCountDisplay = card.querySelector('.play-count');
  const shareTrackBtn = card.querySelector('.share-track-btn');

  // --- REACTIONS ---
  const reactionBtns = card.querySelectorAll('.reaction-btn');
  const reactionsRef = ref(db, `alices-birthday-reactions/${trackKey}`);

  // Listen for realtime reaction counts
  onValue(reactionsRef, (snapshot) => {
    const data = snapshot.val() || {};
    let totalScore = 0;

    REACTIONS.forEach(r => {
      const count = data[r.key] || 0;
      totalScore += count;
      const countEl = card.querySelector(`[data-count-key="${r.key}"]`);
      if (countEl) countEl.textContent = count > 0 ? count : '';
    });

    trackScores[trackKey] = totalScore;
    updateMostLoved();
  });

  reactionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reactionKey = btn.dataset.reaction;
      const reactionRef = ref(db, `alices-birthday-reactions/${trackKey}`);

      runTransaction(reactionRef, (currentData) => {
        if (currentData === null) {
          return { [reactionKey]: 1 };
        }
        return {
          ...currentData,
          [reactionKey]: (currentData[reactionKey] || 0) + 1
        };
      }).catch(err => console.warn('Reaction sync failed', err));

      playReactionSound();
      btn.classList.add('just-reacted');
      setTimeout(() => btn.classList.remove('just-reacted'), 400);

      // Mini confetti from the button
      const rect = btn.getBoundingClientRect();
      confetti({
        particleCount: 12,
        spread: 30,
        origin: {
          x: rect.left / window.innerWidth + (rect.width / window.innerWidth / 2),
          y: rect.top / window.innerHeight
        },
        colors: ['#ff007f', '#ffd700', '#ff69b4'],
        shapes: ['star'],
        gravity: 1.5,
        scalar: 0.7
      });
    });
  });

  // --- PLAY COUNT (from Firebase) ---
  const dataRef = ref(db, `alices-birthday-votes/${trackKey}`);
  onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    playCountDisplay.textContent = `This song has been played ${data ? (data.plays || 0) : 0} times`;
  });

  // --- TRACK SHARING ---
  shareTrackBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const APP_URL = "https://fingergame.co.uk/AliceBirthday/";
    const trackShareUrl = `${APP_URL}?song=${encodeURIComponent(track.title)}`;
    const text = `Hey! Alice's 10th Birthday app is so cool! Listen to this track: "${track.title}" ${track.icon}. Check it out here: ${trackShareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });

  // --- PLAY TRACK ---
  cardContent.addEventListener('click', () => {
    // If clicking the currently playing track, stop it
    if (currentCard === card && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      card.classList.remove('playing');
      card.style.setProperty('--progress', '0');
      nowPlayingContainer.classList.add('hidden');
      document.documentElement.classList.remove('disco-mode');
      stopVisualizer();
      return;
    }

    // Stop previous
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (currentCard) {
        currentCard.classList.remove('playing');
        currentCard.style.setProperty('--progress', '0');
      }
      stopVisualizer();
    }

    // Get preloaded audio or create new
    const audio = audioCache[track.file];
    // We need a fresh audio element for visualizer source (can only be connected once)
    currentAudio = new Audio(audio.src);
    currentCard = card;

    // Increment play count
    runTransaction(dataRef, (currentData) => {
      if (currentData === null) {
        return { score: 0, plays: 1 };
      }
      return {
        ...currentData,
        plays: (currentData.plays || 0) + 1
      };
    }).catch(err => console.warn("Play count sync failed", err));

    currentAudio.play().then(() => {
      // Set up visualizer after play starts
      setupVisualizer(currentAudio);
    }).catch(e => console.error("Audio playback failed:", e));

    card.classList.add('playing');
    nowPlayingTitle.textContent = track.title;
    nowPlayingContainer.classList.remove('hidden');

    // Progress bar update
    currentAudio.addEventListener('timeupdate', () => {
      if (currentAudio.duration) {
        const progress = currentAudio.currentTime / currentAudio.duration;
        card.style.setProperty('--progress', progress.toString());
      }
    });

    // Confetti & disco
    fireMagicalConfetti();
    document.documentElement.classList.add('disco-mode');

    // When audio finishes
    currentAudio.addEventListener('ended', () => {
      card.classList.remove('playing');
      card.style.setProperty('--progress', '0');
      nowPlayingContainer.classList.add('hidden');
      document.documentElement.classList.remove('disco-mode');
      stopVisualizer();
    });
  });

  grid.appendChild(card);
  track.cardElement = card;
});

// ==============================
//  MAGIC TRACK PICKER
// ==============================
const magicBtn = document.getElementById('magic-picker-btn');

magicBtn.addEventListener('click', () => {
  if (magicBtn.disabled) return;
  magicBtn.disabled = true;
  magicBtn.innerText = "✨ SPINNING... ✨";

  // Stop current track
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentCard) {
      currentCard.classList.remove('playing');
      currentCard.style.setProperty('--progress', '0');
    }
    nowPlayingContainer.classList.add('hidden');
    document.documentElement.classList.remove('disco-mode');
    stopVisualizer();
  }

  let spinCount = 0;
  const maxSpins = Math.floor(Math.random() * 10) + 20;
  let currentHighlightIndex = 0;
  let delay = 50;

  const spinStep = () => {
    // Remove previous highlight
    audioFiles.forEach(t => t.cardElement.classList.remove('highlighted'));

    // Highlight current
    const targetCard = audioFiles[currentHighlightIndex].cardElement;
    targetCard.classList.add('highlighted');

    // Musical chime sound (pitch varies as it slows)
    const pitchVariation = 0.8 + (spinCount / maxSpins) * 0.6;
    playMagicChime(pitchVariation);

    spinCount++;

    if (spinCount < maxSpins) {
      currentHighlightIndex = (currentHighlightIndex + 1) % audioFiles.length;
      delay += 10 + (spinCount * 1.5);
      setTimeout(spinStep, delay);
    } else {
      // Spin finished!
      magicBtn.disabled = false;
      magicBtn.innerText = "✨ PICK A MAGIC TRACK! ✨";

      // Play winning track
      const winningTrack = audioFiles[currentHighlightIndex];
      winningTrack.cardElement.querySelector('.card-content').click();

      // Extra large confetti
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#ff007f', '#7a00cc', '#ffd700', '#ffffff']
        });
      }, 500);
    }
  };

  spinStep();
});

// ==============================
//  DRIFTING SPARKLES
// ==============================
function createDriftingSparkle() {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';

  const size = Math.random() * 4 + 2;
  sparkle.style.width = `${size}px`;
  sparkle.style.height = `${size}px`;
  sparkle.style.left = `${Math.random() * 100}%`;

  // Random drift direction
  const driftX = (Math.random() - 0.5) * 100;
  sparkle.style.setProperty('--drift-x', `${driftX}px`);

  // Random duration (slow float)
  const duration = Math.random() * 8 + 6;
  sparkle.style.animationDuration = `${duration}s`;
  sparkle.style.animationDelay = `${Math.random() * 5}s`;

  // Random colour variation
  const colors = ['#ffd700', '#ff007f', '#ffffff', '#ff69b4', '#7a00cc'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  sparkle.style.backgroundColor = color;
  sparkle.style.boxShadow = `0 0 10px 2px ${color}`;

  document.body.appendChild(sparkle);

  // Remove and recreate after animation
  sparkle.addEventListener('animationend', () => {
    sparkle.remove();
    createDriftingSparkle();
  });
}

// Launch initial sparkles with staggered timing
for (let i = 0; i < 25; i++) {
  setTimeout(() => createDriftingSparkle(), i * 300);
}

// ==============================
//  EASTER EGG: Crown Tap
// ==============================
const crownEl = document.getElementById('crown-easter-egg');
let crownTapCount = 0;
let crownTapTimer = null;

crownEl.addEventListener('click', (e) => {
  e.preventDefault();
  crownTapCount++;

  // Visual feedback: shake
  crownEl.classList.remove('shaking');
  void crownEl.offsetWidth; // Force reflow to restart animation
  crownEl.classList.add('shaking');

  // Reset counter after 3 seconds of no tapping
  clearTimeout(crownTapTimer);
  crownTapTimer = setTimeout(() => {
    crownTapCount = 0;
  }, 3000);

  if (crownTapCount >= 10) {
    crownTapCount = 0;

    // GOLDEN CONFETTI EXPLOSION
    const duration = 3000;
    const end = Date.now() + duration;

    (function goldenBurst() {
      confetti({
        particleCount: 15,
        angle: 60,
        spread: 80,
        origin: { x: 0, y: 0.3 },
        colors: ['#ffd700', '#ffaa00', '#fff4b8', '#ffffff'],
        shapes: ['star'],
        scalar: 1.5
      });
      confetti({
        particleCount: 15,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.3 },
        colors: ['#ffd700', '#ffaa00', '#fff4b8', '#ffffff'],
        shapes: ['star'],
        scalar: 1.5
      });
      confetti({
        particleCount: 20,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#ff007f', '#ffaa00'],
        shapes: ['star'],
        scalar: 2
      });

      if (Date.now() < end) {
        requestAnimationFrame(goldenBurst);
      }
    }());

    // Show secret message
    const reveal = document.createElement('div');
    reveal.className = 'easter-egg-reveal';
    reveal.innerHTML = '<h2>👑 Alice is the Birthday Queen! 👑</h2>';
    document.body.appendChild(reveal);

    setTimeout(() => {
      reveal.remove();
    }, 3000);
  }
});

// ==============================
//  WHATSAPP SHARING
// ==============================
const shareAppBtn = document.getElementById('share-app-btn');
if (shareAppBtn) {
  shareAppBtn.addEventListener('click', () => {
    const APP_URL = "https://fingergame.co.uk/AliceBirthday/";
    const text = "Alice is turning 10! 🎂✨ Check out this magical Birthday App to play music and vote for her favourite tracks. Disneyland, here we come!";
    window.open(`https://wa.me/?text=${encodeURIComponent(text)} ${encodeURIComponent(APP_URL)}`, '_blank');
  });
}

// ==============================
//  DEEP LINKING
// ==============================
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const songTitle = params.get('song');
  if (songTitle) {
    const track = audioFiles.find(t => t.title === songTitle);
    if (track && track.cardElement) {
      console.log(`Deep link detected: Playing "${songTitle}"`);
      setTimeout(() => {
        const cardContent = track.cardElement.querySelector('.card-content');
        if (cardContent) cardContent.click();
      }, 1000);
    }
  }
});
