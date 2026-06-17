/**
 * 日本語 — script.js
 * In-Place Replacing Modular Japanese Vocabulary/Grammar Engine
 */

'use strict';

const GRAMMAR_JSON_PATH = './grammar.json';
const VOCABULARY_JSON_PATH = './vocabulary.json';

/* Fixed topic list with icons */
const FIXED_TOPICS = [
  { id: 'abstract',    icon: '💭' },
  { id: 'animals',     icon: '🐾' },
  { id: 'business',    icon: '💼' },
  { id: 'chores',      icon: '🧹' },
  { id: 'culture',     icon: '🎌' },
  { id: 'daily_life',  icon: '🌅' },
  { id: 'feelings',    icon: '💬' },
  { id: 'food',        icon: '🍜' },
  { id: 'general',     icon: '📚' },
  { id: 'grammar',     icon: '✏️' },
  { id: 'health',      icon: '🏥' },
  { id: 'hobbies',     icon: '🎯' },
  { id: 'nature',      icon: '🌿' },
  { id: 'places',      icon: '📍' },
  { id: 'school',      icon: '🏫' },
  { id: 'shopping',    icon: '🛒' },
  { id: 'social',      icon: '👥' },
  { id: 'technology',  icon: '💻' },
  { id: 'travel',      icon: '✈️' },
  { id: 'weather',     icon: '🌤' },
];

/* =========================================================
   1. STORAGE & CONFIGURATION MANAGER
   ========================================================= */
class ConfigManager {
  constructor() {
    this.storageKey = 'jpDrill_clean_settings';
    this.settings = {
      levels: [],
      topics: ['all'],
      englishFirst: false,
      showEnglish: false,
      showFurigana: true,
      showRomaji: false,
      showExamples: true,
      vocabLimit: 3,
      grammarLimit: 3,
      darkMode: false,
      activeProfile: 'default'
    };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (e) {
      console.warn("Configuration baseline fallback triggered:", e);
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (e) {
      console.error("Failed to persist user configuration metrics:", e);
    }
  }
}

/* =========================================================
   2. PROFILE MANAGER
   ========================================================= */
class ProfileManager {
  constructor(configManager, progressManager) {
    this.configManager = configManager;
    this.progressManager = progressManager;
    this.profilesKey = 'jpDrill_profiles';
  }

