// ---------------------------------------------------------------
// Mastermind — Codemaker (computer) vs Codebreaker (player)
// ---------------------------------------------------------------

const COLORS = [
  { id: 'red',    hex: '#d32f2f' }, // E8637A' },
  { id: 'amber',  hex: '#f57c00' }, // F2B84B' },
  { id: 'lime',   hex: '#afb42b' }, // B7E86E' },
  { id: 'cyan',   hex: '#1976d2' }, // 4FD8E0' },
  { id: 'violet', hex: '#512da8' }, // B08CF0' },
  { id: 'phosph', hex: '#388e3c' }, // 6EE7A8' },
];

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 10;

/** Generates and holds the secret code. Never exposes it until the game ends. */
class Codemaker {
  constructor(colors = COLORS, length = CODE_LENGTH) {
    this.colors = colors;
    this.length = length;
    this.secret = this.#generateSecret();
  }

  #generateSecret() {
    const secret = [];
    for (let i = 0; i < this.length; i++) {
      const pick = this.colors[Math.floor(Math.random() * this.colors.length)];
      secret.push(pick.id);
    }
    return secret;
  }

  /**
   * Classic Mastermind scoring:
   * blacks = exact color+position matches
   * whites = right color, wrong position (after removing exact matches)
   */
  evaluate(guess) {
    const secretCopy = [...this.secret];
    const guessCopy = [...guess];
    let black = 0;

    for (let i = 0; i < this.length; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        black++;
        secretCopy[i] = null;
        guessCopy[i] = undefined;
      }
    }

    let white = 0;
    for (let i = 0; i < this.length; i++) {
      if (guessCopy[i] === undefined) continue;
      const idx = secretCopy.indexOf(guessCopy[i]);
      if (idx !== -1) {
        white++;
        secretCopy[idx] = null;
      }
    }

    return { black, white, isWin: black === this.length };
  }

  revealSecret() {
    return [...this.secret];
  }
}

/** Tracks the player's guesses, current attempt, and game state. */
class Codebreaker {
  constructor(maxAttempts = MAX_ATTEMPTS, length = CODE_LENGTH) {
    this.maxAttempts = maxAttempts;
    this.length = length;
    this.history = [];       // { guess: [...], black, white }
    this.currentGuess = new Array(length).fill(null);
  }

  setPeg(slotIndex, colorId) {
    this.currentGuess[slotIndex] = colorId;
  }

  clearCurrent() {
    this.currentGuess = new Array(this.length).fill(null);
  }

  isCurrentComplete() {
    return this.currentGuess.every(c => c !== null);
  }

  commitGuess(result) {
    this.history.push({ guess: [...this.currentGuess], ...result });
    this.clearCurrent();
  }

  attemptsUsed() { return this.history.length; }
  attemptsRemaining() { return this.maxAttempts - this.attemptsUsed(); }
  isOutOfAttempts() { return this.attemptsUsed() >= this.maxAttempts; }
}

