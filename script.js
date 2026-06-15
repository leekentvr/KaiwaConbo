/**
 * 日本語ドリル — script.js
 * Japanese Speaking Drill Game
 *
 * Architecture:
 *   DataStore   — loads and filters JSON data
 *   CardPool    — shuffled pool with no-repeat logic
 *   CardManager — renders and replaces cards in the DOM
 *   UI          — handles all user interactions & settings
 *   App         — bootstraps everything
 */

'use strict';

/* =========================================================
   1. CONSTANTS & CONFIG
   ========================================================= */

const GRAMMAR_JSON_PATH  = './grammar.json';
const VOCABULARY_JSON_PATH = './vocabulary.json';
const CARDS_PER_SECTION  = 3;

const CHALLENGES = [
  'Use 2 grammar cards and 3 vocabulary cards in one sentence.',
  'Make a question using one of the grammar cards.',
  'Use the past tense (〜た form) in your sentence.',
  'Use polite form (ます/です) only.',
  'Make a negative sentence.',
  'Combine two vocabulary cards in a single phrase.',
  'Use a grammar card twice in different sentences.',
  'Speak for at least 30 seconds using these cards.',
  'Make a sentence about your weekend plans.',
  'Describe someone in the room using the visible cards.',
  'Use all 3 vocabulary cards in one long sentence.',
  'Make a question and answer it yourself.',
  'Use the て-form to connect two ideas.',
  'Tell a short story (3 sentences) using any card.',
  'Use conditional form (〜ば / 〜たら) in your sentence.',
];

const STORAGE_KEY = 'jpDrill_settings';

/* =========================================================
   2. DATA STORE
   Loads grammar and vocabulary from JSON files (or custom
   imports), filters by selected JLPT levels and topics.
   ========================================================= */

class DataStore {
  constructor() {
    /** @type {Array<Object>} All grammar entries (base + imported) */
    this.allGrammar = [];
    /** @type {Array<Object>} All vocabulary entries (base + imported) */
    this.allVocab   = [];
  }

  /**
   * Fetch and parse a JSON file from the given URL.
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  /**
   * Load base grammar and vocabulary JSON files.
   */
  async loadBase() {
    const [gData, vData] = await Promise.all([
      this.fetchJSON(GRAMMAR_JSON_PATH),
      this.fetchJSON(VOCABULARY_JSON_PATH),
    ]);
    this.allGrammar = gData.grammar || [];
    this.allVocab   = vData.vocabulary || [];
  }

  /**
   * Merge a custom-imported JSON object into the data store.
   * Accepts both grammar.json and vocabulary.json shapes.
   * @param {Object} json
   * @returns {{ added: number, type: string }}
   */
  importCustom(json) {
    if (Array.isArray(json.grammar)) {
      // Assign temporary IDs if missing
      json.grammar.forEach((g, i) => {
        if (!g.id) g.id = `custom-g-${Date.now()}-${i}`;
        g._custom = true;
      });
      this.allGrammar.push(...json.grammar);
      return { added: json.grammar.length, type: 'grammar' };
    }
    if (Array.isArray(json.vocabulary)) {
      json.vocabulary.forEach((v, i) => {
        if (!v.id) v.id = `custom-v-${Date.now()}-${i}`;
        v._custom = true;
      });
      this.allVocab.push(...json.vocabulary);
      return { added: json.vocabulary.length, type: 'vocabulary' };
    }
    throw new Error('Unrecognised JSON shape. Expected { grammar: [...] } or { vocabulary: [...] }.');
  }

  /**
   * Filter grammar entries by active JLPT levels and topic.
   * @param {string[]} levels  e.g. ['N5', 'N4']
   * @param {string}   topic   e.g. 'food' or 'all'
   * @returns {Array<Object>}
   */
	filteredGrammar(levels) {
	  return this.allGrammar.filter(g => {
		return levels.includes(g.level);
	  });
	}
  /**
   * Filter vocabulary entries by active JLPT levels and topic.
   * @param {string[]} levels
   * @param {string}   topic
   * @returns {Array<Object>}
   */
  filteredVocab(levels, topic) {
    return this.allVocab.filter(v => {
      const levelOk = levels.includes(v.level);
      const topicOk = topic === 'all' || (Array.isArray(v.topic) && v.topic.includes(topic));
      return levelOk && topicOk;
    });
  }
}