  _loadAllProfiles() {
    try {
      const raw = localStorage.getItem(this.profilesKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  _saveAllProfiles(profiles) {
    try {
      localStorage.setItem(this.profilesKey, JSON.stringify(profiles));
    } catch (e) {
      console.error("Failed to save profiles:", e);
    }
  }

  listProfiles() {
    return Object.keys(this._loadAllProfiles());
  }

  saveProfile(name) {
    if (!name || !name.trim()) return false;
    const profiles = this._loadAllProfiles();
    profiles[name.trim()] = {
      settings: { ...this.configManager.settings },
      seenIds: [...this.progressManager.seenIds],
      cardClears: { ...this.progressManager.cardClears }
    };
    this._saveAllProfiles(profiles);
    this.configManager.settings.activeProfile = name.trim();
    this.configManager.save();
    return true;
  }

  loadProfile(name) {
    if (!name || !name.trim()) return false;
    const profiles = this._loadAllProfiles();
    const profile = profiles[name.trim()];
    if (!profile) return false;

    if (profile.settings) {
      this.configManager.settings = { ...this.configManager.settings, ...profile.settings };
      this.configManager.settings.activeProfile = name.trim();
      this.configManager.save();
    }
    if (Array.isArray(profile.seenIds)) {
      this.progressManager.seenIds = new Set(profile.seenIds);
      this.progressManager._saveToStorage(this.progressManager.seenKey, this.progressManager.seenIds);
    }
    if (profile.cardClears) {
      this.progressManager.cardClears = { ...profile.cardClears };
      this.progressManager._saveCardClears();
    }
    return true;
  }

  deleteProfile(name) {
    if (!name) return;
    const profiles = this._loadAllProfiles();
    delete profiles[name];
    this._saveAllProfiles(profiles);
  }

  exportProfile(name) {
    const profiles = this._loadAllProfiles();
    const profile = profiles[name];
    if (!profile) return null;
    return JSON.stringify({ profileName: name, ...profile }, null, 2);
  }

  importProfile(jsonStr) {
    const data = JSON.parse(jsonStr);
    const name = data.profileName;
    if (!name) throw new Error('No profileName field found');
    const profiles = this._loadAllProfiles();
    profiles[name] = {
      settings: data.settings || {},
      seenIds: data.seenIds || [],
      cardClears: data.cardClears || {}
    };
    this._saveAllProfiles(profiles);
    return name;
  }
}

/* =========================================================
   3. PROGRESS & MEMORY TRACKING STORAGE
   ========================================================= */
class ProgressManager {
  constructor() {
    this.seenKey = 'jpDrill_seen_cards_clean';
    this.cardClearsKey = 'jpDrill_card_clears';
    this.seenIds = new Set(this._loadFromStorage(this.seenKey));
    this.cardClears = this._loadCardClears();
  }

  _loadFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  _loadCardClears() {
    try {
      const data = localStorage.getItem(this.cardClearsKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  _saveToStorage(key, setInstance) {
    try {
      localStorage.setItem(key, JSON.stringify([...setInstance]));
    } catch (e) {
      console.error(`Error saving progress token for key: ${key}`, e);
    }
  }

  _saveCardClears() {
    try {
      localStorage.setItem(this.cardClearsKey, JSON.stringify(this.cardClears));
    } catch (e) {
      console.error('Error saving card clears:', e);
    }
  }

  markSeen(id) {
    this.seenIds.add(id);
    this._saveToStorage(this.seenKey, this.seenIds);
  }

  incrementClears(id) {
    this.cardClears[id] = (this.cardClears[id] || 0) + 1;
    this._saveCardClears();
  }

  getClears(id) {
    return this.cardClears[id] || 0;
  }

  isSeen(id) {
    return this.seenIds.has(id);
  }

  resetProgress() {
    this.seenIds.clear();
    this._saveToStorage(this.seenKey, this.seenIds);
    this.cardClears = {};
    this._saveCardClears();
  }
}

/* =========================================================
   4. DATA INGESTION & FILTER EXTRACTOR
   ========================================================= */
class DataManager {
  constructor() {
    this.grammar = [];
    this.vocabulary = [];
    this.dynamicLevels = [];
  }

  async fetchPayloads() {
    const fetchJSON = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Network fault loading asset file: ${url}`);
      return res.json();
    };

    const [gData, vData] = await Promise.all([
      fetchJSON(GRAMMAR_JSON_PATH).catch(() => ({ grammar: [] })),
      fetchJSON(VOCABULARY_JSON_PATH).catch(() => ({ vocabulary: [] }))
    ]);

    this.grammar = gData.grammar || [];
    this.vocabulary = vData.vocabulary || [];

    this._extractDynamicFilters();
  }

  _extractDynamicFilters() {
    const levelsSet = new Set();
    this.grammar.forEach(g => { if (g.level) levelsSet.add(g.level.toUpperCase()); });
    this.vocabulary.forEach(v => { if (v.level) levelsSet.add(v.level.toUpperCase()); });

    const standardOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];
    this.dynamicLevels = [...levelsSet].sort((a, b) => {
      const idxA = standardOrder.indexOf(a);
      const idxB = standardOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.localeCompare(b);
    });
  }

  getFilteredPool(type, config, progress) {
    const rawSrc = type === 'grammar' ? this.grammar : this.vocabulary;

    return rawSrc.filter(item => {
      if (config.levels.length === 0) return true;
      if (!config.levels.includes(item.level?.toUpperCase())) return false;

      if (type === 'vocab' && !config.topics.includes('all')) {
        const itemTopics = Array.isArray(item.topic)
          ? item.topic.map(t => t.toLowerCase())
          : [item.topic?.toLowerCase()];
        const matchedTopic = config.topics.some(t => itemTopics.includes(t));
        if (!matchedTopic) return false;
      }

      return true;
    }).sort((a, b) => {
      const aSeen = progress.isSeen(a.id) ? 1 : 0;
      const bSeen = progress.isSeen(b.id) ? 1 : 0;
      if (aSeen !== bSeen) return aSeen - bSeen;
      return Math.random() - 0.5;
    });
  }
}

/* =========================================================
   5. CARD COMPONENT (SUPPORTS IN-PLACE REPLACEMENT)
   ========================================================= */
class CardComponent {
  constructor(data, type, configManager, progressManager, onMarkCleared, profileManager) {
    this.data = data;
    this.type = type;
    this.configManager = configManager;
    this.progressManager = progressManager;
    this.onMarkCleared = onMarkCleared;
    this.profileManager = profileManager || null;

    this.domElement = null;
    this.isExiting = false;
  }

  render() {
    const card = document.createElement('div');
    card.className = `static-drill-card ${this.type}-card`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('title', 'Click to clear and load next card');
    card.style.cursor = 'pointer';

    this.domElement = card;
    this.syncCardContentDisplay();

    card.addEventListener('click', () => this._triggerEviction());
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._triggerEviction(); }
    });

    return card;
  }

  _triggerEviction() {
    if (this.isExiting) return;
    this.isExiting = true;

    this.progressManager.markSeen(this.data.id);
    this.progressManager.incrementClears(this.data.id);

    // Auto-save progress to active profile
    const profileName = this.configManager.settings.activeProfile;
    if (profileName && profileName !== 'default' && this.profileManager) {
      this.profileManager.saveProfile(profileName);
    }

    this.domElement.classList.add('exiting');

    let called = false;
    const finish = () => {
      if (called) return;
      called = true;
      this.onMarkCleared(this);
    };

    this.domElement.addEventListener('animationend', finish, { once: true });
    // Fallback: if animationend never fires (reduced-motion, hidden element, etc)
    setTimeout(finish, 300);
  }

  syncCardContentDisplay() {
    if (!this.domElement) return;

    const config = this.configManager.settings;
    const item = this.data;

    this.domElement.innerHTML = '';

    const strip = document.createElement('div');
    strip.className = 'card-strip';
    this.domElement.appendChild(strip);

    const body = document.createElement('div');
    body.className = 'card-body';

    // Header row: level badge only (no "Click to clear" text)
    const headerRow = document.createElement('div');
    headerRow.className = 'card-header-row';
    headerRow.innerHTML = `<span class="card-level">${item.level || 'N/A'}</span>`;
    body.appendChild(headerRow);

    const mainContentArea = document.createElement('div');
    mainContentArea.className = 'card-main-content-area';

    if (config.englishFirst) {
      const primaryEn = document.createElement('div');
      primaryEn.className = 'card-meaning primary-display';
      primaryEn.textContent = item.meaning;
      mainContentArea.appendChild(primaryEn);

      if (config.showEnglish) {
        const secondaryJp = document.createElement('div');
        secondaryJp.className = 'jp-content-wrapper faded-sub-content';
        this._appendJapaneseFields(secondaryJp, item, config);
        mainContentArea.appendChild(secondaryJp);
      }
    } else {
      const primaryJp = document.createElement('div');
      primaryJp.className = 'jp-content-wrapper primary-display';
      this._appendJapaneseFields(primaryJp, item, config);
      mainContentArea.appendChild(primaryJp);

      if (config.showEnglish) {
        const secondaryEn = document.createElement('div');
        secondaryEn.className = 'en-content-wrapper faded-sub-content';
        const meaningEl = document.createElement('div');
        meaningEl.className = 'card-meaning';
        meaningEl.textContent = item.meaning;
        secondaryEn.appendChild(meaningEl);
        mainContentArea.appendChild(secondaryEn);
      }
    }

    body.appendChild(mainContentArea);

    // Contextual Examples
    const exBox = document.createElement('div');
    exBox.className = `card-example-wrapper ${config.showExamples && item.example ? '' : 'hidden'}`;
    exBox.innerHTML = `
      <div class="card-example-jp">${item.example || ''}</div>
      <div class="card-example-en">${item.example_en || ''}</div>
    `;
    body.appendChild(exBox);

    this.domElement.appendChild(body);

    // Times cleared badge
    const timesCleared = this.progressManager.getClears(item.id);
    if (timesCleared > 0) {
      const badge = document.createElement('div');
      badge.className = 'card-times-cleared';
      badge.textContent = `×${timesCleared}`;
      badge.setAttribute('title', `Cleared ${timesCleared} time${timesCleared !== 1 ? 's' : ''}`);
      this.domElement.appendChild(badge);
    }
  }

  _appendJapaneseFields(container, item, config) {
    if (this.type === 'grammar') {
      const patternEl = document.createElement('div');
      patternEl.className = 'card-pattern';
      patternEl.textContent = item.pattern;
      container.appendChild(patternEl);
    } else {
      const furiEl = document.createElement('div');
      furiEl.className = `card-furigana ${config.showFurigana ? '' : 'v-hidden'}`;
      furiEl.textContent = item.furigana || ' ';
      container.appendChild(furiEl);

      const wordEl = document.createElement('div');
      wordEl.className = 'card-word';
      wordEl.textContent = item.word;
      container.appendChild(wordEl);
    }

    const romajiEl = document.createElement('div');
    romajiEl.className = `card-romaji ${config.showRomaji ? '' : 'hidden'}`;
    romajiEl.textContent = item.romaji || '';
    container.appendChild(romajiEl);

    if (item.part_of_speech && this.type === 'vocab') {
      const posEl = document.createElement('span');
      posEl.className = 'card-pos-tag';
      posEl.textContent = item.part_of_speech;
      container.appendChild(posEl);
    }
  }
}

/* =========================================================
   6. CENTRAL APPLICATION COORDINATOR (APP CORE)
   ========================================================= */
class App {
  constructor() {
    this.configManager = new ConfigManager();
    this.progressManager = new ProgressManager();
    this.dataManager = new DataManager();
    this.profileManager = new ProfileManager(this.configManager, this.progressManager);

    this.activeCards = { grammar: [], vocab: [] };
    this.sessionClearedCount = { grammar: 0, vocab: 0 };

    this.cacheDOM();
  }

  cacheDOM() {
    this.$levelContainer = document.getElementById('level-chips-container');
    this.$topicContainer = document.getElementById('topic-chips-container');

    this.$toggleEnglishFirst = document.getElementById('toggle-english-first');
    this.$toggleEnglish = document.getElementById('toggle-english');
    this.$toggleFurigana = document.getElementById('toggle-furigana');
    this.$toggleRomaji = document.getElementById('toggle-romaji');
    this.$toggleExamples = document.getElementById('toggle-examples');

    this.$inputVocabCount = document.getElementById('input-vocab-count');
    this.$inputGrammarCount = document.getElementById('input-grammar-count');

    this.$statGrammar = document.getElementById('stat-grammar-used');
    this.$statVocab = document.getElementById('stat-vocab-used');
    this.$statTotal = document.getElementById('stat-total');

    this.$grammarPoolInd = document.getElementById('grammar-pool-indicator');
    this.$vocabPoolInd = document.getElementById('vocab-pool-indicator');

    this.$btnShuffle = document.getElementById('btn-shuffle');
    this.$btnReset = document.getElementById('btn-reset');
    this.$btnResetProgress = document.getElementById('btn-reset-progress');
    this.$btnDarkMode = document.getElementById('btn-dark-mode');

    this.$grammarGrid = document.getElementById('grammar-grid');
    this.$vocabGrid = document.getElementById('vocab-grid');
    this.$emptyState = document.getElementById('empty-state');
    this.$mainContainers = document.getElementById('main-game-containers');

    // Setup panel collapse
    this.$setupToggleBtn = document.getElementById('setup-toggle-btn');
    this.$setupPanel = document.getElementById('setup-panel');

    // Profile elements
    this.$profileNameInput = document.getElementById('profile-name-input');
    this.$profileSelect = document.getElementById('profile-select');
    this.$btnLoadProfile = document.getElementById('btn-load-profile');
    this.$btnSaveProfile = document.getElementById('btn-save-profile');
    this.$btnDeleteProfile = document.getElementById('btn-delete-profile');
    this.$btnExportProfile = document.getElementById('btn-export-profile');
    this.$btnImportFile = document.getElementById('btn-import-file');
  }

  async run() {
    await this.dataManager.fetchPayloads();

    if (!Array.isArray(this.configManager.settings.levels) ||
        this.configManager.settings.levels.length === 0) {
      this.configManager.settings.levels = [...this.dataManager.dynamicLevels];
      this.configManager.save();
    }

    this.initializeFilterDefaults();
    this.syncUIControlsWithState();
    this.renderLevelFilterUI();
    this.renderTopicFilterUI();
    this.attachDOMEventListeners();
    this.attachSetupPanelToggle();
    this.attachProfileEventListeners();
    this.refreshProfileDropdown();

    // Restore active profile name in input
    const activeProfile = this.configManager.settings.activeProfile;
    if (activeProfile && activeProfile !== 'default') {
      this.$profileNameInput.value = activeProfile;
    }

    this.rebuildBoard();
  }

  initializeFilterDefaults() {
    const config = this.configManager.settings;
    if (config.levels.length === 0) {
      config.levels = [...this.dataManager.dynamicLevels];
    }
    this.configManager.save();
  }

  syncUIControlsWithState() {
    const config = this.configManager.settings;

    this.$toggleEnglishFirst.checked = config.englishFirst;
    this.$toggleEnglish.checked = config.showEnglish;
    this.$toggleFurigana.checked = config.showFurigana;
    this.$toggleRomaji.checked = config.showRomaji;
    this.$toggleExamples.checked = config.showExamples;

    this.$inputVocabCount.value = config.vocabLimit;
    this.$inputGrammarCount.value = config.grammarLimit;

    document.body.className = config.darkMode ? 'dark' : 'light';
  }

  renderLevelFilterUI() {
    const config = this.configManager.settings;
    this.$levelContainer.innerHTML = '';

    this.dataManager.dynamicLevels.forEach(lvl => {
      const btn = document.createElement('button');
      const isActive = config.levels.includes(lvl);
      btn.className = `level-chip ${isActive ? 'active' : ''}`;
      btn.textContent = lvl;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const active = btn.classList.contains('active');
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');

        if (active) {
          config.levels.push(lvl);
        } else {
          config.levels = config.levels.filter(item => item !== lvl);
        }
        this.configManager.save();
        this.rebuildBoard();
      });
      this.$levelContainer.appendChild(btn);
    });
  }

  renderTopicFilterUI() {
    const config = this.configManager.settings;
    this.$topicContainer.innerHTML = '';

    // "All Topics" button
    const baseBtn = document.createElement('button');
    const isAllActive = config.topics.includes('all');
    baseBtn.className = `topic-chip ${isAllActive ? 'active' : ''}`;
    baseBtn.innerHTML = `<span class="topic-chip-icon">🌐</span> All Topics`;
    baseBtn.setAttribute('aria-pressed', isAllActive ? 'true' : 'false');
    baseBtn.addEventListener('click', () => {
      document.querySelectorAll('.topic-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      baseBtn.classList.add('active');
      baseBtn.setAttribute('aria-pressed', 'true');
      config.topics = ['all'];
      this.configManager.save();
      this.rebuildBoard();
    });
    this.$topicContainer.appendChild(baseBtn);

    FIXED_TOPICS.forEach(({ id: topic, icon }) => {
      const btn = document.createElement('button');
      const isTopicActive = config.topics.includes(topic);
      btn.className = `topic-chip ${isTopicActive ? 'active' : ''}`;
      btn.innerHTML = `<span class="topic-chip-icon">${icon}</span> ${topic.replace('_', ' ')}`;
      btn.setAttribute('aria-pressed', isTopicActive ? 'true' : 'false');

      btn.addEventListener('click', () => {
        baseBtn.classList.remove('active');
        baseBtn.setAttribute('aria-pressed', 'false');
        if (config.topics.includes('all')) config.topics = [];

        btn.classList.toggle('active');
        const active = btn.classList.contains('active');
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');

        if (active) {
          if (!config.topics.includes(topic)) config.topics.push(topic);
        } else {
          config.topics = config.topics.filter(t => t !== topic);
        }

        if (config.topics.length === 0) {
          baseBtn.classList.add('active');
          baseBtn.setAttribute('aria-pressed', 'true');
          config.topics = ['all'];
        }
        this.configManager.save();
        this.rebuildBoard();
      });
      this.$topicContainer.appendChild(btn);
    });
  }

  attachSetupPanelToggle() {
    this.$setupToggleBtn.addEventListener('click', () => {
      const isExpanded = this.$setupToggleBtn.getAttribute('aria-expanded') === 'true';
      this.$setupToggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      this.$setupPanel.classList.toggle('collapsed', isExpanded);
    });
  }

  refreshProfileDropdown() {
    const profiles = this.profileManager.listProfiles();
    const active = this.configManager.settings.activeProfile;
    this.$profileSelect.innerHTML = '<option value="">— saved profiles —</option>';
    profiles.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === active) opt.selected = true;
      this.$profileSelect.appendChild(opt);
    });
  }

  attachProfileEventListeners() {
    this.$btnSaveProfile.addEventListener('click', () => {
      const name = this.$profileNameInput.value.trim();
      if (!name) {
        this.showToastNotification('Enter a profile name first.');
        return;
      }
      if (this.profileManager.saveProfile(name)) {
        this.refreshProfileDropdown();
        this.showToastNotification(`Profile "${name}" saved.`);
      }
    });

    this.$btnLoadProfile.addEventListener('click', () => {
      const name = this.$profileNameInput.value.trim() || this.$profileSelect.value;
      if (!name) {
        this.showToastNotification('Select or type a profile name to load.');
        return;
      }
      if (this.profileManager.loadProfile(name)) {
        this.$profileNameInput.value = name;
        this.syncUIControlsWithState();
        this.renderLevelFilterUI();
        this.renderTopicFilterUI();
        this.rebuildBoard();
        this.refreshProfileDropdown();
        this.showToastNotification(`Profile "${name}" loaded.`);
      } else {
        this.showToastNotification(`Profile "${name}" not found.`);
      }
    });

    this.$profileSelect.addEventListener('change', () => {
      const name = this.$profileSelect.value;
      if (!name) return;
      this.$profileNameInput.value = name;
      if (this.profileManager.loadProfile(name)) {
        this.syncUIControlsWithState();
        this.renderLevelFilterUI();
        this.renderTopicFilterUI();
        this.rebuildBoard();
        this.showToastNotification(`Profile "${name}" loaded.`);
      }
    });

    this.$btnDeleteProfile.addEventListener('click', () => {
      const name = this.$profileSelect.value;
      if (!name) {
        this.showToastNotification('Select a profile to delete.');
        return;
      }
      if (confirm(`Delete profile "${name}"?`)) {
        this.profileManager.deleteProfile(name);
        this.refreshProfileDropdown();
        this.showToastNotification(`Profile "${name}" deleted.`);
      }
    });

    this.$btnExportProfile.addEventListener('click', () => {
      const name = this.$profileNameInput.value.trim() || this.$profileSelect.value;
      if (!name) {
        this.showToastNotification('Select or type a profile name to export.');
        return;
      }
      // Auto-save current settings as the profile before export
      this.profileManager.saveProfile(name);
      const jsonStr = this.profileManager.exportProfile(name);
      if (!jsonStr) {
        this.showToastNotification('Profile not found.');
        return;
      }
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jpDrill_profile_${name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToastNotification(`Profile "${name}" exported.`);
    });

    this.$btnImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const name = this.profileManager.importProfile(evt.target.result);
          this.refreshProfileDropdown();
          this.$profileNameInput.value = name;
          this.showToastNotification(`Profile "${name}" imported.`);
        } catch (err) {
          this.showToastNotification('Import failed: invalid file format.');
          console.error(err);
        }
      };
      reader.readAsText(file);
      // Reset file input so same file can be re-imported
      e.target.value = '';
    });
  }

  attachDOMEventListeners() {
    const config = this.configManager.settings;

    const attachPassiveToggle = ($domElement, configField) => {
      $domElement.addEventListener('change', (e) => {
        config[configField] = e.target.checked;
        this.configManager.save();
        this.applyPassiveUIUpdatesToExistingCards();
      });
    };

    attachPassiveToggle(this.$toggleEnglishFirst, 'englishFirst');
    attachPassiveToggle(this.$toggleEnglish, 'showEnglish');
    attachPassiveToggle(this.$toggleFurigana, 'showFurigana');
    attachPassiveToggle(this.$toggleRomaji, 'showRomaji');
    attachPassiveToggle(this.$toggleExamples, 'showExamples');

    this.$inputVocabCount.addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10) || 3;
      config.vocabLimit = val < 1 ? 1 : val;
      this.configManager.save();
      this.rebuildBoard();
    });

    this.$inputGrammarCount.addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10) || 3;
      config.grammarLimit = val < 1 ? 1 : val;
      this.configManager.save();
      this.rebuildBoard();
    });

    this.$btnShuffle.addEventListener('click', () => {
      this.rebuildBoard();
      this.showToastNotification('Board shuffled and re-ordered.');
    });

    this.$btnReset.addEventListener('click', () => {
      this.sessionClearedCount = { grammar: 0, vocab: 0 };
      this.refreshDashboardScoreboard();
      this.showToastNotification('Session metrics reset.');
    });

    this.$btnResetProgress.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your persistent historical memory progress?')) {
        this.progressManager.resetProgress();
        this.sessionClearedCount = { grammar: 0, vocab: 0 };
        this.rebuildBoard();
        this.showToastNotification('Persistent progress storage cleared.');
      }
    });

    this.$btnDarkMode.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      document.body.classList.toggle('light');
      config.darkMode = document.body.classList.contains('dark');
      this.configManager.save();
    });
  }

  applyPassiveUIUpdatesToExistingCards() {
    this.activeCards.grammar.forEach(c => c.syncCardContentDisplay());
    this.activeCards.vocab.forEach(c => c.syncCardContentDisplay());
  }

  rebuildBoard() {
    const config = this.configManager.settings;

    const gSortedPool = this.dataManager.getFilteredPool('grammar', config, this.progressManager);
    const vSortedPool = this.dataManager.getFilteredPool('vocab', config, this.progressManager);

    const gUnseenTotal = gSortedPool.filter(i => !this.progressManager.isSeen(i.id)).length;
    const vUnseenTotal = vSortedPool.filter(i => !this.progressManager.isSeen(i.id)).length;

    this.$grammarPoolInd.textContent = `${gUnseenTotal} unseen / ${gSortedPool.length} available`;
    this.$vocabPoolInd.textContent = `${vUnseenTotal} unseen / ${vSortedPool.length} available`;

    this._populateGridType('grammar', gSortedPool, config.grammarLimit);
    this._populateGridType('vocab', vSortedPool, config.vocabLimit);

    const hasActiveCards = this.activeCards.grammar.length > 0 || this.activeCards.vocab.length > 0;

    if (hasActiveCards) {
      this.$emptyState.classList.add('hidden');
      this.$mainContainers.classList.remove('hidden');
    } else {
      this.$emptyState.classList.remove('hidden');
      this.$mainContainers.classList.add('hidden');
    }

    this.refreshDashboardScoreboard();
  }

  _populateGridType(type, filteredSrcArray, maxLimitAllowed) {
    const $gridContainer = type === 'grammar' ? this.$grammarGrid : this.$vocabGrid;
    $gridContainer.innerHTML = '';
    this.activeCards[type] = [];

    const totalToRender = Math.min(filteredSrcArray.length, maxLimitAllowed);

    for (let i = 0; i < totalToRender; i++) {
      const itemData = filteredSrcArray[i];

      const comp = new CardComponent(
        itemData,
        type,
        this.configManager,
        this.progressManager,
        (evictedComp) => this.handleCardEviction(type, evictedComp, filteredSrcArray, maxLimitAllowed),
        this.profileManager
      );

      this.activeCards[type].push(comp);
      $gridContainer.appendChild(comp.render());
    }
  }

  handleCardEviction(type, evictedInstance, referencePoolArray, maxLimitAllowed) {
    if (type === 'grammar') this.sessionClearedCount.grammar++;
    else this.sessionClearedCount.vocab++;

    this.refreshDashboardScoreboard();

    const slotIndex = this.activeCards[type].indexOf(evictedInstance);
    if (slotIndex === -1) return;

    const mappedActiveIds = this.activeCards[type].map(c => c.data.id);
    const incomingItem = referencePoolArray.find(item => !mappedActiveIds.includes(item.id) && !this.progressManager.isSeen(item.id));

    if (incomingItem) {
      const nextComp = new CardComponent(
        incomingItem,
        type,
        this.configManager,
        this.progressManager,
        (evictedComp) => this.handleCardEviction(type, evictedComp, referencePoolArray, maxLimitAllowed),
        this.profileManager
      );

      this.activeCards[type][slotIndex] = nextComp;

      const nextRenderedNode = nextComp.render();
      nextRenderedNode.classList.add('entering');

      if (evictedInstance.domElement && evictedInstance.domElement.parentNode) {
        evictedInstance.domElement.parentNode.replaceChild(nextRenderedNode, evictedInstance.domElement);
      }

      nextRenderedNode.addEventListener('animationend', () => nextRenderedNode.classList.remove('entering'), { once: true });
    } else {
      if (evictedInstance.domElement && evictedInstance.domElement.parentNode) {
        evictedInstance.domElement.remove();
      }
      this.activeCards[type].splice(slotIndex, 1);
    }

    const gSortedPool = this.dataManager.getFilteredPool('grammar', this.configManager.settings, this.progressManager);
    const vSortedPool = this.dataManager.getFilteredPool('vocab', this.configManager.settings, this.progressManager);
    this.$grammarPoolInd.textContent = `${gSortedPool.filter(i => !this.progressManager.isSeen(i.id)).length} unseen / ${gSortedPool.length} available`;
    this.$vocabPoolInd.textContent = `${vSortedPool.filter(i => !this.progressManager.isSeen(i.id)).length} unseen / ${vSortedPool.length} available`;

    if (this.activeCards.grammar.length === 0 && this.activeCards.vocab.length === 0) {
      this.rebuildBoard();
    }
  }

  refreshDashboardScoreboard() {
    const gCount = this.sessionClearedCount.grammar;
    const vCount = this.sessionClearedCount.vocab;

    this.$statGrammar.textContent = gCount;
    this.$statVocab.textContent = vCount;
    this.$statTotal.textContent = gCount + vCount;
  }

  showToastNotification(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      // Fallback removal
      setTimeout(() => toast.remove(), 500);
    }, 2200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const applicationEngineInstance = new App();
  applicationEngineInstance.run().catch(err => {
    console.error("Critical failure during startup sequence:", err);
  });
});