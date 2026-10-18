/**
 * FX English - Central Reactive State Store
 * Manages UI state, word bookmarks, mastery tracking, and observer subscriptions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_STUDIO_STATE = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'fx_word_states';

  const INITIAL_STATE = {
    cues: [],
    analysis: null,
    movieTitle: 'fx_vocab',
    movieUrl: '',
    activePosFilter: 'all',
    searchQuery: '',
    cefrFilter: 'all',
    sortMode: 'freq-desc',
    wordStates: {},
    hideMastered: false,

    // Master List View State
    activeView: 'studio',
    activeMasterFilter: 'all',
    masterSearchQuery: '',

    // Flashcard State
    flashcardList: [],
    currentCardIdx: 0,
    isCardFlipped: false
  };

  class StudioStore {
    constructor() {
      this.state = { ...INITIAL_STATE };
      this.listeners = new Set();
      this.loadWordStatesSync();
    }

    /**
     * Get snapshot of current state
     * @returns {Object}
     */
    getState() {
      return this.state;
    }

    /**
     * Update state and notify subscribers
     * @param {Object} partial
     */
    setState(partial) {
      if (!partial || typeof partial !== 'object') return;
      const prev = this.state;
      this.state = { ...this.state, ...partial };
      this._notify(this.state, prev);
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener (newState, prevState) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    _notify(newState, prevState) {
      this.listeners.forEach((listener) => {
        try {
          listener(newState, prevState);
        } catch (err) {
          console.error('[FX Store] Listener error:', err);
        }
      });
    }

    /**
     * Load word mastery & starred states synchronously from localStorage
     */
    loadWordStatesSync() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            this.state.wordStates = JSON.parse(raw);
          }
        }
      } catch (e) {
        console.warn('[FX Store] Failed to load word states from localStorage:', e);
      }
    }

    /**
     * Asynchronously load word states from chrome.storage.local
     */
    async loadWordStates() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([STORAGE_KEY], (res) => {
            if (res && res[STORAGE_KEY] && typeof res[STORAGE_KEY] === 'object') {
              this.setState({ wordStates: res[STORAGE_KEY] });
            }
            resolve(this.state.wordStates);
          });
        } else {
          this.loadWordStatesSync();
          resolve(this.state.wordStates);
        }
      });
    }

    /**
     * Save word states to localStorage and chrome.storage.local
     */
    async saveWordStates() {
      const states = this.state.wordStates;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
        }
      } catch (e) {}

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEY]: states }, () => resolve());
        });
      }
    }

    isStarred(key) {
      if (!key) return false;
      const clean = String(key).trim().toLowerCase();
      return Boolean(this.state.wordStates[clean]?.starred);
    }

    isMastered(key) {
      if (!key) return false;
      const clean = String(key).trim().toLowerCase();
      return Boolean(this.state.wordStates[clean]?.mastered);
    }

    toggleStar(key) {
      if (!key) return false;
      const clean = String(key).trim().toLowerCase();
      const current = this.state.wordStates[clean] || { starred: false, mastered: false };
      const nextStarred = !current.starred;

      const updated = {
        ...this.state.wordStates,
        [clean]: {
          ...current,
          starred: nextStarred,
          updatedAt: Date.now()
        }
      };

      this.setState({ wordStates: updated });
      this.saveWordStates();
      return nextStarred;
    }

    setMastered(key, isMastered) {
      if (!key) return;
      const clean = String(key).trim().toLowerCase();
      const current = this.state.wordStates[clean] || { starred: false, mastered: false };

      const updated = {
        ...this.state.wordStates,
        [clean]: {
          ...current,
          mastered: Boolean(isMastered),
          updatedAt: Date.now()
        }
      };

      this.setState({ wordStates: updated });
      this.saveWordStates();
    }
  }

  return new StudioStore();
});