/** Orchestrates a full game: wires Codemaker + Codebreaker to the DOM. */
class MastermindGame {
  constructor() {
    this.boardEl = document.getElementById('board');
    this.paletteEl = document.getElementById('palette');
    this.submitBtn = document.getElementById('submitBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.newGameBtn = document.getElementById('newGameBtn');
    this.bannerEl = document.getElementById('banner');
    this.bannerTitle = document.getElementById('bannerTitle');
    this.bannerReveal = document.getElementById('bannerReveal');
    this.bannerSub = document.getElementById('bannerSub');
    this.currentAttemptEl = document.getElementById('currentAttempt');
    this.attemptsLeftEl = document.getElementById('attemptsLeft');
    this.maxAttemptsEl = document.getElementById('maxAttempts');
    this.clockLine = document.getElementById('clockLine');

    this.selectedColor = COLORS[0].id;
    this.gameOver = false;

    this.maxAttemptsEl.textContent = MAX_ATTEMPTS;

    this.submitBtn.addEventListener('click', () => this.submitGuess());
    this.clearBtn.addEventListener('click', () => this.clearRow());
    this.newGameBtn.addEventListener('click', () => this.startNewGame());

    this.startNewGame();
  }

  colorHex(id) {
    return COLORS.find(c => c.id === id)?.hex ?? '#333';
  }

  startNewGame() {
    this.codemaker = new Codemaker();
    this.codebreaker = new Codebreaker();
    this.gameOver = false;
    this.bannerEl.classList.remove('show', 'win', 'lose');
    this.clockLine.textContent = 'STATUS: ACTIVE';
    this.renderPalette();
    this.renderBoard();
    this.updateStatus();
  }

  renderPalette() {
    this.paletteEl.innerHTML = '';
    COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (c.id === this.selectedColor ? ' selected' : '');
      sw.style.background = c.hex;
      sw.title = c.id;
      sw.addEventListener('click', () => {
        this.selectedColor = c.id;
        this.renderPalette();
      });
      this.paletteEl.appendChild(sw);
    });
  }

  renderBoard() {
    this.boardEl.innerHTML = '';

    // Past guesses, most recent on top for readability
    for (let i = this.codebreaker.history.length - 1; i >= 0; i--) {
      this.boardEl.appendChild(this.buildRow(i + 1, this.codebreaker.history[i], true));
    }

    // Current active row (if game not over)
    if (!this.gameOver) {
      const rowNum = this.codebreaker.attemptsUsed() + 1;
      this.boardEl.appendChild(this.buildRow(rowNum, null, false));
    }
  }

  buildRow(rowNum, historyEntry, isLocked) {
    const row = document.createElement('div');
    row.className = 'row' + (historyEntry ? '' : ' empty');

    const num = document.createElement('div');
    num.className = 'row-num' + (isLocked ? '' : ' active');
    num.textContent = rowNum;
    row.appendChild(num);

    const slots = document.createElement('div');
    slots.className = 'slots';

    const guessArr = historyEntry ? historyEntry.guess : this.codebreaker.currentGuess;

    for (let i = 0; i < CODE_LENGTH; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (isLocked ? ' locked' : '') + (guessArr[i] ? ' filled' : '');
      if (guessArr[i]) {
        const peg = document.createElement('div');
        peg.className = 'peg';
        peg.style.background = this.colorHex(guessArr[i]);
        peg.style.boxShadow = `0 0 10px ${this.colorHex(guessArr[i])}66`;
        slot.appendChild(peg);
      }
      if (!isLocked) {
        slot.addEventListener('click', () => {
          this.codebreaker.setPeg(i, this.selectedColor);
          this.renderBoard();
          this.updateStatus();
        });
      }
      slots.appendChild(slot);
    }
    row.appendChild(slots);

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    if (historyEntry) {
      const pins = [
        ...Array(historyEntry.black).fill('black'),
        ...Array(historyEntry.white).fill('white'),
      ];
      while (pins.length < CODE_LENGTH) pins.push('empty');
      pins.forEach(kind => {
        const pin = document.createElement('div');
        pin.className = 'pin' + (kind !== 'empty' ? ' ' + kind : '');
        feedback.appendChild(pin);
      });
    } else {
      for (let i = 0; i < CODE_LENGTH; i++) {
        const pin = document.createElement('div');
        pin.className = 'pin';
        feedback.appendChild(pin);
      }
    }
    row.appendChild(feedback);

    return row;
  }

  updateStatus() {
    const used = this.codebreaker.attemptsUsed();
    const remaining = this.codebreaker.attemptsRemaining();
    this.currentAttemptEl.textContent = Math.min(used + 1, MAX_ATTEMPTS);
    this.attemptsLeftEl.textContent = `${remaining} REMAINING`;
    this.attemptsLeftEl.classList.toggle('low', remaining <= 3 && remaining > 0);
    this.submitBtn.disabled = this.gameOver || !this.codebreaker.isCurrentComplete();
  }

  clearRow() {
    if (this.gameOver) return;
    this.codebreaker.clearCurrent();
    this.renderBoard();
    this.updateStatus();
  }

  submitGuess() {
    if (this.gameOver || !this.codebreaker.isCurrentComplete()) return;

    const result = this.codemaker.evaluate(this.codebreaker.currentGuess);
    this.codebreaker.commitGuess(result);

    if (result.isWin) {
      this.endGame(true);
    } else if (this.codebreaker.isOutOfAttempts()) {
      this.endGame(false);
    } else {
      this.renderBoard();
      this.updateStatus();
    }
  }

  endGame(won) {
    this.gameOver = true;
    this.renderBoard();
    this.updateStatus();

    const secret = this.codemaker.revealSecret();
    this.bannerReveal.innerHTML = '';
    secret.forEach(id => {
      const peg = document.createElement('div');
      peg.className = 'peg';
      peg.style.background = this.colorHex(id);
      peg.style.boxShadow = `0 0 10px ${this.colorHex(id)}88`;
      this.bannerReveal.appendChild(peg);
    });

    this.bannerEl.classList.add('show', won ? 'win' : 'lose');
    this.bannerTitle.textContent = won ? 'CASE CLOSED — CODE BROKEN' : 'CASE COLD — OUT OF ATTEMPTS';
    this.bannerSub.textContent = won
      ? `Cracked it in ${this.codebreaker.attemptsUsed()} attempt${this.codebreaker.attemptsUsed() === 1 ? '' : 's'}.`
      : 'The Codemaker\'s sequence is revealed above.';
    this.clockLine.textContent = won ? 'STATUS: SOLVED' : 'STATUS: FAILED';
  }
}

document.addEventListener('DOMContentLoaded', () => new MastermindGame());