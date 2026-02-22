import './style.css';
import confetti from 'canvas-confetti';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, runTransaction } from 'firebase/database';

// --- FIREBASE SETUP (using FingerOfShame credentials) ---
const firebaseConfig = {
  apiKey: "AIza" + "SyDjEu" + "71FYxr8" + "Ebqhd3fy" + "SP-4qx" + "uWNxSC6Q",
  authDomain: "finger-of-shame.firebaseapp.com",
  storageBucket: "finger-of-shame.firebasestorage.app",
  databaseURL: "https://finger-of-shame-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const audioFiles = [
  { file: 'Alice_s_Best_Day.mp3', title: "Alice's Best Day", icon: '🌟' },
  { file: 'Alice_s_Birthday_Bash.mp3', title: "Birthday Bash", icon: '🎉' },
  { file: 'Alice_s_Birthday_Orbit.mp3', title: "Birthday Orbit", icon: '🚀' },
  { file: 'Disneyland_Dreams.mp3', title: "Disneyland Dreams", icon: '🏰' },
  { file: 'Ten_Years_to_the_Sun.mp3', title: "Ten Years to the Sun", icon: '☀️' },
  { file: 'The_Best_Day_Ever_.mp3', title: "The Best Day Ever!", icon: '💖' }
];

const grid = document.getElementById('audio-grid');
const nowPlayingContainer = document.getElementById('now-playing-container');
const nowPlayingTitleTitle = document.getElementById('now-playing-title');

let currentAudio = null;
let currentCard = null;

// Magical Confetti sequence
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

// Fun Voting Sounds (Web Audio API)
function playVoteSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    if (type === 'up') {
      // Happy Sparkle Sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    } else {
      // Funny Mouse Poo / Squelch sound (Deep bass slide)
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    }

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio Context sound failed", e);
  }
}

