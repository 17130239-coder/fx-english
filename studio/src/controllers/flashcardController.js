/**
 * FX English - 3D Flashcard & Spaced Repetition (SRS) Controller
 * Manages 3D flip card interactions, SuperMemo SM-2 interval scheduling, and keyboard shortcuts.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_FLASHCARD_CONTROLLER = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class FlashcardController {
    constructor() {
      this.list = [];
      this.currentIdx = 0;
      this.isFlipped = false;
      this.store = null;
      this.audioService = null;
      this.elements = {};
      this.onToggleMasterCallback = null;
    }

    /**
     * Bind DOM elements and services
     * @param {Object} options
     */
    init(options = {}) {
      this.store = options.store || (typeof APP_STUDIO_STATE !== 'undefined' ? APP_STUDIO_STATE : null);
      this.audioService = options.audioService || (typeof APP_AUDIO_SERVICE !== 'undefined' ? APP_AUDIO_SERVICE : null);
      this.onToggleMasterCallback = options.onToggleMaster || null;
      this.showToast = options.showToast || null;

      this.elements = {
        modal: document.getElementById('fx-flashcard-modal'),
        backdrop: document.getElementById('fx-fc-backdrop'),
        closeBtn: document.getElementById('fx-fc-close'),
        card: document.getElementById('fx-fc-card'),
        counter: document.getElementById('fx-fc-counter'),
        pos: document.getElementById('fx-fc-pos'),
        cefr: document.getElementById('fx-fc-cefr'),
        freq: document.getElementById('fx-fc-freq'),
        word: document.getElementById('fx-fc-word'),
        ipa: document.getElementById('fx-fc-ipa'),
        speakBtn: document.getElementById('fx-fc-speak'),
        context: document.getElementById('fx-fc-context'),
        trans: document.getElementById('fx-fc-trans'),
        lemma: document.getElementById('fx-fc-lemma'),
        backSentence: document.getElementById('fx-fc-back-sentence'),
        prevBtn: document.getElementById('fx-fc-prev'),
        nextBtn: document.getElementById('fx-fc-next'),
        flipBtn: document.getElementById('fx-fc-flip'),
        starBtn: document.getElementById('fx-fc-star'),
        masterBtn: document.getElementById('fx-fc-master'),
        srsBar: document.getElementById('fx-fc-srs-bar')
      };

      this._bindEvents();
    }

    _bindEvents() {
      const el = this.elements;
      if (!el.modal) return;

      if (el.closeBtn) el.closeBtn.addEventListener('click', () => this.close());
      if (el.backdrop) el.backdrop.addEventListener('click', () => this.close());
      if (el.flipBtn) el.flipBtn.addEventListener('click', () => this.flip());
      if (el.prevBtn) el.prevBtn.addEventListener('click', () => this.prev());
      if (el.nextBtn) el.nextBtn.addEventListener('click', () => this.next());

      if (el.card) {
        el.card.addEventListener('click', (e) => {
          if (e.target.closest('#fx-fc-speak') || e.target.closest('button')) return;
          this.flip();
        });
      }

      if (el.speakBtn) {
        el.speakBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = this.list[this.currentIdx];
          const text = item?.word || item?.sentence;
          if (text && this.audioService) {
            this.audioService.speak(text);
          }
        });
      }

      if (el.starBtn) {
        el.starBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = this.list[this.currentIdx];
          const key = item?.word || item?.sentence;
          if (key && this.store) {
            this.store.toggleStar(key);
            this.render();
          }
        });
      }

      if (el.masterBtn) {
        el.masterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = this.list[this.currentIdx];
          const key = item?.word || item?.sentence;
          if (key && typeof this.onToggleMasterCallback === 'function') {
            this.onToggleMasterCallback(key, item);
            this.render();
          }
        });
      }

      if (el.srsBar) {
        el.srsBar.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-srs]');
          if (btn) {
            e.stopPropagation();
            const rating = parseInt(btn.dataset.srs, 10);
            this.rate(rating);
          }
        });
      }
    }

    open(items = []) {
      if (!Array.isArray(items) || items.length === 0) {
        if (typeof this.showToast === 'function') {
          this.showToast('Không có từ vựng hoặc câu giao tiếp nào để tạo thẻ ghi nhớ.', 'info');
        }
        return;
      }

      this.list = items;
      this.currentIdx = 0;
      this.isFlipped = false;
      if (this.elements.card) this.elements.card.classList.remove('is-flipped');
      if (this.elements.srsBar) this.elements.srsBar.style.display = 'none';

      this.render();
      if (this.elements.modal) this.elements.modal.style.display = 'flex';
    }

    close() {
      if (this.audioService) this.audioService.stop();
      if (this.elements.modal) this.elements.modal.style.display = 'none';
      this.isFlipped = false;
      if (this.elements.card) this.elements.card.classList.remove('is-flipped');
      if (this.elements.srsBar) this.elements.srsBar.style.display = 'none';
    }

    flip() {
      this.isFlipped = !this.isFlipped;
      if (this.elements.card) {
        this.elements.card.classList.toggle('is-flipped', this.isFlipped);
      }
      if (this.elements.srsBar) {
        this.elements.srsBar.style.display = this.isFlipped ? 'flex' : 'none';
      }
    }

    prev() {
      if (this.currentIdx > 0) {
        this.currentIdx--;
        this.isFlipped = false;
        if (this.elements.card) this.elements.card.classList.remove('is-flipped');
        if (this.elements.srsBar) this.elements.srsBar.style.display = 'none';
        this.render();
      }
    }

    next() {
      if (this.currentIdx < this.list.length - 1) {
        this.currentIdx++;
        this.isFlipped = false;
        if (this.elements.card) this.elements.card.classList.remove('is-flipped');
        if (this.elements.srsBar) this.elements.srsBar.style.display = 'none';
        this.render();
      }
    }

    /**
     * Rate current card using Spaced Repetition (SM-2)
     * @param {number} rating 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
     */
    rate(rating) {
      const item = this.list[this.currentIdx];
      if (!item) return;

      const key = (item.word || item.sentence || '').toLowerCase().trim();
      if (!key) return;

      const store = this.store || (typeof APP_STUDIO_STATE !== 'undefined' ? APP_STUDIO_STATE : null);
      if (store) {
        const state = store.getState();
        const curWordState = state.wordStates[key] || { starred: false, mastered: false, srsLevel: 0 };
        const now = Date.now();
        let nextReview = now;
        let curLevel = curWordState.srsLevel || 0;

        if (rating === 1) {
          nextReview += 60 * 1000; // 1 min
          curLevel = 0;
        } else if (rating === 2) {
          nextReview += 10 * 60 * 1000; // 10 min
        } else if (rating === 3) {
          nextReview += 24 * 60 * 60 * 1000; // 1 day
          curLevel += 1;
        } else if (rating === 4) {
          nextReview += 4 * 24 * 60 * 60 * 1000; // 4 days
          curLevel += 2;
          if (typeof this.onToggleMasterCallback === 'function') {
            this.onToggleMasterCallback(key, item, true);
          }
        }

        const updated = {
          ...state.wordStates,
          [key]: {
            ...curWordState,
            srsLevel: curLevel,
            nextReview,
            updatedAt: now
          }
        };

        store.setState({ wordStates: updated });
        store.saveWordStates();
      }

      if (this.currentIdx < this.list.length - 1) {
        this.next();
      } else {
        if (typeof this.showToast === 'function') {
          this.showToast('Chúc mừng! Bạn đã hoàn thành lượt ôn tập tất cả các thẻ từ này.', 'success');
        }
        this.close();
      }
    }

    render() {
      const item = this.list[this.currentIdx];
      if (!item) return;
      const el = this.elements;

      if (el.counter) {
        el.counter.textContent = `${this.currentIdx + 1} / ${this.list.length}`;
      }

      const store = this.store || (typeof APP_STUDIO_STATE !== 'undefined' ? APP_STUDIO_STATE : null);
      const isStarred = store ? store.isStarred(item.word || item.sentence) : false;
      const isMastered = store ? store.isMastered(item.word || item.sentence) : false;

      if (el.starBtn) {
        el.starBtn.classList.toggle('active', isStarred);
        el.starBtn.textContent = isStarred ? 'Đã lưu' : 'Lưu';
      }
      if (el.masterBtn) {
        el.masterBtn.classList.toggle('active', isMastered);
        el.masterBtn.textContent = isMastered ? 'Đã thuộc' : 'Thuộc';
      }

      if (el.prevBtn) el.prevBtn.disabled = (this.currentIdx === 0);
      if (el.nextBtn) el.nextBtn.disabled = (this.currentIdx === this.list.length - 1);

      // Sentence Flashcard
      if (item.sentence) {
        if (el.pos) {
          el.pos.textContent = (item.tag || 'GIAO TIẾP').toUpperCase();
          el.pos.className = 'fx-pos-badge sentences';
        }
        if (el.cefr) el.cefr.textContent = 'GIAO TIẾP';
        if (el.freq) el.freq.textContent = `${item.frequency || 1}x xuất hiện`;
        if (el.word) el.word.textContent = item.sentence;
        if (el.ipa) el.ipa.textContent = item.startTime || '';
        if (el.context) {
          el.context.innerHTML = item.highlightPhrase ? `Cụm từ cốt lõi: <b>${this._escape(item.highlightPhrase)}</b>` : '';
        }
        if (el.trans) el.trans.textContent = item.vietnamese || 'Chưa có bản dịch';
        if (el.lemma) {
          el.lemma.innerHTML = item.usageNote ? `Ứng dụng: <b>${this._escape(item.usageNote)}</b>` : '';
        }
        if (el.backSentence) {
          el.backSentence.innerHTML = `"${this._escape(item.sentence)}"`;
        }
        return;
      }

      // Word Flashcard
      const posLabel = (typeof APP_TYPES !== 'undefined') ? APP_TYPES.getPosLabelVi(item.pos) : (item.posLabelVi || item.pos || 'Từ vựng');
      if (el.pos) {
        el.pos.textContent = posLabel.toUpperCase();
        el.pos.className = `fx-pos-badge ${item.pos || 'noun'}`;
      }
      if (el.cefr) el.cefr.textContent = item.cefr || 'A1';
      if (el.freq) el.freq.textContent = `${item.frequency || 1}x xuất hiện`;
      if (el.word) el.word.textContent = item.word || '';
      if (el.ipa) el.ipa.textContent = item.ipa || '';

      const contextRaw = item.contexts?.[0]?.text || item.contextSentence || '';
      const safeContext = this._escape(contextRaw);
      const highlightedContext = safeContext.replace(
        new RegExp(`\\b(${this._escapeRegExp(item.word || '')})\\b`, 'gi'),
        '<b class="fx-quote-highlight">$1</b>'
      );

      if (el.context) el.context.innerHTML = contextRaw ? `"${highlightedContext}"` : '';
      if (el.trans) el.trans.textContent = item.vietnamese || item.translation || 'Chưa có nghĩa';
      if (el.lemma) {
        el.lemma.innerHTML = (item.lemma && item.lemma !== item.word)
          ? `Từ gốc: <b>${this._escape(item.lemma)}</b> (${posLabel})`
          : '';
      }
      if (el.backSentence) el.backSentence.innerHTML = contextRaw ? `"${highlightedContext}"` : '';
    }

    _escape(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    _escapeRegExp(str) {
      if (!str) return '';
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  return new FlashcardController();
});
