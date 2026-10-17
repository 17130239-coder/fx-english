/**
 * FX English - Vocabulary Studio & 3D Flashcards Controller
 */

'use strict';

(function () {
  const PARSER = (typeof APP_SUBTITLE_PARSER !== 'undefined') ? APP_SUBTITLE_PARSER : null;
  const ANALYZER = (typeof APP_VOCAB_ANALYZER !== 'undefined') ? APP_VOCAB_ANALYZER : null;

  const Studio = {
    cues: [],
    analysis: null,
    movieTitle: 'fx_vocab',
    activePosFilter: 'all',
    searchQuery: '',
    cefrFilter: 'all',
    sortMode: 'freq-desc',

    // Flashcard State
    flashcardList: [],
    currentCardIdx: 0,
    isCardFlipped: false,

    init() {
      this.bindElements();
      this.bindEvents();
      this.checkPendingStorage();
      this.detectActiveMedia();
    },

    bindElements() {
      // Banners & Inputs
      this.bannerEl = document.getElementById('fx-detected-banner');
      this.bannerTitleEl = document.getElementById('fx-banner-title');
      this.btnLoadDetected = document.getElementById('fx-btn-load-detected');

      this.dropzone = document.getElementById('fx-dropzone');
      this.fileInput = document.getElementById('fx-file-input');
      this.btnBrowse = document.getElementById('fx-btn-browse');
      this.rawTextarea = document.getElementById('fx-raw-subtitles');
      this.btnPasteSample = document.getElementById('fx-btn-paste-sample');
      this.btnClear = document.getElementById('fx-btn-clear');
      this.btnAnalyze = document.getElementById('fx-btn-analyze');

      // Sections
      this.statsSection = document.getElementById('fx-stats-section');
      this.vocabSection = document.getElementById('fx-vocab-section');
      this.cardsGrid = document.getElementById('fx-cards-grid');

      // Stats Counters
      this.statTotal = document.getElementById('fx-stat-total');
      this.statNoun = document.getElementById('fx-stat-noun');
      this.statVerb = document.getElementById('fx-stat-verb');
      this.statAdj = document.getElementById('fx-stat-adj');
      this.statAdv = document.getElementById('fx-stat-adv');

      // Tab Counters
      this.tabCountAll = document.getElementById('fx-tab-count-all');
      this.tabCountNoun = document.getElementById('fx-tab-count-noun');
      this.tabCountVerb = document.getElementById('fx-tab-count-verb');
      this.tabCountAdj = document.getElementById('fx-tab-count-adj');
      this.tabCountAdv = document.getElementById('fx-tab-count-adv');

      // Filters
      this.searchInput = document.getElementById('fx-filter-search');
      this.cefrSelect = document.getElementById('fx-filter-cefr');
      this.sortSelect = document.getElementById('fx-filter-sort');

      // Nav Actions
      this.btnToggleFlashcards = document.getElementById('fx-btn-toggle-flashcards');
      this.btnExportAnkiTop = document.getElementById('fx-btn-export-anki-top');
      this.btnExportCsvTop = document.getElementById('fx-btn-export-csv-top');

      // Flashcards Modal
      this.fcModal = document.getElementById('fx-flashcard-modal');
      this.fcBackdrop = document.getElementById('fx-fc-backdrop');
      this.fcClose = document.getElementById('fx-fc-close');
      this.fcCard = document.getElementById('fx-fc-card');
      this.fcCounter = document.getElementById('fx-fc-counter');
      this.fcPos = document.getElementById('fx-fc-pos');
      this.fcCefr = document.getElementById('fx-fc-cefr');
      this.fcFreq = document.getElementById('fx-fc-freq');
      this.fcWord = document.getElementById('fx-fc-word');
      this.fcIpa = document.getElementById('fx-fc-ipa');
      this.fcSpeak = document.getElementById('fx-fc-speak');
      this.fcContext = document.getElementById('fx-fc-context');
      this.fcTrans = document.getElementById('fx-fc-trans');
      this.fcLemma = document.getElementById('fx-fc-lemma');
      this.fcBackSentence = document.getElementById('fx-fc-back-sentence');
      this.fcPrev = document.getElementById('fx-fc-prev');
      this.fcNext = document.getElementById('fx-fc-next');
      this.fcFlip = document.getElementById('fx-fc-flip');
    },

    bindEvents() {
      // File upload & Drag Drop
      this.btnBrowse.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

      this.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropzone.classList.add('dragover');
      });
      this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('dragover'));
      this.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.loadFile(e.dataTransfer.files[0]);
        }
      });

      // Sample & Clear
      this.btnPasteSample.addEventListener('click', () => this.pasteSampleSubtitles());
      this.btnClear.addEventListener('click', () => {
        this.rawTextarea.value = '';
        this.cues = [];
      });

      // Analyze Button
      this.btnAnalyze.addEventListener('click', () => this.analyzeFromTextarea());

      // POS Tabs
      document.querySelectorAll('.fx-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.fx-tab-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.activePosFilter = btn.dataset.pos || 'all';
          this.renderVocabularyGrid();
        });
      });

      // Filter Changes
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderVocabularyGrid();
      });

      this.cefrSelect.addEventListener('change', (e) => {
        this.cefrFilter = e.target.value;
        this.renderVocabularyGrid();
      });

      this.sortSelect.addEventListener('change', (e) => {
        this.sortMode = e.target.value;
        this.renderVocabularyGrid();
      });

      // Exports
      this.btnExportAnkiTop.addEventListener('click', () => this.exportAnki());
      this.btnExportCsvTop.addEventListener('click', () => this.exportCsv());

      // 3D Flashcards
      this.btnToggleFlashcards.addEventListener('click', () => this.openFlashcards());
      this.fcClose.addEventListener('click', () => this.closeFlashcards());
      this.fcBackdrop.addEventListener('click', () => this.closeFlashcards());
      this.fcCard.addEventListener('click', () => this.flipFlashcard());
      this.fcFlip.addEventListener('click', () => this.flipFlashcard());
      this.fcPrev.addEventListener('click', () => this.prevFlashcard());
      this.fcNext.addEventListener('click', () => this.nextFlashcard());
      this.fcSpeak.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speakWord(this.fcWord.textContent);
      });

      // Keyboard navigation for Flashcards
      window.addEventListener('keydown', (e) => {
        if (this.fcModal.style.display !== 'flex') return;
        if (e.code === 'Space') {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.prevFlashcard();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.nextFlashcard();
        } else if (e.code === 'Escape') {
          this.closeFlashcards();
        }
      });
    },

    checkPendingStorage() {
      chrome.storage.local.get(['fxPendingStudio'], (res) => {
        if (res && res.fxPendingStudio) {
          const item = res.fxPendingStudio;
          chrome.storage.local.remove(['fxPendingStudio']);
          if (item.title) this.movieTitle = item.title;
          if (item.rawText) {
            this.rawTextarea.value = item.rawText;
            this.analyzeFromTextarea();
          } else if (Array.isArray(item.cues) && item.cues.length > 0) {
            this.cues = item.cues;
            this.runAnalysis();
          }
        }
      });
    },

    detectActiveMedia() {
      chrome.runtime.sendMessage({ action: 'get_active_media_status' }, (res) => {
        if (res && res.isMedia) {
          this.detectedMediaTab = res;
          this.bannerTitleEl.textContent = res.title || (res.platform === 'netflix' ? 'Netflix Movie' : 'YouTube Video');
          this.bannerEl.style.display = 'flex';
          this.btnLoadDetected.onclick = () => {
            this.loadFromMediaTab(res.tabId);
          };
        }
      });
    },

    loadFromMediaTab(tabId) {
      this.btnLoadDetected.disabled = true;
      this.btnLoadDetected.textContent = 'Đang tải phụ đề...';

      chrome.tabs.sendMessage(tabId, { action: 'get_subtitles' }, (res) => {
        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.textContent = '⚡ Phân tích ngay';

        if (chrome.runtime.lastError || !res || !res.success) {
          const err = res?.error || chrome.runtime.lastError?.message || 'Không thể tải phụ đề từ tab phim. Hãy đảm bảo video đã bật CC.';
          alert(err);
          return;
        }

        if (Array.isArray(res.cues) && res.cues.length > 0) {
          this.movieTitle = res.title || 'Movie';
          this.cues = res.cues;
          this.runAnalysis();
        } else {
          alert('Không tìm thấy câu phụ đề nào trong video này.');
        }
      });
    },

    handleFileSelect(e) {
      if (e.target.files && e.target.files.length > 0) {
        this.loadFile(e.target.files[0]);
      }
    },

    loadFile(file) {
      this.movieTitle = file.name.replace(/\.[^/.]+$/, '');
      const reader = new FileReader();
      reader.onload = (e) => {
        this.rawTextarea.value = e.target.result;
        this.analyzeFromTextarea();
      };
      reader.readAsText(file);
    },

    pasteSampleSubtitles() {
      this.movieTitle = 'Movie_Sample';
      this.rawTextarea.value = `1
00:00:01,000 --> 00:00:04,200
In a quiet ancient library, the young scholar discovered a mysterious map.

2
00:00:04,500 --> 00:00:08,100
He walked quickly toward the glowing pedestal and whispered softly.

3
00:00:08,400 --> 00:00:12,600
"Every difficult journey begins with courageous decisions," she smiled warmly.

4
00:00:13,000 --> 00:00:17,500
The brilliant astronomer suddenly realized the extraordinary secret of the stars.`;
      this.analyzeFromTextarea();
    },

    analyzeFromTextarea() {
      const text = this.rawTextarea.value.trim();
      if (!text) {
        alert('Vui lòng nhập hoặc dán nội dung phụ đề trước.');
        return;
      }

      if (PARSER) {
        this.cues = PARSER.parse(text);
      } else {
        this.cues = [{ text, start: 0, end: 10 }];
      }

      this.runAnalysis();
    },

    runAnalysis() {
      if (!ANALYZER) {
        alert('Không tìm thấy VocabAnalyzer.');
        return;
      }

      this.analysis = ANALYZER.analyzeSubtitles(this.cues);
      this.updateStats();
      this.renderVocabularyGrid();

      // Show sections & nav buttons
      this.statsSection.style.display = 'grid';
      this.vocabSection.style.display = 'flex';
      this.btnToggleFlashcards.style.display = 'inline-flex';
      this.btnExportAnkiTop.style.display = 'inline-flex';
      this.btnExportCsvTop.style.display = 'inline-flex';

      // Scroll to vocab section smoothly
      this.vocabSection.scrollIntoView({ behavior: 'smooth' });
    },

    updateStats() {
      if (!this.analysis) return;
      const { totals, categories } = this.analysis;

      this.statTotal.textContent = totals.uniqueWords.toLocaleString();
      this.statNoun.textContent = categories.noun.count.toLocaleString();
      this.statVerb.textContent = categories.verb.count.toLocaleString();
      this.statAdj.textContent = categories.adjective.count.toLocaleString();
      this.statAdv.textContent = categories.adverb.count.toLocaleString();

      this.tabCountAll.textContent = totals.uniqueWords.toLocaleString();
      this.tabCountNoun.textContent = categories.noun.count.toLocaleString();
      this.tabCountVerb.textContent = categories.verb.count.toLocaleString();
      this.tabCountAdj.textContent = categories.adjective.count.toLocaleString();
      this.tabCountAdv.textContent = categories.adverb.count.toLocaleString();
    },

    getFilteredWords() {
      if (!this.analysis) return [];
      let list = [];

      if (this.activePosFilter === 'all') {
        const seen = new Set();
        ['noun', 'verb', 'adjective', 'adverb'].forEach((catKey) => {
          this.analysis.categories[catKey].words.forEach((w) => {
            if (!seen.has(w.word)) {
              seen.add(w.word);
              list.push(w);
            }
          });
        });
      } else {
        const cat = this.analysis.categories[this.activePosFilter];
        list = cat ? [...cat.words] : [];
      }

      // Filter by CEFR
      if (this.cefrFilter !== 'all') {
        list = list.filter((w) => (w.cefr || '').toUpperCase() === this.cefrFilter.toUpperCase());
      }

      // Filter by search query
      if (this.searchQuery) {
        const q = this.searchQuery;
        list = list.filter((w) => {
          return w.word.toLowerCase().includes(q) ||
                 (w.vietnamese && w.vietnamese.toLowerCase().includes(q)) ||
                 (w.lemma && w.lemma.toLowerCase().includes(q));
        });
      }

      // Sorting
      if (this.sortMode === 'freq-desc') {
        list.sort((a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word));
      } else if (this.sortMode === 'freq-asc') {
        list.sort((a, b) => a.frequency - b.frequency || a.word.localeCompare(b.word));
      } else if (this.sortMode === 'alpha-asc') {
        list.sort((a, b) => a.word.localeCompare(b.word));
      } else if (this.sortMode === 'alpha-desc') {
        list.sort((a, b) => b.word.localeCompare(a.word));
      }

      return list;
    },

    renderVocabularyGrid() {
      const words = this.getFilteredWords();
      this.cardsGrid.innerHTML = '';

      if (words.length === 0) {
        this.cardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #71717a;">
            Không tìm thấy từ vựng nào khớp với bộ lọc.
          </div>
        `;
        return;
      }

      words.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'fx-word-card';

        const posLabel = this.getPosLabel(item.pos);
        const contextHtml = this.highlightWordInContext(item.contexts?.[0]?.text || '', item.word);

        card.innerHTML = `
          <div class="fx-word-card-top">
            <div class="fx-word-card-left">
              <span class="fx-word-head">${this.escape(item.word)}</span>
              <span class="fx-pos-badge ${item.pos}">${posLabel}</span>
              ${item.cefr ? `<span class="fx-cefr-badge">${item.cefr}</span>` : ''}
            </div>
            <span class="fx-freq-pill">${item.frequency}x</span>
          </div>

          <div class="fx-word-sub">
            <span class="fx-ipa-text">${item.ipa ? item.ipa : ''}</span>
            <button class="fx-btn-audio" title="Phát âm">🔊</button>
          </div>

          <p class="fx-trans-text">${this.escape(item.vietnamese || 'Đang cập nhật')}</p>

          ${contextHtml ? `
            <div class="fx-context-snippet">
              "${contextHtml}"
            </div>
          ` : ''}
        `;

        card.querySelector('.fx-btn-audio').onclick = (e) => {
          e.stopPropagation();
          this.speakWord(item.word);
        };

        this.cardsGrid.appendChild(card);
      });
    },

    highlightWordInContext(sentence, word) {
      if (!sentence) return '';
      const safe = this.escape(sentence);
      const reg = new RegExp(`\\b(${this.escapeRegExp(word)})\\b`, 'gi');
      return safe.replace(reg, '<b>$1</b>');
    },

    getPosLabel(pos) {
      switch (pos) {
        case 'noun': return 'Danh từ';
        case 'verb': return 'Động từ';
        case 'adjective': return 'Tính từ';
        case 'adverb': return 'Trạng từ';
        default: return pos || 'Từ vựng';
      }
    },

    speakWord(word) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    },

    // 3D Flashcards Implementation
    openFlashcards() {
      const words = this.getFilteredWords();
      if (words.length === 0) {
        alert('Không có từ vựng nào để tạo thẻ ghi nhớ.');
        return;
      }

      this.flashcardList = words;
      this.currentCardIdx = 0;
      this.isCardFlipped = false;
      this.renderFlashcard();
      this.fcModal.style.display = 'flex';
    },

    closeFlashcards() {
      this.fcModal.style.display = 'none';
    },

    flipFlashcard() {
      this.isCardFlipped = !this.isCardFlipped;
      if (this.isCardFlipped) {
        this.fcCard.classList.add('is-flipped');
      } else {
        this.fcCard.classList.remove('is-flipped');
      }
    },

    prevFlashcard() {
      if (this.currentCardIdx > 0) {
        this.currentCardIdx--;
        this.isCardFlipped = false;
        this.fcCard.classList.remove('is-flipped');
        this.renderFlashcard();
      }
    },

    nextFlashcard() {
      if (this.currentCardIdx < this.flashcardList.length - 1) {
        this.currentCardIdx++;
        this.isCardFlipped = false;
        this.fcCard.classList.remove('is-flipped');
        this.renderFlashcard();
      }
    },

    renderFlashcard() {
      const item = this.flashcardList[this.currentCardIdx];
      if (!item) return;

      this.fcCounter.textContent = `${this.currentCardIdx + 1} / ${this.flashcardList.length}`;
      this.fcPos.textContent = this.getPosLabel(item.pos).toUpperCase();
      this.fcPos.className = `fx-pos-badge ${item.pos}`;

      this.fcCefr.textContent = item.cefr || 'A1';
      this.fcFreq.textContent = `${item.frequency}x xuất hiện`;
      this.fcWord.textContent = item.word;
      this.fcIpa.textContent = item.ipa || '';

      const contextRaw = item.contexts?.[0]?.text || '';
      const contextHtml = this.highlightWordInContext(contextRaw, item.word);
      this.fcContext.innerHTML = contextHtml ? `"${contextHtml}"` : '';

      this.fcTrans.textContent = item.vietnamese || 'Chưa có nghĩa';
      this.fcLemma.innerHTML = item.lemma && item.lemma !== item.word ? `Từ gốc: <b>${this.escape(item.lemma)}</b> (${this.getPosLabel(item.pos)})` : '';
      this.fcBackSentence.innerHTML = contextHtml ? `"${contextHtml}"` : '';

      this.fcPrev.disabled = (this.currentCardIdx === 0);
      this.fcNext.disabled = (this.currentCardIdx === this.flashcardList.length - 1);
    },

    // Exports
    exportAnki() {
      const words = this.getFilteredWords();
      if (words.length === 0) {
        alert('Không có từ vựng nào để xuất.');
        return;
      }

      let content = '';
      if (ANALYZER) {
        content = ANALYZER.exportToAnkiFormat(words);
      } else {
        content = words.map(w => `${w.word}\t${w.vietnamese || ''}\t${w.ipa || ''}\t${w.pos || ''}`).join('\n');
      }

      this.downloadBlob(content, `${this.movieTitle}_anki.txt`, 'text/plain;charset=utf-8;');
    },

    exportCsv() {
      const words = this.getFilteredWords();
      if (words.length === 0) {
        alert('Không có từ vựng nào để xuất.');
        return;
      }

      let content = '';
      if (ANALYZER) {
        content = ANALYZER.exportToCsvFormat(words);
      } else {
        content = 'Word,POS,CEFR,Frequency,IPA,Vietnamese,Context\n' + words.map(w => `"${w.word}","${w.pos}","${w.cefr}",${w.frequency},"${w.ipa}","${w.vietnamese}","${w.contexts?.[0]?.text || ''}"`).join('\n');
      }

      this.downloadBlob(content, `${this.movieTitle}_vocab.csv`, 'text/csv;charset=utf-8;');
    },

    downloadBlob(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    },

    escape(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  };

  document.addEventListener('DOMContentLoaded', () => Studio.init());
})();