/* =========================================================
   3. CARD POOL
   Manages a shuffled pool for one content type so cards
   don't repeat until all have been used once.
   ========================================================= */

class CardPool {
  /**
   * @param {Array<Object>} items — full filtered dataset
   */
  constructor(items) {
    this._all      = [...items];
    this._remaining = [];
    this._used     = 0;
    this._replenish();
  }

  get totalUsed()  { return this._used; }
  get poolSize()   { return this._all.length; }
  get remaining()  { return this._remaining.length; }

  /** Fisher-Yates shuffle in place */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Refill the remaining pile with a new shuffle */
  _replenish() {
    this._remaining = this._shuffle([...this._all]);
  }

  /**
   * Draw the next item from the pool.
   * Replenishes automatically when exhausted.
   * @returns {Object|null}
   */
  draw() {
    if (this._all.length === 0) return null;
    if (this._remaining.length === 0) this._replenish();
    this._used++;
    return this._remaining.pop();
  }

  /** Reset usage count without changing the data set */
  reset() {
    this._used = 0;
    this._replenish();
  }

  /** Replace the underlying data (e.g. after filter change) */
  updateItems(items) {
    this._all       = [...items];
    this._used      = 0;
    this._remaining = [];
    this._replenish();
  }
}

/* =========================================================
   4. CARD MANAGER
   Renders cards into DOM grids and handles the
   click-to-replace mechanic with animations.
   ========================================================= */

class CardManager {
  /**
   * @param {HTMLElement}  gridEl   — the .cards-grid DOM node
   * @param {CardPool}     pool     — the data pool to draw from
   * @param {'grammar'|'vocab'} type
   * @param {Object}       settings — { showFurigana, showRomaji }
   * @param {Function}     onUse    — callback(cardData) after a card is used
   */
  constructor(gridEl, pool, type, settings, onUse) {
    this.grid     = gridEl;
    this.pool     = pool;
    this.type     = type;
    this.settings = settings;
    this.onUse    = onUse;

    /** Currently displayed card data, keyed by slot index */
    this.slots = {};
  }

  /** Build and display all CARDS_PER_SECTION cards */
  init() {
    this.grid.innerHTML = '';
    for (let i = 0; i < CARDS_PER_SECTION; i++) {
      this._addSlot(i);
    }
  }

  /** Create a card element for a given slot */
  _addSlot(index) {
    const data = this.pool.draw();
    if (!data) return;
    this.slots[index] = data;

    const card = this._buildCard(data, index);
    card.classList.add('entering');
    this.grid.appendChild(card);

    // Remove animation class after it completes
    card.addEventListener('animationend', () => card.classList.remove('entering'), { once: true });
  }