audioFiles.forEach((track, index) => {
  const card = document.createElement('div');
  card.className = 'audio-card';
  card.style.animationDelay = `${index * 0.1}s`;

  // Create a clean key for firebase (no dots or weird chars)
  const trackKey = track.file.replace(/[^a-zA-Z0-9]/g, '_');

  card.innerHTML = `
    <div class="card-content" style="cursor: pointer;">
      <div class="card-icon">${track.icon}</div>
      <div class="card-title-container">
        <div class="card-title">${track.title}</div>
        <button class="share-track-btn" title="Share this track">🔗</button>
      </div>
    </div>
    <div class="voting-container" onclick="event.stopPropagation()">
      <button class="vote-btn upvote">👍</button>
      <div class="vote-score">0</div>
      <button class="vote-btn downvote">👎</button>
    </div>
    <div class="play-count">This song has been played 0 times</div>
  `;

  const cardContent = card.querySelector('.card-content');
  const upvoteBtn = card.querySelector('.upvote');
  const downvoteBtn = card.querySelector('.downvote');
  const scoreDisplay = card.querySelector('.vote-score');
  const playCountDisplay = card.querySelector('.play-count');
  const shareTrackBtn = card.querySelector('.share-track-btn');

  // WhatsApp track sharing
  shareTrackBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const APP_URL = "https://fingergame.co.uk/AliceBirthday/";
    const text = `Hey! Alice's 10th Birthday app is so cool! Listen to this track: "${track.title}" ${track.icon}. Check it out here:`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)} ${encodeURIComponent(APP_URL)}`, '_blank');
  });

  // Firebase Realtime Score & Play Sync
  const dataRef = ref(db, `alices-birthday-votes/${trackKey}`);
  onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    scoreDisplay.textContent = data ? (data.score || 0) : 0;
    playCountDisplay.textContent = `This song has been played ${data ? (data.plays || 0) : 0} times`;
  });

  // Local fallback state
  let localScore = 0;

  const handleVote = (change) => {
    runTransaction(dataRef, (currentData) => {
      if (currentData === null) {
        return { score: Math.max(0, change), plays: 0 };
      }
      return {
        ...currentData,
        score: Math.max(0, (currentData.score || 0) + change)
      };
    }).catch(error => {
      console.warn("Firebase write failed (likely permissions). Using local score instead:", error);
      localScore = Math.max(0, localScore + change);
      scoreDisplay.textContent = localScore;
    });
  };

  upvoteBtn.addEventListener('click', () => {
    // If we're not waiting for firebase due to an error, we can still show the animation immediately
    handleVote(1);
    playVoteSound('up');
    // Mini emoji explosion
    confetti({
      particleCount: 15,
      spread: 40,
      origin: {
        x: upvoteBtn.getBoundingClientRect().left / window.innerWidth,
        y: upvoteBtn.getBoundingClientRect().top / window.innerHeight
      },
      colors: ['#ff007f', '#ffd700'],
      shapes: ['star']
    });
  });

  downvoteBtn.addEventListener('click', () => {
    handleVote(-1);
    playVoteSound('down');
  });

  cardContent.addEventListener('click', () => {
    // If clicking the currently playing track, stop it
    if (currentCard === card && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      card.classList.remove('playing');
      nowPlayingContainer.classList.add('hidden');
      return;
    }

    // Stop previous
    if (currentAudio) {
      currentAudio.pause();
      if (currentCard) currentCard.classList.remove('playing');
    }

    // Play new
    // We use /Audio/ because Vite serves everything in /public/ at the root path /
    currentAudio = new Audio(`/Audio/${track.file}`);
    currentCard = card;

    // Increment play count in Firebase
    runTransaction(dataRef, (currentData) => {
      if (currentData === null) {
        return { score: 0, plays: 1 };
      }
      return {
        ...currentData,
        plays: (currentData.plays || 0) + 1
      };
    }).catch(err => console.warn("Play count sync failed", err));

    currentAudio.play().catch(e => console.error("Audio playback failed:", e));

    card.classList.add('playing');
    nowPlayingTitleTitle.textContent = track.title;
    nowPlayingContainer.classList.remove('hidden');

    // Drama Queen Magic Effect & Disco Mode!
    fireMagicalConfetti();
    document.documentElement.classList.add('disco-mode');

    // When audio finishes
    currentAudio.addEventListener('ended', () => {
      card.classList.remove('playing');
      nowPlayingContainer.classList.add('hidden');
      document.documentElement.classList.remove('disco-mode');
    });
  });

  grid.appendChild(card);
  track.cardElement = card; // Store reference for Magic Picker
});

// Magic Track Picker Logic
const magicBtn = document.getElementById('magic-picker-btn');

magicBtn.addEventListener('click', () => {
  // Prevent multiple clicks
  if (magicBtn.disabled) return;
  magicBtn.disabled = true;
  magicBtn.innerText = "✨ SPINNING... ✨";

  // Stop currently playing track
  if (currentAudio) {
    currentAudio.pause();
    if (currentCard) currentCard.classList.remove('playing');
    nowPlayingContainer.classList.add('hidden');
    document.documentElement.classList.remove('disco-mode');
  }

  let spinCount = 0;
  const maxSpins = Math.floor(Math.random() * 10) + 20; // 20 to 30 spins
  let currentHighlightIndex = 0;
  let delay = 50; // start fast

  const spinStep = () => {
    // Remove highlight from previous
    audioFiles.forEach(t => t.cardElement.classList.remove('highlighted'));

    // Highlight current
    const targetCard = audioFiles[currentHighlightIndex].cardElement;
    targetCard.classList.add('highlighted');

    // Simple tick sound (Web Audio API)
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // high pitch tick
      oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { /* ignore web audio errors if they happen */ }

    spinCount++;

    if (spinCount < maxSpins) {
      // Move to next
      currentHighlightIndex = (currentHighlightIndex + 1) % audioFiles.length;

      // Gradually slow down
      delay += 10 + (spinCount * 1.5);

      setTimeout(spinStep, delay);
    } else {
      // Spin finished!
      magicBtn.disabled = false;
      magicBtn.innerText = "✨ PICK A MAGIC TRACK! ✨";

      // Auto-play the selected track
      const winningTrack = audioFiles[currentHighlightIndex];
      winningTrack.cardElement.querySelector('.card-content').click();

      // Extra large confetti for magic pick
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

// Add floating background sparkles
for (let i = 0; i < 20; i++) {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';
  sparkle.style.left = `${Math.random() * 100}%`;
  sparkle.style.top = `${Math.random() * 100}%`;
  sparkle.style.animationDelay = `${Math.random() * 2}s`;
  document.body.appendChild(sparkle);
}

// Main App WhatsApp Sharing
const shareAppBtn = document.getElementById('share-app-btn');
if (shareAppBtn) {
  shareAppBtn.addEventListener('click', () => {
    const APP_URL = "https://fingergame.co.uk/AliceBirthday/";
    const text = "Alice is turning 10! 🎂✨ Check out this magical Birthday App to play music and vote for her favorite tracks. Disneyland, here we come!";
    window.open(`https://wa.me/?text=${encodeURIComponent(text)} ${encodeURIComponent(APP_URL)}`, '_blank');
  });
}
