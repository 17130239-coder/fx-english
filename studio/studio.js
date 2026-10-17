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
      this.loadHistory();
      this.checkPendingStorage();
      this.detectActiveMedia();
    },

    bindElements() {
      // History elements
      this.historySection = document.getElementById('fx-history-section');
      this.historyCountEl = document.getElementById('fx-history-count');
      this.historyEmptyEl = document.getElementById('fx-history-empty');
      this.historyGridEl = document.getElementById('fx-history-grid');
      this.btnClearHistory = document.getElementById('fx-btn-clear-history');
      this.neonSyncPill = document.getElementById('fx-neon-sync-pill');
      this.neonSyncText = document.getElementById('fx-neon-sync-text');

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

      // Clear History Button
      if (this.btnClearHistory) {
        this.btnClearHistory.addEventListener('click', () => this.clearAllHistory());
      }

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
          if (item.url) this.movieUrl = item.url;
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
      this.btnLoadDetected.innerHTML = '<span>⏳ Đang tải & phân tích phụ đề...</span>';

      const mediaTab = this.detectedMediaTab || {};
      const url = mediaTab.url || '';
      const platform = mediaTab.platform || (url.includes('netflix') ? 'netflix' : 'youtube');

      const onSubtitlesLoaded = (cues, title, videoUrl) => {
        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.innerHTML = '<span>⚡ Phân tích ngay</span>';
        if (Array.isArray(cues) && cues.length > 0) {
          this.movieTitle = title || mediaTab.title || 'Movie';
          this.movieUrl = videoUrl || url;
          this.cues = cues;
          this.runAnalysis();
        } else {
          alert('Không tìm thấy câu phụ đề nào trong video này.');
        }
      };

      // 1. For YouTube: Try background InnerTube first (bypasses disconnected tab, 0.3s load)
      if (platform === 'youtube' && url) {
        chrome.runtime.sendMessage({ action: 'fetch_youtube_captions', url }, (ytRes) => {
          if (ytRes && ytRes.success && Array.isArray(ytRes.cues) && ytRes.cues.length > 0) {
            onSubtitlesLoaded(ytRes.cues, ytRes.title, url);
            return;
          }

          // Fallback to querying the tab
          this.queryTabForSubtitles(tabId, onSubtitlesLoaded);
        });
      } else {
        // 2. For Netflix or others: query tab directly
        this.queryTabForSubtitles(tabId, onSubtitlesLoaded);
      }
    },

    queryTabForSubtitles(tabId, onLoaded) {
      chrome.tabs.sendMessage(tabId, { action: 'get_subtitles' }, (res) => {
        if (!chrome.runtime.lastError && res && res.success && Array.isArray(res.cues) && res.cues.length > 0) {
          onLoaded(res.cues, res.title, res.url);
          return;
        }

        // Auto-inject script if tab was opened before extension reload
        if (chrome.scripting && chrome.scripting.executeScript && tabId) {
          const isNF = this.detectedMediaTab?.platform === 'netflix';
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['lib/subtitleParser.js', isNF ? 'content/netflixContent.js' : 'content/youtubeContent.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { action: 'get_subtitles' }, (retryRes) => {
                this.btnLoadDetected.disabled = false;
                this.btnLoadDetected.innerHTML = '<span>⚡ Phân tích ngay</span>';
                if (!chrome.runtime.lastError && retryRes && retryRes.success && Array.isArray(retryRes.cues) && retryRes.cues.length > 0) {
                  onLoaded(retryRes.cues, retryRes.title, retryRes.url);
                } else {
                  const err = retryRes?.error || 'Không thể tải phụ đề từ tab này. Hãy đảm bảo video đã bật CC rồi thử lại.';
                  alert(err);
                }
              });
            }, 400);
          }).catch(() => {
            this.btnLoadDetected.disabled = false;
            this.btnLoadDetected.innerHTML = '<span>⚡ Phân tích ngay</span>';
            alert('Không thể kết nối với tab video. Hãy tải lại (F5) tab video đó rồi bấm Phân tích ngay.');
          });
          return;
        }

        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.innerHTML = '<span>⚡ Phân tích ngay</span>';
        alert(res?.error || chrome.runtime.lastError?.message || 'Không thể tải phụ đề từ tab phim. Hãy đảm bảo video đã bật CC.');
      });
    },

    handleFileSelect(e) {
      if (e.target.files && e.target.files.length > 0) {
        this.loadFile(e.target.files[0]);
      }
    },

    loadFile(file) {
      this.movieTitle = file.name.replace(/\.[^/.]+$/, '');
      this.movieUrl = '';
      const reader = new FileReader();
      reader.onload = (e) => {
        this.rawTextarea.value = e.target.result;
        this.analyzeFromTextarea();
      };
      reader.readAsText(file);
    },

    pasteSampleSubtitles() {
      this.movieTitle = 'Movie_Sample';
      this.movieUrl = '';
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

    runAnalysis(skipSaveHistory = false) {
      if (!ANALYZER) {
        alert('Không tìm thấy VocabAnalyzer.');
        return;
      }

      this.analysis = ANALYZER.analyzeSubtitles(this.cues);
      this.updateStats();
      this.renderVocabularyGrid();
      if (!skipSaveHistory) {
        this.saveCurrentToHistory();
      }

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
        const lemmaHtml = (item.lemma && item.lemma !== item.word)
          ? `<span class="fx-lemma-chip" title="Dạng từ gốc">Gốc: <b>${this.escape(item.lemma)}</b></span>`
          : '';
        const timeHtml = item.contexts?.[0]?.start
          ? `<span class="fx-context-time">⏱ ${this.escape(item.contexts[0].start)}</span>`
          : '';

        card.innerHTML = `
          <div class="fx-word-card-top">
            <div class="fx-word-card-left">
              <span class="fx-word-head">${this.escape(item.word)}</span>
              <span class="fx-pos-badge ${item.pos}">${posLabel}</span>
              ${item.cefr ? `<span class="fx-cefr-badge">${item.cefr}</span>` : ''}
              ${lemmaHtml}
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
              <div class="fx-context-top-row">
                <span class="fx-context-label">Ngữ cảnh phim:</span>
                ${timeHtml}
              </div>
              <p class="fx-context-quote">"${contextHtml}"</p>
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
    },

    // ==========================================
    // Scanned Movies & Videos History Feature (Neon Cloud Sync)
    // ==========================================

    setNeonSyncStatus(status, text) {
      if (!this.neonSyncPill) return;
      this.neonSyncPill.classList.remove('syncing', 'offline');
      if (status === 'syncing') {
        this.neonSyncPill.classList.add('syncing');
      } else if (status === 'offline') {
        this.neonSyncPill.classList.add('offline');
      }
      if (this.neonSyncText && text) {
        this.neonSyncText.textContent = text;
      }
    },

    getNeonClient() {
      if (typeof APP_NEON_CLIENT !== 'undefined') return APP_NEON_CLIENT;
      if (typeof window !== 'undefined' && window.neonClient) return window.neonClient;
      return null;
    },

    async saveCurrentToHistory() {
      if (!this.analysis) return;

      const title = this.movieTitle || 'Không tên';
      let platform = 'file';
      if ((this.movieUrl && this.movieUrl.includes('youtube.com')) || (this.detectedMediaTab && this.detectedMediaTab.platform === 'youtube')) {
        platform = 'youtube';
      } else if ((this.movieUrl && this.movieUrl.includes('netflix.com')) || (this.detectedMediaTab && this.detectedMediaTab.platform === 'netflix')) {
        platform = 'netflix';
      }

      const newItem = {
        id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: title,
        platform: platform,
        url: this.movieUrl || '',
        timestamp: Date.now(),
        dateFormatted: new Date().toLocaleDateString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        wordCount: this.analysis.totals.uniqueWords,
        nounCount: this.analysis.categories.noun.count,
        verbCount: this.analysis.categories.verb.count,
        adjCount: this.analysis.categories.adjective.count,
        advCount: this.analysis.categories.adverb.count,
        cues: this.cues || [],
        analysis: this.analysis
      };

      // 1. Instant local persistence (offline-first)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fxScanHistory'], (res) => {
          let history = (res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : [];
          history = history.filter((item) => {
            if (this.movieUrl && item.url && item.url === this.movieUrl) return false;
            if (item.title && item.title === title) return false;
            return true;
          });
          history.unshift(newItem);
          if (history.length > 50) history = history.slice(0, 50);

          chrome.storage.local.set({ fxScanHistory: history }, () => {
            this.renderHistoryList(history);
          });
        });
      }

      // 2. Cloud persistence to Neon PostgreSQL
      const neon = this.getNeonClient();
      if (neon) {
        this.setNeonSyncStatus('syncing', 'Đang lưu Neon...');
        try {
          await neon.saveMovie(newItem);
          this.setNeonSyncStatus('synced', 'Neon DB (Đã lưu)');
        } catch (err) {
          console.warn('[FX Neon] Cloud save warning:', err);
          this.setNeonSyncStatus('offline', 'Neon DB (Lưu cục bộ)');
        }
      }
    },

    async loadHistory() {
      let localHistory = [];

      // 1. Render immediately from local storage cache
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        localHistory = await new Promise((resolve) => {
          chrome.storage.local.get(['fxScanHistory'], (res) => {
            resolve((res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : []);
          });
        });
        if (localHistory.length > 0) {
          this.renderHistoryList(localHistory);
        }
      }

      // 2. Neon Cloud Sync
      const neon = this.getNeonClient();
      if (!neon) {
        this.setNeonSyncStatus('offline', 'Neon DB');
        return;
      }

      this.setNeonSyncStatus('syncing', 'Đang kết nối Neon...');
      try {
        const cloudMovies = await neon.getMovies(100);

        // Merge cloud movies and local movies, avoiding duplicates
        const map = new Map();

        // Add cloud movies first
        cloudMovies.forEach((m) => {
          const key = m.id || m.title;
          map.set(key, m);
        });

        // Merge local movies
        localHistory.forEach((loc) => {
          const key = loc.id || loc.title;
          const existing = map.get(key);
          if (!existing || (loc.timestamp && loc.timestamp > (existing.timestamp || 0))) {
            map.set(key, loc);
          }
        });

        let merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (merged.length > 50) merged = merged.slice(0, 50);

        // Update local cache
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ fxScanHistory: merged });
        }

        this.renderHistoryList(merged);
        this.setNeonSyncStatus('synced', 'Neon DB (Đã đồng bộ)');

        // Background sync: push any local-only movie up to Neon
        localHistory.forEach((loc) => {
          const existsInCloud = cloudMovies.some((c) => c.id === loc.id || c.title === loc.title);
          if (!existsInCloud) {
            neon.saveMovie(loc).catch(() => {});
          }
        });
      } catch (err) {
        console.warn('[FX Neon] Load sync notice:', err);
        this.setNeonSyncStatus('offline', 'Neon DB (Offline)');
        if (localHistory.length > 0) {
          this.renderHistoryList(localHistory);
        }
      }
    },

    renderHistoryList(history) {
      if (!this.historyGridEl) return;

      const count = history.length;
      if (this.historyCountEl) {
        this.historyCountEl.textContent = count;
      }

      if (count === 0) {
        if (this.historyEmptyEl) this.historyEmptyEl.style.display = 'block';
        if (this.historyGridEl) {
          this.historyGridEl.style.display = 'none';
          this.historyGridEl.innerHTML = '';
        }
        if (this.btnClearHistory) this.btnClearHistory.style.display = 'none';
        return;
      }

      if (this.historyEmptyEl) this.historyEmptyEl.style.display = 'none';
      if (this.historyGridEl) this.historyGridEl.style.display = 'grid';
      if (this.btnClearHistory) this.btnClearHistory.style.display = 'inline-flex';

      this.historyGridEl.innerHTML = history.map((item) => {
        let badgeClass = 'badge-file';
        let badgeText = '📁 File / Mẫu';
        if (item.platform === 'youtube') {
          badgeClass = 'badge-yt';
          badgeText = '▶ YouTube';
        } else if (item.platform === 'netflix') {
          badgeClass = 'badge-nf';
          badgeText = '🍿 Netflix';
        }

        const isCurrentActive = this.movieTitle === item.title;

        return `
          <div class="fx-history-card ${isCurrentActive ? 'active' : ''}" data-id="${item.id}">
            <div class="fx-history-card-header">
              <span class="fx-history-badge ${badgeClass}">${badgeText}</span>
              <span class="fx-history-date">${item.dateFormatted || ''}</span>
              <button type="button" class="fx-btn-del-hist" data-id="${item.id}" title="Xóa bản ghi này khỏi máy & Neon">×</button>
            </div>
            <h4 class="fx-history-title" title="${this.escape(item.title)}">${this.escape(item.title)}</h4>
            <div class="fx-history-stats">
              <span class="fx-hist-pill hist-total">${item.wordCount} từ</span>
              <span class="fx-hist-pill hist-noun">N: ${item.nounCount}</span>
              <span class="fx-hist-pill hist-verb">V: ${item.verbCount}</span>
              <span class="fx-hist-pill hist-adj">Adj: ${item.adjCount}</span>
              <span class="fx-hist-pill hist-adv">Adv: ${item.advCount}</span>
            </div>
            <button type="button" class="fx-btn-open-hist" data-id="${item.id}">Xem danh sách từ loại 👉</button>
          </div>
        `;
      }).join('');

      // Bind Card & Button Clicks
      this.historyGridEl.querySelectorAll('.fx-history-card').forEach((card) => {
        const id = card.dataset.id;
        const item = history.find((h) => h.id === id);
        if (!item) return;

        // Card click -> open item
        card.addEventListener('click', (e) => {
          if (e.target.closest('.fx-btn-del-hist')) return;
          this.openHistoryItem(item);
        });

        // Delete button click
        const delBtn = card.querySelector('.fx-btn-del-hist');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteHistoryItem(id);
          });
        }
      });
    },

    openHistoryItem(item) {
      if (!item) return;

      this.movieTitle = item.title || 'fx_vocab';
      this.movieUrl = item.url || '';
      this.cues = item.cues || [];

      if (item.analysis && item.analysis.totals && item.analysis.categories) {
        this.analysis = item.analysis;
        this.updateStats();
        this.renderVocabularyGrid();
      } else if (this.cues.length > 0 && ANALYZER) {
        this.runAnalysis(true);
      }

      // Highlight active card
      if (this.historyGridEl) {
        this.historyGridEl.querySelectorAll('.fx-history-card').forEach((c) => {
          c.classList.toggle('active', c.dataset.id === item.id);
        });
      }

      // Show sections & nav buttons
      this.statsSection.style.display = 'grid';
      this.vocabSection.style.display = 'flex';
      this.btnToggleFlashcards.style.display = 'inline-flex';
      this.btnExportAnkiTop.style.display = 'inline-flex';
      this.btnExportCsvTop.style.display = 'inline-flex';

      // Scroll to vocab section smoothly
      this.vocabSection.scrollIntoView({ behavior: 'smooth' });
    },

    async deleteHistoryItem(id) {
      // 1. Delete from local storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fxScanHistory'], (res) => {
          let history = (res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : [];
          history = history.filter((item) => item.id !== id);
          chrome.storage.local.set({ fxScanHistory: history }, () => {
            this.renderHistoryList(history);
          });
        });
      }

      // 2. Delete from Neon PostgreSQL
      const neon = this.getNeonClient();
      if (neon) {
        neon.deleteMovie(id).catch((err) => console.warn('[FX Neon] Cloud delete warning:', err));
      }
    },

    async clearAllHistory() {
      if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử các phim đã quét (cả trên trình duyệt và Neon DB)?')) return;

      // 1. Clear local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['fxScanHistory'], () => {
          this.renderHistoryList([]);
        });
      }

      // 2. Clear Neon
      const neon = this.getNeonClient();
      if (neon) {
        neon.clearAllMovies().catch((err) => console.warn('[FX Neon] Cloud clear warning:', err));
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => Studio.init());
})();