  /**
   * Build the card DOM element.
   * @param {Object} data
   * @param {number} index
   * @returns {HTMLElement}
   */
  _buildCard(data, index) {
    const card = document.createElement('div');
    card.className = `card ${this.type}-card`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.dataset.slot  = index;
    card.dataset.id    = data.id;

    // Accessibility label
    const label = this.type === 'grammar'
      ? `Grammar: ${data.pattern}, meaning: ${data.meaning}`
      : `Vocabulary: ${data.word}, ${data.furigana}, meaning: ${data.meaning}`;
    card.setAttribute('aria-label', label);

    card.innerHTML = this._cardHTML(data);

    // Apply furigana / romaji visibility
    this._applyVisibility(card);

    // Click and keyboard handler
    const handler = () => this._useCard(card, index);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });

    return card;
  }

  /**
   * Generate inner HTML for a card based on its type.
   * @param {Object} data
   * @returns {string}
   */
  _cardHTML(data) {
    if (this.type === 'grammar') {
      return `
        <div class="card-strip"></div>
        <div class="card-body">
          <span class="card-level">${data.level}</span>
          <div class="card-pattern">${this._escHtml(data.pattern)}</div>
          <div class="card-romaji">${this._escHtml(data.romaji || '')}</div>
          <div class="card-meaning">${this._escHtml(data.meaning)}</div>
          ${data.example ? `
          <div class="card-example">
            <div class="card-example-jp">${this._escHtml(data.example)}</div>
            ${data.example_en ? `<div class="card-example-en">${this._escHtml(data.example_en)}</div>` : ''}
          </div>` : ''}
        </div>`;
    }

    // Vocabulary card
    const posClass = this._posClass(data.part_of_speech);
    return `
      <div class="card-strip"></div>
      <div class="card-body">
        <span class="card-level">${data.level}</span>
        <div class="card-furigana">${this._escHtml(data.furigana || '')}</div>
        <div class="card-word">${this._escHtml(data.word)}</div>
        <div class="card-romaji">${this._escHtml(data.romaji || '')}</div>
        <div class="card-meaning">${this._escHtml(data.meaning)}</div>
        ${data.part_of_speech ? `<span class="card-pos ${posClass}">${this._escHtml(data.part_of_speech)}</span>` : ''}
      </div>`;
  }

  /**
   * Return a CSS class name for a given part of speech.
   * @param {string} pos
   * @returns {string}
   */
  _posClass(pos) {
    if (!pos) return 'pos-other';
    const p = pos.toLowerCase();
    if (p.includes('verb'))      return 'pos-verb';
    if (p.includes('noun'))      return 'pos-noun';
    if (p.includes('adjective')) return 'pos-adjective';
    return 'pos-other';
  }

  /** Escape HTML special chars */
  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Handle a card being used:
   * 1. Animate exit
   * 2. Report usage
   * 3. Draw new card and animate entry
   * @param {HTMLElement} card
   * @param {number}      index
   */
  _useCard(card, index) {
    const usedData = this.slots[index];

    // Animate out
    card.classList.add('exiting');
    card.removeEventListener('click', card._clickHandler);

    card.addEventListener('animationend', () => {
      // Remove old card
      card.remove();

      // Draw new card
      const newData = this.pool.draw();
      if (!newData) return;

      this.slots[index] = newData;
      const newCard = this._buildCard(newData, index);
      newCard.classList.add('entering');

      // Insert in correct position
      const cards = this.grid.querySelectorAll('.card');
      if (index < cards.length) {
        this.grid.insertBefore(newCard, cards[index]);
      } else {
        this.grid.appendChild(newCard);
      }

      newCard.addEventListener('animationend', () => newCard.classList.remove('entering'), { once: true });
    }, { once: true });

    // Callback to parent (for stat tracking)
    if (this.onUse) this.onUse(usedData);
  }

  /**
   * Apply or remove furigana/romaji visibility classes from
   * all cards (called when settings change mid-session).
   */
  applyVisibilityToAll() {
    const cards = this.grid.querySelectorAll('.card');
    cards.forEach(card => this._applyVisibility(card));
  }

  /**
   * @param {HTMLElement} card
   */
	_applyVisibility(card) {
	  card.classList.toggle('furigana-hidden', !this.settings.showFurigana);
	  card.classList.toggle('romaji-hidden', !this.settings.showRomaji);
	  card.classList.toggle('examples-hidden', !this.settings.showExamples);
	}

  /** Replace all current cards with new draws (shuffle effect) */
  shuffleAll() {
    const cards = Array.from(this.grid.querySelectorAll('.card'));
    cards.forEach((card, i) => {
      // Stagger exits
      setTimeout(() => {
        card.classList.add('exiting');
        card.addEventListener('animationend', () => {
          card.remove();
          const newData = this.pool.draw();
          if (!newData) return;
          this.slots[i] = newData;
          const newCard = this._buildCard(newData, i);
          newCard.classList.add('entering');
          this.grid.appendChild(newCard);
          newCard.addEventListener('animationend', () => newCard.classList.remove('entering'), { once: true });
        }, { once: true });
      }, i * 60);
    });
  }
}

/* =========================================================
   5. UI CONTROLLER
   Binds DOM events, manages settings, coordinates updates.
   ========================================================= */

class UI {
  constructor(app) {
    this.app = app;

    // ── Setup controls ──────────────────────────────────
    this.$levelChips    = document.querySelectorAll('.level-chip');
    this.$topicChips    = document.querySelectorAll('.topic-chip');
    this.$toggleFuri    = document.getElementById('toggle-furigana');
    this.$toggleRomaji  = document.getElementById('toggle-romaji');
    this.$toggleChallenge = document.getElementById('toggle-challenge');
	this.$toggleExamples = document.getElementById('toggle-examples');

    // ── Stats ────────────────────────────────────────────
    this.$statGrammar   = document.getElementById('stat-grammar-used');
    this.$statVocab     = document.getElementById('stat-vocab-used');
    this.$statTotal     = document.getElementById('stat-total');
    this.$grammarPool   = document.getElementById('grammar-pool-indicator');
    this.$vocabPool     = document.getElementById('vocab-pool-indicator');

    // ── Action buttons ───────────────────────────────────
    this.$btnShuffle    = document.getElementById('btn-shuffle');
    this.$btnReset      = document.getElementById('btn-reset');
    this.$btnDark       = document.getElementById('btn-dark-mode');
    this.$btnImport     = document.getElementById('btn-import');
    this.$fileImport    = document.getElementById('file-import');
    this.$btnExport     = document.getElementById('btn-export');

    // ── Challenge ────────────────────────────────────────
    this.$challengeBanner = document.getElementById('challenge-banner');
    this.$challengeText   = document.getElementById('challenge-text');
    this.$btnNewChallenge = document.getElementById('btn-new-challenge');

    // ── Import modal ─────────────────────────────────────
    this.$importModal   = document.getElementById('import-modal');
    this.$btnModalClose = document.getElementById('btn-modal-close');
    this.$dropZone      = document.getElementById('drop-zone');
    this.$btnBrowse     = document.getElementById('btn-browse');
    this.$importFeedback = document.getElementById('import-feedback');

    // ── Toast ─────────────────────────────────────────────
    this.$toastContainer = document.getElementById('toast-container');
  }

  /**
   * Attach all event listeners.
   * Called once during App.init().
   */
  bindAll() {
    // Level chips — multi-select toggle
    this.$levelChips.forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        chip.setAttribute('aria-pressed', chip.classList.contains('active') ? 'true' : 'false');
        this.app.onFilterChange();
      });
    });

    // Topic chips — single-select
    this.$topicChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.$topicChips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        this.app.onFilterChange();
      });
    });

    // Furigana toggle
    this.$toggleFuri.addEventListener('change', () => {
      this.app.settings.showFurigana = this.$toggleFuri.checked;
      this.app.applyVisibility();
      this.saveSettings();
    });

    // Romaji toggle
    this.$toggleRomaji.addEventListener('change', () => {
      this.app.settings.showRomaji = this.$toggleRomaji.checked;
      this.app.applyVisibility();
      this.saveSettings();
    });

    // Challenge toggle
    this.$toggleChallenge.addEventListener('change', () => {
      this.app.settings.challengeMode = this.$toggleChallenge.checked;
      this.$challengeBanner.classList.toggle('hidden', !this.app.settings.challengeMode);
      if (this.app.settings.challengeMode) this.refreshChallenge();
      this.saveSettings();
    });

    // Shuffle
    this.$btnShuffle.addEventListener('click', () => this.app.shuffle());

    // Reset
    this.$btnReset.addEventListener('click', () => this.app.reset());

    // Dark mode
    this.$btnDark.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      this.app.settings.darkMode = document.body.classList.contains('dark');
      this.saveSettings();
    });

    // Import button
    this.$btnImport.addEventListener('click', () => this.openImportModal());

    // File input (from browse)
    this.$fileImport.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => this.processImportFile(f));
      e.target.value = ''; // reset so same file can be re-imported
    });

    // Export
    this.$btnExport.addEventListener('click', () => this.app.exportList());

    // Challenge refresh
    this.$btnNewChallenge.addEventListener('click', () => this.refreshChallenge());

    // Modal close
    this.$btnModalClose.addEventListener('click', () => this.closeImportModal());
    this.$importModal.addEventListener('click', (e) => {
      if (e.target === this.$importModal) this.closeImportModal();
    });

    // Browse inside modal
    this.$btnBrowse.addEventListener('click', () => this.$fileImport.click());

    // Drag-and-drop on drop zone
    this.$dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.$dropZone.classList.add('drag-over');
    });
    this.$dropZone.addEventListener('dragleave', () => {
      this.$dropZone.classList.remove('drag-over');
    });
    this.$dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.$dropZone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files || []);
      files.forEach(f => this.processImportFile(f));
    });

	this.$toggleExamples.addEventListener('change', () => {
	  this.app.settings.showExamples = this.$toggleExamples.checked;
	  this.app.applyVisibility();
	  this.saveSettings();
	});

    // Keyboard: close modal with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.$importModal.classList.contains('hidden')) {
        this.closeImportModal();
      }
    });
  }

  // ── Filter state readers ────────────────────────────────

  /** @returns {string[]} Active JLPT levels */
  getActiveLevels() {
    return Array.from(this.$levelChips)
      .filter(c => c.classList.contains('active'))
      .map(c => c.dataset.level);
  }

  /** @returns {string} Active topic, or 'all' */
  getActiveTopic() {
    const active = document.querySelector('.topic-chip.active');
    return active ? active.dataset.topic : 'all';
  }

  // ── Stats ────────────────────────────────────────────────

  /**
   * Update the session stats display.
   * @param {number} grammarUsed
   * @param {number} vocabUsed
   */
  updateStats(grammarUsed, vocabUsed) {
    this.$statGrammar.textContent = grammarUsed;
    this.$statVocab.textContent   = vocabUsed;
    this.$statTotal.textContent   = grammarUsed + vocabUsed;
  }

  /**
   * Update the pool size indicators.
   * @param {number} gUsed  @param {number} gTotal
   * @param {number} vUsed  @param {number} vTotal
   */
  updatePoolIndicators(gUsed, gTotal, vUsed, vTotal) {
    this.$grammarPool.textContent = `${gTotal - gUsed} of ${gTotal} remaining`;
    this.$vocabPool.textContent   = `${vTotal - vUsed} of ${vTotal} remaining`;
  }

  // ── Challenge ─────────────────────────────────────────────

  refreshChallenge() {
    const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    this.$challengeText.textContent = challenge;
  }

  // ── Toast ──────────────────────────────────────────────────

  /**
   * Show a transient toast notification.
   * @param {string} message
   * @param {number} duration  ms before auto-dismiss
   */
  showToast(message, duration = 2200) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.$toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  // ── Import Modal ───────────────────────────────────────────

  openImportModal() {
    this.$importModal.classList.remove('hidden');
    this.$importFeedback.textContent = '';
    this.$importFeedback.className   = 'import-feedback';
  }

  closeImportModal() {
    this.$importModal.classList.add('hidden');
  }

  /**
   * Read a JSON file and pass it to the DataStore for import.
   * @param {File} file
   */
  processImportFile(file) {
    if (!file.name.endsWith('.json')) {
      this.setImportFeedback('Only .json files are supported.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json   = JSON.parse(e.target.result);
        const result = this.app.dataStore.importCustom(json);
        this.setImportFeedback(`✓ Imported ${result.added} ${result.type} entries.`, false);
        this.app.onFilterChange(); // rebuild pools with new data
        this.showToast(`Imported ${result.added} custom ${result.type} cards`);
        setTimeout(() => this.closeImportModal(), 1400);
      } catch (err) {
        this.setImportFeedback(`Error: ${err.message}`, true);
      }
    };
    reader.readAsText(file);
  }

  setImportFeedback(msg, isError) {
    this.$importFeedback.textContent = msg;
    this.$importFeedback.className   = `import-feedback${isError ? ' error' : ''}`;
  }

  // ── Settings persistence ───────────────────────────────────

  /**
   * Save current settings to localStorage.
   */
  saveSettings() {
    try {
      const levels = this.getActiveLevels();
      const topic  = this.getActiveTopic();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        levels,
        topic,
        darkMode:      this.app.settings.darkMode,
        showFurigana:  this.app.settings.showFurigana,
        showRomaji:    this.app.settings.showRomaji,
        challengeMode: this.app.settings.challengeMode,
		showExamples: this.app.settings.showExamples,
      }));
    } catch (_) {
      // localStorage may not be available; silently ignore
    }
  }

  /**
   * Restore settings from localStorage and apply them to the DOM.
   * @returns {Object|null} parsed settings or null
   */
  loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  /**
   * Apply a saved settings object to the DOM controls.
   * @param {Object} s
   */
  applyStoredSettings(s) {
    if (!s) return;

    // Levels
    if (Array.isArray(s.levels)) {
      this.$levelChips.forEach(chip => {
        const active = s.levels.includes(chip.dataset.level);
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    // Topic
    if (s.topic) {
      this.$topicChips.forEach(chip => {
        const active = chip.dataset.topic === s.topic;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    // Dark mode
    if (s.darkMode) document.body.classList.add('dark');

    // Toggles
    if (typeof s.showFurigana  === 'boolean') this.$toggleFuri.checked     = s.showFurigana;
    if (typeof s.showRomaji    === 'boolean') this.$toggleRomaji.checked   = s.showRomaji;
    if (typeof s.challengeMode === 'boolean') this.$toggleChallenge.checked = s.challengeMode;
	if (typeof s.showExamples === 'boolean') this.$toggleExamples.checked = s.showExamples;
  }
}

/* =========================================================
   6. APP — top-level coordinator
   ========================================================= */

class App {
  constructor() {
    this.dataStore = new DataStore();

    /** Shared settings object passed to CardManagers */
	this.settings = {
	  showFurigana: true,
	  showRomaji: false,
	  showExamples: false,
	  darkMode: false,
	  challengeMode: false,
	};

    this.ui = new UI(this);

    /** @type {CardPool} */
    this.grammarPool = null;
    /** @type {CardPool} */
    this.vocabPool   = null;

    /** @type {CardManager} */
    this.grammarManager = null;
    /** @type {CardManager} */
    this.vocabManager   = null;

    /** Session usage counters */
    this.grammarUsed = 0;
    this.vocabUsed   = 0;
  }

  /**
   * Bootstrap: load data, restore settings, build cards.
   */
  async init() {
    // Restore persisted settings before loading data
    const stored = this.ui.loadSettings();
    if (stored) {
      this.ui.applyStoredSettings(stored);
      this.settings.darkMode      = stored.darkMode      || false;
      this.settings.showFurigana  = stored.showFurigana  !== false;
      this.settings.showRomaji    = stored.showRomaji    || false;
      this.settings.challengeMode = stored.challengeMode || false;
	  this.settings.showExamples = stored.showExamples !== false;
    }

    try {
      await this.dataStore.loadBase();
    } catch (err) {
      console.error('Failed to load data files:', err);
      this.ui.showToast('⚠ Could not load data files. Check the console.', 5000);
      return;
    }

    // Wire up all UI events
    this.ui.bindAll();

    // Build initial card pools and render
    this._buildPools();
    this._renderAll();

    // Restore challenge banner state
    if (this.settings.challengeMode) {
      document.getElementById('challenge-banner').classList.remove('hidden');
      this.ui.refreshChallenge();
    }
  }

  /**
   * Build (or rebuild) CardPools from the current filter state.
   */
  _buildPools() {
    const levels = this.ui.getActiveLevels();
    const topic  = this.ui.getActiveTopic();

    const grammar = this.dataStore.filteredGrammar(levels);
    const vocab   = this.dataStore.filteredVocab(levels, topic);

    if (this.grammarPool) {
      this.grammarPool.updateItems(grammar);
    } else {
      this.grammarPool = new CardPool(grammar);
    }

    if (this.vocabPool) {
      this.vocabPool.updateItems(vocab);
    } else {
      this.vocabPool = new CardPool(vocab);
    }
  }

  /**
   * Create CardManagers and render all cards.
   */
  _renderAll() {
    const grammarGrid = document.getElementById('grammar-grid');
    const vocabGrid   = document.getElementById('vocab-grid');
    const emptyState  = document.getElementById('empty-state');

    const hasData = this.grammarPool.poolSize > 0 || this.vocabPool.poolSize > 0;
    emptyState.classList.toggle('hidden', hasData);
    document.getElementById('section-grammar').classList.toggle('hidden', !hasData);
    document.getElementById('section-vocab').classList.toggle('hidden',   !hasData);

    if (!hasData) return;

    // Grammar manager
    this.grammarManager = new CardManager(
      grammarGrid,
      this.grammarPool,
      'grammar',
      this.settings,
      (data) => this._onCardUsed('grammar', data)
    );
    this.grammarManager.init();

    // Vocab manager
    this.vocabManager = new CardManager(
      vocabGrid,
      this.vocabPool,
      'vocab',
      this.settings,
      (data) => this._onCardUsed('vocab', data)
    );
    this.vocabManager.init();

    this._updateStats();
  }

  /**
   * Callback fired every time a card is clicked/used.
   * @param {'grammar'|'vocab'} type
   * @param {Object}            data
   */
  _onCardUsed(type, data) {
    if (type === 'grammar') this.grammarUsed++;
    else                    this.vocabUsed++;
    this._updateStats();
  }

  /** Sync stats display */
  _updateStats() {
    this.ui.updateStats(this.grammarUsed, this.vocabUsed);
    this.ui.updatePoolIndicators(
      this.grammarPool.remaining, this.grammarPool.poolSize,
      this.vocabPool.remaining,   this.vocabPool.poolSize,
    );
  }

  // ── Public methods called by UI ──────────────────────────

  /**
   * Called when JLPT level or topic filter changes.
   * Rebuilds pools and re-renders grids.
   */
  onFilterChange() {
    this.grammarUsed = 0;
    this.vocabUsed   = 0;
    this._buildPools();
    this._renderAll();
    this.ui.saveSettings();
  }

  /**
   * Shuffle all currently visible cards.
   */
  shuffle() {
    if (this.grammarManager) this.grammarManager.shuffleAll();
    if (this.vocabManager)   this.vocabManager.shuffleAll();
    this.ui.showToast('Cards shuffled');
  }

  /**
   * Reset the session — zero stats, refill pools, re-render.
   */
  reset() {
    this.grammarUsed = 0;
    this.vocabUsed   = 0;
    if (this.grammarPool) this.grammarPool.reset();
    if (this.vocabPool)   this.vocabPool.reset();
    this._renderAll();
    if (this.settings.challengeMode) this.ui.refreshChallenge();
    this.ui.showToast('Session reset');
  }

  /**
   * Apply furigana/romaji visibility to all live cards.
   */
  applyVisibility() {
    if (this.grammarManager) this.grammarManager.applyVisibilityToAll();
    if (this.vocabManager)   this.vocabManager.applyVisibilityToAll();
  }

  /**
   * Export the currently active word lists as a downloadable JSON.
   */
  exportList() {
    const levels = this.ui.getActiveLevels();
    const topic  = this.ui.getActiveTopic();

    const payload = {
      exported_at: new Date().toISOString(),
      filters: { levels, topic },
      grammar: this.dataStore.filteredGrammar(levels),
      vocabulary: this.dataStore.filteredVocab(levels, topic),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `jp-drill-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.showToast('Word list exported');
  }
}

/* =========================================================
   7. BOOTSTRAP
   ========================================================= */

const app = new App();

document.addEventListener('DOMContentLoaded', () => {
  app.init().catch(err => {
    console.error('App init failed:', err);
  });
});
