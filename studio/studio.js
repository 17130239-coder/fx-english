/**
 * FX English - Vocabulary Studio & 3D Flashcards Controller
 */

'use strict';

(function () {
  const PARSER = (typeof APP_SUBTITLE_PARSER !== 'undefined') ? APP_SUBTITLE_PARSER : null;
  const ANALYZER = (typeof APP_VOCAB_ANALYZER !== 'undefined') ? APP_VOCAB_ANALYZER : null;
  const AI_CLIENT = (typeof APP_AI_CLIENT !== 'undefined') ? APP_AI_CLIENT : null;

  const Studio = {
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
    activeMasterFilter: 'all',
    masterSearchQuery: '',
    activeView: 'studio',

    // Flashcard State
    flashcardList: [],
    currentCardIdx: 0,
    isCardFlipped: false,

    init() {
      this.bindElements();
      this.bindEvents();
      this.loadWordStates();
      this.initMasterList();
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
      this.statSentences = document.getElementById('fx-stat-sentences');
      this.statStarred = document.getElementById('fx-stat-starred');
      this.statMastered = document.getElementById('fx-stat-mastered');

      // Tab Counters
      this.tabCountAll = document.getElementById('fx-tab-count-all');
      this.tabCountNoun = document.getElementById('fx-tab-count-noun');
      this.tabCountVerb = document.getElementById('fx-tab-count-verb');
      this.tabCountAdj = document.getElementById('fx-tab-count-adj');
      this.tabCountAdv = document.getElementById('fx-tab-count-adv');
      this.tabCountSentences = document.getElementById('fx-tab-count-sentences');
      this.tabCountStarred = document.getElementById('fx-tab-count-starred');

      // Filters
      this.searchInput = document.getElementById('fx-filter-search');
      this.toggleHideMastered = document.getElementById('fx-toggle-hide-mastered');
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
      this.fcStar = document.getElementById('fx-fc-star');
      this.fcMaster = document.getElementById('fx-fc-master');

      // 9Router AI Settings Modal
      this.btnOpenSettings = document.getElementById('fx-btn-open-settings');
      this.settingsModal = document.getElementById('fx-settings-modal');
      this.settingsBackdrop = document.getElementById('fx-settings-backdrop');
      this.settingsClose = document.getElementById('fx-settings-close');
      this.btnCancelSettings = document.getElementById('fx-btn-cancel-settings');
      this.btnSaveSettings = document.getElementById('fx-btn-save-settings');
      this.inputAiBaseUrl = document.getElementById('fx-ai-base-url');
      this.inputAiApiKey = document.getElementById('fx-ai-api-key');
      this.inputAiModel = document.getElementById('fx-ai-model');
      this.toggleKeyVis = document.getElementById('fx-toggle-key-vis');
      this.settingsStatus = document.getElementById('fx-settings-status');

      // Master List View & Header Switcher
      this.navTabStudio = document.getElementById('fx-nav-tab-studio');
      this.navTabMaster = document.getElementById('fx-nav-tab-master');
      this.navMasterCount = document.getElementById('fx-nav-master-count');
      this.studioView = document.getElementById('fx-studio-view');
      this.masterView = document.getElementById('fx-master-view');

      this.btnOpenAddMaster = document.getElementById('fx-btn-open-add-master');
      this.btnExportMasterAnki = document.getElementById('fx-btn-export-master-anki');
      this.btnExportMasterCsv = document.getElementById('fx-btn-export-master-csv');
      this.btnClearMaster = document.getElementById('fx-btn-clear-master');

      this.masterTabsGroup = document.getElementById('fx-master-tabs');
      this.masterCountAll = document.getElementById('fx-master-count-all');
      this.masterCountWord = document.getElementById('fx-master-count-word');
      this.masterCountSentence = document.getElementById('fx-master-count-sentence');
      this.masterCountPolysemy = document.getElementById('fx-master-count-polysemy');
      this.masterSearchInput = document.getElementById('fx-master-search');
      this.masterEmptyEl = document.getElementById('fx-master-empty');
      this.masterGridEl = document.getElementById('fx-master-grid');

      // Add Master Item Modal
      this.addMasterModal = document.getElementById('fx-add-master-modal');
      this.addMasterBackdrop = document.getElementById('fx-add-master-backdrop');
      this.addMasterClose = document.getElementById('fx-add-master-close');
      this.btnCancelAddMaster = document.getElementById('fx-btn-cancel-add-master');
      this.btnSubmitAddMaster = document.getElementById('fx-btn-submit-add-master');
      this.inputMasterText = document.getElementById('fx-input-master-text');
      this.selectMasterPos = document.getElementById('fx-select-master-pos');
      this.inputMasterMeanings = document.getElementById('fx-input-master-meanings');
      this.addMasterStatus = document.getElementById('fx-add-master-status');
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

      // POS Tabs (Studio View)
      document.querySelectorAll('.fx-filters-bar:not(.fx-master-filters-bar) .fx-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.fx-filters-bar:not(.fx-master-filters-bar) .fx-tab-btn').forEach((b) => b.classList.remove('active'));
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

      if (this.toggleHideMastered) {
        this.toggleHideMastered.addEventListener('change', (e) => {
          this.hideMastered = e.target.checked;
          this.renderVocabularyGrid();
        });
      }

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
      if (this.fcStar) {
        this.fcStar.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = this.flashcardList[this.currentCardIdx];
          const target = item?.word || item?.sentence;
          if (target) {
            this.toggleStar(target);
            this.renderFlashcard();
          }
        });
      }
      if (this.fcMaster) {
        this.fcMaster.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = this.flashcardList[this.currentCardIdx];
          const target = item?.word || item?.sentence;
          if (target) {
            this.toggleMastered(target, item);
            this.renderFlashcard();
          }
        });
      }
      this.fcSpeak.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speakWord(this.fcWord.textContent);
      });

      // Clear History Button
      if (this.btnClearHistory) {
        this.btnClearHistory.addEventListener('click', () => this.clearAllHistory());
      }

      // Settings Modal Events
      if (this.btnOpenSettings) {
        this.btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
      }
      if (this.settingsClose) {
        this.settingsClose.addEventListener('click', () => this.closeSettingsModal());
      }
      if (this.settingsBackdrop) {
        this.settingsBackdrop.addEventListener('click', () => this.closeSettingsModal());
      }
      if (this.btnCancelSettings) {
        this.btnCancelSettings.addEventListener('click', () => this.closeSettingsModal());
      }
      if (this.btnSaveSettings) {
        this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
      }
      if (this.toggleKeyVis && this.inputAiApiKey) {
        this.toggleKeyVis.addEventListener('click', () => {
          this.inputAiApiKey.type = (this.inputAiApiKey.type === 'password') ? 'text' : 'password';
        });
      }

      // Master List Header Switcher Events
      if (this.navTabStudio) {
        this.navTabStudio.addEventListener('click', () => this.switchView('studio'));
      }
      if (this.navTabMaster) {
        this.navTabMaster.addEventListener('click', () => this.switchView('master'));
      }

      // Master List Action Buttons
      if (this.btnOpenAddMaster) {
        this.btnOpenAddMaster.addEventListener('click', () => this.openAddMasterModal());
      }
      if (this.btnExportMasterAnki) {
        this.btnExportMasterAnki.addEventListener('click', () => this.exportMasterAnki());
      }
      if (this.btnExportMasterCsv) {
        this.btnExportMasterCsv.addEventListener('click', () => this.exportMasterCsv());
      }
      if (this.btnClearMaster) {
        this.btnClearMaster.addEventListener('click', () => this.clearMasterList());
      }

      // Master List Filter Tabs
      if (this.masterTabsGroup) {
        this.masterTabsGroup.querySelectorAll('.fx-tab-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.masterTabsGroup.querySelectorAll('.fx-tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            this.activeMasterFilter = btn.dataset.type || 'all';
            this.renderMasterList();
          });
        });
      }

      // Master List Search
      if (this.masterSearchInput) {
        this.masterSearchInput.addEventListener('input', (e) => {
          this.masterSearchQuery = e.target.value.trim().toLowerCase();
          this.renderMasterList();
        });
      }

      // Add Master Modal Events
      if (this.addMasterClose) {
        this.addMasterClose.addEventListener('click', () => this.closeAddMasterModal());
      }
      if (this.addMasterBackdrop) {
        this.addMasterBackdrop.addEventListener('click', () => this.closeAddMasterModal());
      }
      if (this.btnCancelAddMaster) {
        this.btnCancelAddMaster.addEventListener('click', () => this.closeAddMasterModal());
      }
      if (this.btnSubmitAddMaster) {
        this.btnSubmitAddMaster.addEventListener('click', () => this.submitAddMaster());
      }
      if (this.inputMasterText) {
        this.inputMasterText.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submitAddMaster();
        });
      }
      if (this.inputMasterMeanings) {
        this.inputMasterMeanings.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submitAddMaster();
        });
      }

      // Keyboard navigation for Flashcards & Modals
      window.addEventListener('keydown', (e) => {
        if (this.settingsModal && this.settingsModal.style.display === 'flex' && e.code === 'Escape') {
          this.closeSettingsModal();
          return;
        }
        if (this.addMasterModal && this.addMasterModal.style.display === 'flex' && e.code === 'Escape') {
          this.closeAddMasterModal();
          return;
        }
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
          const displayTitle = res.title || (res.platform === 'netflix' ? 'Netflix Movie' : 'YouTube Video');
          if (res.url) {
            this.bannerTitleEl.innerHTML = `<a href="${this.escape(res.url)}" target="_blank" rel="noopener noreferrer" class="fx-banner-link" title="Mở link video/phim trên tab mới">${this.escape(displayTitle)} <span class="fx-banner-arrow">↗</span></a>`;
          } else {
            this.bannerTitleEl.textContent = displayTitle;
          }
          this.bannerEl.style.display = 'flex';
          this.btnLoadDetected.onclick = () => {
            this.loadFromMediaTab(res.tabId);
          };
        }
      });
    },

    loadFromMediaTab(tabId) {
      this.btnLoadDetected.disabled = true;
      this.btnLoadDetected.innerHTML = '<span>Đang tải...</span>';

      const mediaTab = this.detectedMediaTab || {};
      const url = mediaTab.url || '';
      const platform = mediaTab.platform || (url.includes('netflix') ? 'netflix' : 'youtube');

      const onSubtitlesLoaded = (cues, title, videoUrl) => {
        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
        if (Array.isArray(cues) && cues.length > 0) {
          let resolvedTitle = title || mediaTab.title || '';
          const finalUrl = videoUrl || url || '';

          // If title is generic (e.g. "Netflix") and we have a URL, extract title via background resolver
          if (this.isGenericTitle(resolvedTitle) && finalUrl) {
            const m = finalUrl.match(/\/watch\/(\d+)/);
            if (m) {
              resolvedTitle = `Netflix Phim #${m[1]}`;
              try {
                chrome.runtime.sendMessage({ action: 'resolve_netflix_title', watchId: m[1] }, (nfRes) => {
                  if (nfRes && nfRes.success && nfRes.title && nfRes.title.toLowerCase() !== 'netflix') {
                    this.movieTitle = nfRes.title;
                    if (this.bannerTitleEl) {
                      this.bannerTitleEl.innerHTML = `<a href="${this.escape(finalUrl)}" target="_blank" rel="noopener noreferrer" class="fx-banner-link" title="Mở link video/phim trên tab mới">${this.escape(nfRes.title)}</a>`;
                    }
                    this.saveCurrentToHistory();
                  }
                });
              } catch (e) {}
            } else {
              const yt = finalUrl.match(/(?:v=|\/shorts\/)([a-zA-Z0-9_-]+)/);
              if (yt) {
                resolvedTitle = `YouTube Video #${yt[1]}`;
                try {
                  chrome.runtime.sendMessage({ action: 'resolve_youtube_title', url: finalUrl }, (ytRes) => {
                    if (ytRes && ytRes.success && ytRes.title && ytRes.title.toLowerCase() !== 'youtube') {
                      this.movieTitle = ytRes.title;
                      if (this.bannerTitleEl) {
                        this.bannerTitleEl.innerHTML = `<a href="${this.escape(finalUrl)}" target="_blank" rel="noopener noreferrer" class="fx-banner-link" title="Mở link video/phim trên tab mới">${this.escape(ytRes.title)}</a>`;
                      }
                      this.saveCurrentToHistory();
                    }
                  });
                } catch (e) {}
              }
            }
          }

          this.movieTitle = resolvedTitle || 'Movie';
          this.movieUrl = finalUrl;
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
                this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
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
            this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
            alert('Không thể kết nối với tab video. Hãy tải lại (F5) tab video đó rồi bấm Phân tích.');
          });
          return;
        }

        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
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

    async analyzeFromTextarea() {
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

      await this.runAnalysis();
    },

    async runAnalysis(skipSaveHistory = false) {
      if (!this.cues || this.cues.length === 0) {
        alert('Chưa có dữ liệu phụ đề để phân tích.');
        return;
      }

      const ai = this.getAiClient();
      let analysisResult = null;

      // 1. Try 9Router AI Pipeline if configured
      if (ai && ai.isConfigured()) {
        const originalBtnHtml = this.btnAnalyze ? this.btnAnalyze.innerHTML : '';
        if (this.btnAnalyze) {
          this.btnAnalyze.disabled = true;
          this.btnAnalyze.textContent = 'Đang phân tích 9Router AI (0%)...';
        }

        try {
          const mlItems = this.getMasterList()?.getAll?.() || [];
          analysisResult = await ai.analyzeSubtitles(this.cues, (done, total) => {
            if (this.btnAnalyze) {
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              this.btnAnalyze.textContent = `Đang phân tích AI (${pct}%)...`;
            }
          }, mlItems);
        } catch (err) {
          console.warn('[FX AI] AI analysis warning, falling back to offline NLP:', err);
          if (err.code === 'NO_API_KEY') {
            this.openSettingsModal('Vui lòng nhập 9Router API Key để sử dụng AI phân tích.');
            if (this.btnAnalyze) {
              this.btnAnalyze.disabled = false;
              this.btnAnalyze.innerHTML = originalBtnHtml;
            }
            return;
          }
          alert('Lỗi gọi 9Router AI: ' + (err.message || 'Lỗi mạng') + '\nĐang chuyển sang bộ tách từ ngoại tuyến.');
        } finally {
          if (this.btnAnalyze) {
            this.btnAnalyze.disabled = false;
            this.btnAnalyze.innerHTML = originalBtnHtml;
          }
        }
      }

      // 2. Fallback to offline Compromise + CEFR analyzer
      if (!analysisResult) {
        if (!ai || !ai.isConfigured()) {
          this.openSettingsModal('Gợi ý: Nhập 9Router API Key để kích hoạt AI phân tích ngữ cảnh phim & gộp từ gốc thông minh.');
        }

        if (!ANALYZER) {
          alert('Không tìm thấy VocabAnalyzer.');
          return;
        }
        analysisResult = ANALYZER.analyzeSubtitles(this.cues);
      }

      this.analysis = analysisResult;
      this.updateStats();
      this.renderVocabularyGrid();

      // Only translate missing if any cards still have missing definitions (for offline fallback)
      this.translateMissingWords();

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

    // 9Router AI Settings Modal Handlers
    async openSettingsModal(notice = '') {
      if (!this.settingsModal) return;
      const ai = this.getAiClient();
      const conf = ai ? await ai.getConfig() : {
        baseUrl: 'http://localhost:20128/v1',
        apiKey: 'sk-98667fb36de52067-1qd56t-2af84524',
        model: 'ag/gemini-3.8-flash-low'
      };

      if (this.inputAiBaseUrl) this.inputAiBaseUrl.value = conf.baseUrl || 'http://localhost:20128/v1';
      if (this.inputAiApiKey) this.inputAiApiKey.value = conf.apiKey || 'sk-98667fb36de52067-1qd56t-2af84524';
      if (this.inputAiModel) this.inputAiModel.value = conf.model || 'ag/gemini-3.8-flash-low';

      if (this.settingsStatus) {
        if (notice) {
          this.settingsStatus.className = 'fx-settings-status loading';
          this.settingsStatus.textContent = notice;
          this.settingsStatus.style.display = 'block';
        } else {
          this.settingsStatus.style.display = 'none';
        }
      }

      this.settingsModal.style.display = 'flex';
    },

    closeSettingsModal() {
      if (this.settingsModal) {
        this.settingsModal.style.display = 'none';
      }
    },

    async saveSettings() {
      const ai = this.getAiClient();
      if (!ai) return;

      const rawBase = (this.inputAiBaseUrl?.value || '').trim() || 'http://localhost:20128/v1';
      const baseUrl = ai.normalizeBaseUrl ? ai.normalizeBaseUrl(rawBase) : rawBase;
      const apiKey = (this.inputAiApiKey?.value || '').trim() || 'sk-98667fb36de52067-1qd56t-2af84524';
      const model = (this.inputAiModel?.value || '').trim() || 'ag/gemini-3.8-flash-low';

      if (!apiKey) {
        this.showSettingsStatus('error', 'Vui lòng nhập 9Router API Key.');
        return;
      }

      this.showSettingsStatus('loading', 'Đang kiểm tra kết nối với AI...');
      if (this.btnSaveSettings) this.btnSaveSettings.disabled = true;

      try {
        const testRes = await ai.testConnection({ baseUrl, apiKey, model });
        if (testRes.ok) {
          await ai.saveConfig({ baseUrl, apiKey, model });
          if (this.inputAiBaseUrl) this.inputAiBaseUrl.value = baseUrl;
          this.showSettingsStatus('success', testRes.message || 'Đã kết nối và lưu cấu hình thành công!');
          setTimeout(() => {
            this.closeSettingsModal();
            if (this.btnSaveSettings) this.btnSaveSettings.disabled = false;
          }, 1200);
        } else {
          this.showSettingsStatus('error', testRes.error || 'Kiểm tra kết nối thất bại.');
          if (this.btnSaveSettings) this.btnSaveSettings.disabled = false;
        }
      } catch (err) {
        this.showSettingsStatus('error', err.message || 'Lỗi kiểm tra kết nối.');
        if (this.btnSaveSettings) this.btnSaveSettings.disabled = false;
      }
    },

    showSettingsStatus(type, msg) {
      if (!this.settingsStatus) return;
      this.settingsStatus.className = `fx-settings-status ${type}`;
      this.settingsStatus.textContent = msg;
      this.settingsStatus.style.display = 'block';
    },

    getAiClient() {
      if (typeof APP_AI_CLIENT !== 'undefined') return APP_AI_CLIENT;
      if (typeof window !== 'undefined' && window.aiClient) return window.aiClient;
      return null;
    },

    loadWordStates() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fxWordStates'], (res) => {
          this.wordStates = (res && typeof res.fxWordStates === 'object' && res.fxWordStates !== null) ? res.fxWordStates : {};
          this.syncWordStatesToMasterList();
          this.updateStats();
          if (this.analysis) this.renderVocabularyGrid();
        });
      }
    },

    saveWordStates() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ fxWordStates: this.wordStates });
      }
    },

    isStarred(key) {
      if (!key) return false;
      const cleanKey = String(key).trim().toLowerCase();
      return Boolean(this.wordStates[cleanKey]?.starred);
    },

    isMastered(key) {
      if (!key) return false;
      const cleanKey = String(key).trim().toLowerCase();
      return Boolean(this.wordStates[cleanKey]?.mastered);
    },

    toggleStar(key) {
      if (!key) return;
      const cleanKey = String(key).trim().toLowerCase();
      if (!this.wordStates[cleanKey]) {
        this.wordStates[cleanKey] = { starred: false, mastered: false, updatedAt: Date.now() };
      }
      this.wordStates[cleanKey].starred = !this.wordStates[cleanKey].starred;
      this.wordStates[cleanKey].updatedAt = Date.now();
      this.saveWordStates();
      this.updateStats();
      this.renderVocabularyGrid();
    },

    async toggleMastered(key, itemData = null) {
      if (!key) return;
      const cleanKey = String(key).trim().toLowerCase();
      if (!this.wordStates[cleanKey]) {
        this.wordStates[cleanKey] = { starred: false, mastered: false, updatedAt: Date.now() };
      }
      const newState = !this.wordStates[cleanKey].mastered;
      this.wordStates[cleanKey].mastered = newState;
      this.wordStates[cleanKey].updatedAt = Date.now();
      this.saveWordStates();

      const ml = this.getMasterList();
      if (ml) {
        if (newState) {
          let meaning = '';
          let pos = 'N';
          let type = cleanKey.includes(' ') ? 'sentence' : 'word';

          if (itemData) {
            meaning = (itemData.vietnamese || itemData.translation || '').trim();
            pos = itemData.pos || 'N';
            if (itemData.sentence) type = 'sentence';
          } else if (this.analysis?.allWords) {
            const found = this.analysis.allWords.find((w) => (w.word || '').toLowerCase() === cleanKey);
            if (found) {
              meaning = (found.vietnamese || found.translation || '').trim();
              pos = found.pos || 'N';
            }
          }

          const res = await ml.addOrAccumulate({
            text: cleanKey,
            type,
            pos,
            meanings: (meaning && meaning !== 'Đang tra nghĩa...' && meaning !== 'Đang cập nhật') ? [meaning] : ['Đã thuộc']
          });

          const neon = this.getNeonClient();
          if (neon && res?.item) {
            neon.saveMasterItem(res.item).catch((err) => console.warn('[FX Neon] saveMasterItem notice:', err));
          }
        } else {
          await ml.remove(cleanKey);
          const neon = this.getNeonClient();
          if (neon) {
            neon.deleteMasterItem(cleanKey).catch((err) => console.warn('[FX Neon] deleteMasterItem notice:', err));
          }
        }
        this.updateMasterCount();
        if (this.activeView === 'master') {
          this.renderMasterList();
        }
      }

      this.updateStats();
      this.renderVocabularyGrid();
    },

    jumpToVideoTimestamp(sec, url) {
      const targetUrl = url || this.movieUrl || this.detectedMediaTab?.url || '';
      const timeSec = Math.max(0, Math.floor(Number(sec) || 0));

      // Try sending seek command to currently connected active media tab
      if (this.detectedMediaTab && this.detectedMediaTab.tabId) {
        chrome.tabs.sendMessage(this.detectedMediaTab.tabId, { action: 'seek_to_time', timeSec }, (res) => {
          if (!chrome.runtime.lastError && res && res.success) {
            chrome.tabs.update(this.detectedMediaTab.tabId, { active: true });
            return;
          }
          this.openVideoUrlWithTime(targetUrl, timeSec);
        });
        return;
      }

      this.openVideoUrlWithTime(targetUrl, timeSec);
    },

    openVideoUrlWithTime(targetUrl, timeSec) {
      if (!targetUrl) return;
      let finalUrl = targetUrl;
      try {
        const u = new URL(targetUrl);
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
          u.searchParams.set('t', `${timeSec}s`);
          finalUrl = u.toString();
        } else if (targetUrl.includes('netflix.com')) {
          u.searchParams.set('t', timeSec.toString());
          finalUrl = u.toString();
        }
      } catch (e) {}
      window.open(finalUrl, '_blank');
    },

    updateStats() {
      if (!this.analysis) return;
      const { totals, categories, allWords } = this.analysis;

      this.statTotal.textContent = totals.uniqueWords.toLocaleString();
      this.statNoun.textContent = categories.noun.count.toLocaleString();
      this.statVerb.textContent = categories.verb.count.toLocaleString();
      this.statAdj.textContent = categories.adjective.count.toLocaleString();
      this.statAdv.textContent = categories.adverb.count.toLocaleString();
      if (this.statSentences) {
        const sentCount = categories.sentences?.count || totals.communicativeCount || 0;
        this.statSentences.textContent = sentCount.toLocaleString();
      }

      // Compute Starred & Mastered counts for currently analyzed words & sentences
      let starredCount = 0;
      let masteredCount = 0;
      (allWords || []).forEach((w) => {
        if (this.isStarred(w.word)) starredCount++;
        if (this.isMastered(w.word)) masteredCount++;
      });
      (this.analysis.communicativeSentences || []).forEach((s) => {
        if (this.isStarred(s.sentence)) starredCount++;
      });

      if (this.statStarred) this.statStarred.textContent = starredCount.toLocaleString();
      if (this.statMastered) this.statMastered.textContent = masteredCount.toLocaleString();

      this.tabCountAll.textContent = totals.uniqueWords.toLocaleString();
      this.tabCountNoun.textContent = categories.noun.count.toLocaleString();
      this.tabCountVerb.textContent = categories.verb.count.toLocaleString();
      this.tabCountAdj.textContent = categories.adjective.count.toLocaleString();
      this.tabCountAdv.textContent = categories.adverb.count.toLocaleString();
      if (this.tabCountSentences) {
        const sentCount = categories.sentences?.count || totals.communicativeCount || 0;
        this.tabCountSentences.textContent = sentCount.toLocaleString();
      }
      if (this.tabCountStarred) {
        this.tabCountStarred.textContent = starredCount.toLocaleString();
      }
    },

    getFilteredWords() {
      if (!this.analysis) return [];
      let list = [];

      if (this.activePosFilter === 'sentences') {
        const sentCat = this.analysis.categories?.sentences || { words: this.analysis.communicativeSentences || [] };
        list = [...(sentCat.words || [])];
      } else if (this.activePosFilter === 'starred') {
        const seen = new Set();
        (this.analysis.allWords || []).forEach((w) => {
          if (this.isStarred(w.word) && !seen.has(w.word)) {
            seen.add(w.word);
            list.push(w);
          }
        });
        (this.analysis.communicativeSentences || []).forEach((s) => {
          if (this.isStarred(s.sentence)) {
            list.push(s);
          }
        });
      } else if (this.activePosFilter === 'all') {
        const seen = new Set();
        ['noun', 'verb', 'adjective', 'adverb'].forEach((catKey) => {
          if (this.analysis.categories[catKey]) {
            this.analysis.categories[catKey].words.forEach((w) => {
              if (!seen.has(w.word)) {
                seen.add(w.word);
                list.push(w);
              }
            });
          }
        });
      } else {
        // Specific POS category ('noun', 'verb', 'adjective', 'adverb')
        // Also include words where this POS was used significantly in the movie
        const catKey = this.activePosFilter;
        const seen = new Set();
        (this.analysis.allWords || []).forEach((w) => {
          if (w.pos === catKey || (w.posCounts && w.posCounts[catKey] > 0)) {
            if (!seen.has(w.word)) {
              seen.add(w.word);
              list.push(w);
            }
          }
        });
      }

      // Hide Mastered Words filter (applies to vocab words)
      if (this.hideMastered && this.activePosFilter !== 'sentences') {
        list = list.filter((w) => !this.isMastered(w.word));
      }

      // Filter by CEFR (applies to vocabulary words; sentences pass through unless specific)
      if (this.cefrFilter !== 'all' && this.activePosFilter !== 'sentences') {
        list = list.filter((w) => (w.cefr || '').toUpperCase() === this.cefrFilter.toUpperCase());
      }

      // Filter by search query
      if (this.searchQuery) {
        const q = this.searchQuery;
        list = list.filter((w) => {
          return (w.word && w.word.toLowerCase().includes(q)) ||
                 (w.sentence && w.sentence.toLowerCase().includes(q)) ||
                 (w.vietnamese && w.vietnamese.toLowerCase().includes(q)) ||
                 (w.lemma && w.lemma.toLowerCase().includes(q));
        });
      }

      // Sorting
      if (this.sortMode === 'freq-desc') {
        list.sort((a, b) => (b.frequency || 0) - (a.frequency || 0) || (a.word || a.sentence || '').localeCompare(b.word || b.sentence || ''));
      } else if (this.sortMode === 'freq-asc') {
        list.sort((a, b) => (a.frequency || 0) - (b.frequency || 0) || (a.word || a.sentence || '').localeCompare(b.word || b.sentence || ''));
      } else if (this.sortMode === 'alpha-asc') {
        list.sort((a, b) => (a.word || a.sentence || '').localeCompare(b.word || b.sentence || ''));
      } else if (this.sortMode === 'alpha-desc') {
        list.sort((a, b) => (b.word || b.sentence || '').localeCompare(a.word || a.sentence || ''));
      }

      return list;
    },

    renderVocabularyGrid() {
      const words = this.getFilteredWords();
      this.cardsGrid.innerHTML = '';

      if (words.length === 0) {
        let emptyMsg = 'Không tìm thấy từ vựng nào khớp với bộ lọc.';
        if (this.activePosFilter === 'sentences') {
          emptyMsg = 'Không tìm thấy câu giao tiếp nào khớp với bộ lọc.';
        } else if (this.activePosFilter === 'starred') {
          emptyMsg = 'Bạn chưa lưu từ hoặc câu nào vào danh sách đã lưu. Nhấn biểu tượng ngôi sao trên thẻ để lưu lại.';
        }
        this.cardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #71717a;">
            ${emptyMsg}
          </div>
        `;
        return;
      }

      let hasMissingDefinitions = false;
      words.forEach((item) => {
        // Dedicated communicative sentence cards
        if (item.sentence) {
          const card = document.createElement('div');
          const isSentStarred = this.isStarred(item.sentence);
          card.className = 'fx-sentence-card' + (isSentStarred ? ' fx-card-starred' : '');

          let phraseHtml = this.escape(item.sentence);
          if (item.highlightPhrase) {
            const escapedHl = this.escapeRegExp(item.highlightPhrase);
            phraseHtml = phraseHtml.replace(new RegExp(`(${escapedHl})`, 'gi'), '<span class="fx-quote-highlight">$1</span>');
          }

          const videoUrl = item.videoUrl || this.movieUrl || '';
          const timeHtml = item.startTime
            ? `<span class="fx-card-time fx-jump-link" data-sec="${item.startSec || 0}" data-url="${this.escape(videoUrl)}" title="Nhảy đến phân cảnh phim">${this.escape(item.startTime)}</span>`
            : '';

          const cleanTag = (item.tag || 'Giao tiếp').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

          card.innerHTML = `
            <div class="fx-sent-top">
              <div class="fx-sent-meta-left">
                <span class="fx-sent-tag">${this.escape(cleanTag)}</span>
                ${timeHtml}
              </div>
              <div class="fx-sent-actions">
                <button type="button" class="fx-btn-icon-raw fx-btn-star ${isSentStarred ? 'active' : ''}" title="${isSentStarred ? 'Bỏ lưu' : 'Lưu câu'}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="${isSentStarred ? '#F4F4F6' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                <button type="button" class="fx-btn-icon-raw fx-btn-speak" title="Phát âm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                </button>
                <button type="button" class="fx-btn-icon-raw fx-btn-copy" title="Sao chép">
                  <svg class="fx-icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <svg class="fx-icon-copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="fx-sent-body">
              <p class="fx-sent-quote">"${phraseHtml}"</p>
              <p class="fx-sent-trans">${this.escape(item.vietnamese || '')}</p>
            </div>

            ${(item.highlightPhrase || item.usageNote) ? `
              <div class="fx-sent-footer">
                ${item.highlightPhrase ? `<span class="fx-sent-core">Cốt lõi: <b>${this.escape(item.highlightPhrase)}</b></span>` : ''}
                ${item.usageNote ? `<span class="fx-sent-note">${this.escape(item.usageNote.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim())}</span>` : ''}
              </div>
            ` : ''}
          `;

          card.querySelector('.fx-btn-star').onclick = (e) => {
            e.stopPropagation();
            this.toggleStar(item.sentence);
          };

          card.querySelector('.fx-btn-speak').onclick = (e) => {
            e.stopPropagation();
            this.speakWord(item.sentence);
          };

          const copyBtn = card.querySelector('.fx-btn-copy');
          const iconCopy = copyBtn.querySelector('.fx-icon-copy');
          const iconCopied = copyBtn.querySelector('.fx-icon-copied');
          copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.sentence).then(() => {
              if (iconCopy && iconCopied) {
                iconCopy.style.display = 'none';
                iconCopied.style.display = 'inline-block';
                setTimeout(() => {
                  iconCopy.style.display = 'inline-block';
                  iconCopied.style.display = 'none';
                }, 1500);
              }
            }).catch(() => {});
          };

          const jumpLink = card.querySelector('.fx-jump-link');
          if (jumpLink) {
            jumpLink.onclick = (e) => {
              e.stopPropagation();
              this.jumpToVideoTimestamp(item.startSec, videoUrl);
            };
          }

          this.cardsGrid.appendChild(card);
          return;
        }

        // Standard Vocabulary Word Card (Tesla 3-line format)
        const card = document.createElement('div');
        const isStarred = this.isStarred(item.word);
        const isMastered = this.isMastered(item.word);

        card.className = 'fx-word-card' +
          (isStarred ? ' fx-card-starred' : '') +
          (isMastered ? ' fx-card-mastered' : '');

        // Pick context sentence matching the active POS filter if available
        const matchedContext = (['noun', 'verb', 'adjective', 'adverb'].includes(this.activePosFilter) && item.posContexts?.[this.activePosFilter]?.[0])
          ? item.posContexts[this.activePosFilter][0]
          : (item.contexts?.[0] || null);

        const currentPos = (['noun', 'verb', 'adjective', 'adverb'].includes(this.activePosFilter) && item.posCounts?.[this.activePosFilter] > 0)
          ? this.activePosFilter
          : item.pos;

        const posLabel = this.getPosLabel(currentPos);
        const contextText = matchedContext?.text || matchedContext?.sentence || '';
        const contextHtml = this.highlightWordInContext(contextText, item.word);

        const lemmaHtml = (item.lemma && item.lemma !== item.word)
          ? `<span class="fx-card-lemma" title="Dạng từ gốc">(${this.escape(item.lemma)})</span>`
          : '';

        const startSec = matchedContext?.startSec || 0;
        const startTimeStr = matchedContext?.startTime || matchedContext?.start || '';
        const videoUrl = item.videoUrl || this.movieUrl || '';
        const timeHtml = startTimeStr
          ? `<span class="fx-card-time fx-jump-link" data-sec="${startSec}" data-url="${this.escape(videoUrl)}" title="Nhảy đến phân cảnh phim">${this.escape(startTimeStr)}</span>`
          : '';

        const trans = (item.vietnamese || item.translation || '').trim();
        if (!trans || trans === 'Đang cập nhật') {
          hasMissingDefinitions = true;
        }

        const newMeaningHtml = item.isNewMeaning
          ? `<span class="fx-badge-new-meaning" title="Nghĩa mới trong ngữ cảnh phim này">NGHĨA MỚI</span>`
          : '';

        const specsParts = [posLabel];
        if (item.cefr) specsParts.push(item.cefr);
        specsParts.push(`${item.frequency}x`);
        const specsText = specsParts.join(' · ');

        card.innerHTML = `
          <!-- Dòng 1: Từ vựng (18px, trắng đậm) + Thông tin phụ xám: Động từ · C1 · 1x + Nút Star/Check -->
          <div class="fx-card-line-1">
            <div class="fx-card-word-wrap">
              <span class="fx-card-word">${this.escape(item.word)}</span>
              ${lemmaHtml}
              ${newMeaningHtml}
            </div>
            <div class="fx-card-meta-actions">
              <span class="fx-card-specs">${specsText}</span>
              <button type="button" class="fx-btn-icon-raw fx-btn-star ${isStarred ? 'active' : ''}" title="${isStarred ? 'Bỏ lưu yêu thích' : 'Lưu từ yêu thích'}" data-word="${this.escape(item.word)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? '#F4F4F6' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button type="button" class="fx-btn-icon-raw fx-btn-check ${isMastered ? 'active' : ''}" title="${isMastered ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}" data-word="${this.escape(item.word)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isMastered ? '#10B981' : 'currentColor'}" stroke-width="${isMastered ? '2' : '1.5'}" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dòng 2: Phiên âm IPA + icon loa mảnh (bỏ viền xám) + Nghĩa tiếng Việt rõ ràng -->
          <div class="fx-card-line-2">
            ${item.ipa ? `<span class="fx-card-ipa">${this.escape(item.ipa)}</span>` : ''}
            <button type="button" class="fx-btn-icon-raw fx-btn-audio" title="Phát âm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <span class="fx-card-dot-sep">·</span>
            <span class="fx-card-trans" data-word="${this.escape(item.word)}">${this.escape(trans || 'Đang tra nghĩa...')}</span>
          </div>

          <!-- Dòng 3: Ngữ cảnh trực tiếp trong ngoặc kép (#8E8E93, từ khóa trắng gạch chân mảnh) -->
          ${contextHtml ? `
            <div class="fx-card-line-3">
              <p class="fx-card-quote">"${contextHtml}"</p>
              ${timeHtml}
            </div>
          ` : ''}
        `;

        card.querySelector('.fx-btn-star').onclick = (e) => {
          e.stopPropagation();
          this.toggleStar(item.word);
        };

        card.querySelector('.fx-btn-check').onclick = (e) => {
          e.stopPropagation();
          this.toggleMastered(item.word, item);
        };

        card.querySelector('.fx-btn-audio').onclick = (e) => {
          e.stopPropagation();
          this.speakWord(item.word);
        };

        const jumpLink = card.querySelector('.fx-jump-link');
        if (jumpLink) {
          jumpLink.onclick = (e) => {
            e.stopPropagation();
            this.jumpToVideoTimestamp(startSec, videoUrl);
          };
        }

        this.cardsGrid.appendChild(card);
      });

      if (hasMissingDefinitions) {
        this.translateMissingWords();
      }
    },

    translateMissingWords() {
      if (!this.analysis) return;

      const allWords = this.analysis.allWords || [];
      const wordsToTranslate = [];
      const seen = new Set();
      const cefr = (typeof APP_CEFR_DICT !== 'undefined') ? APP_CEFR_DICT : null;
      let updatedLocally = false;

      // 1. First pass: Check offline dictionary (rapid 0ms resolution)
      allWords.forEach((item) => {
        const trans = (item.vietnamese || item.translation || '').trim();
        if (!trans || trans === 'Đang cập nhật') {
          const w = (item.word || '').trim().toLowerCase();
          if (cefr) {
            const entry = cefr.lookup(w) || cefr.lookup(item.lemma || '');
            if (entry && entry.vi) {
              item.vietnamese = entry.vi;
              item.translation = entry.vi;
              if (entry.ipa && !item.ipa) item.ipa = entry.ipa;
              if (entry.cefr) item.cefr = entry.cefr;
              updatedLocally = true;

              const cardTrans = this.cardsGrid.querySelector(`.fx-card-trans[data-word="${item.word}"], .fx-trans-text[data-word="${item.word}"]`);
              if (cardTrans) {
                cardTrans.textContent = entry.vi;
              }
              return;
            }
          }
          if (w && !seen.has(w)) {
            seen.add(w);
            wordsToTranslate.push(w);
          }
        }
      });

      // Synchronize offline dictionary updates to categorized lists
      if (updatedLocally) {
        ['noun', 'verb', 'adjective', 'adverb'].forEach((cat) => {
          if (this.analysis.categories?.[cat]?.words) {
            this.analysis.categories[cat].words.forEach((item) => {
              const match = allWords.find(x => x.word.toLowerCase() === item.word.toLowerCase());
              if (match && match.vietnamese && match.vietnamese !== 'Đang cập nhật') {
                item.vietnamese = match.vietnamese;
                item.translation = match.vietnamese;
                if (match.ipa && !item.ipa) item.ipa = match.ipa;
              }
            });
          }
        });
      }

      if (wordsToTranslate.length === 0) {
        if (updatedLocally) this.saveCurrentToHistory();
        return;
      }

      // 2. Second pass: Batch translate remaining missing words via background worker (Google Translate API)
      chrome.runtime.sendMessage({ action: 'translate_words', words: wordsToTranslate }, (res) => {
        if (!res || !res.success || !res.translations) return;

        let hasNewTrans = false;
        allWords.forEach((item) => {
          const w = (item.word || '').trim().toLowerCase();
          const translated = res.translations[w];
          if (translated) {
            item.vietnamese = translated;
            item.translation = translated;
            hasNewTrans = true;

            const cardTrans = this.cardsGrid.querySelector(`.fx-card-trans[data-word="${item.word}"], .fx-trans-text[data-word="${item.word}"]`);
            if (cardTrans) {
              cardTrans.textContent = translated;
            }
          }
        });

        ['noun', 'verb', 'adjective', 'adverb'].forEach((cat) => {
          if (this.analysis.categories?.[cat]?.words) {
            this.analysis.categories[cat].words.forEach((item) => {
              const w = (item.word || '').trim().toLowerCase();
              if (res.translations[w]) {
                item.vietnamese = res.translations[w];
                item.translation = res.translations[w];
                hasNewTrans = true;
              }
            });
          }
        });

        if (hasNewTrans || updatedLocally) {
          this.saveCurrentToHistory();
        }
      });
    },

    highlightWordInContext(sentence, word) {
      if (!sentence) return '';
      const safe = this.escape(sentence);
      const reg = new RegExp(`\\b(${this.escapeRegExp(word)})\\b`, 'gi');
      return safe.replace(reg, '<b class="fx-quote-highlight">$1</b>');
    },

    getPosLabel(pos) {
      switch (pos) {
        case 'noun': return 'Danh từ';
        case 'verb': return 'Động từ';
        case 'adjective': return 'Tính từ';
        case 'adverb': return 'Trạng từ';
        case 'sentences': return 'Câu giao tiếp';
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
        alert('Không có từ vựng hoặc câu giao tiếp nào để tạo thẻ ghi nhớ.');
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

      // Sentence Flashcard
      if (item.isCommunicative || item.sentence) {
        const cleanTag = (item.tag || 'GIAO TIẾP').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        this.fcPos.textContent = cleanTag.toUpperCase();
        this.fcPos.className = 'fx-pos-badge sentences';
        this.fcCefr.textContent = 'GIAO TIẾP';
        this.fcFreq.textContent = `${item.frequency || 1}x xuất hiện`;
        this.fcWord.textContent = item.sentence;
        this.fcIpa.textContent = item.startTime || '';

        this.fcContext.innerHTML = item.highlightPhrase
          ? `Cụm từ cốt lõi: <b>${this.escape(item.highlightPhrase)}</b>`
          : '';

        this.fcTrans.textContent = item.vietnamese || 'Đang cập nhật nghĩa';
        this.fcLemma.innerHTML = item.usageNote
          ? `Ứng dụng: <b>${this.escape(item.usageNote.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim())}</b>`
          : '';
        this.fcBackSentence.innerHTML = `"${this.escape(item.sentence)}"`;

        this.fcPrev.disabled = (this.currentCardIdx === 0);
        this.fcNext.disabled = (this.currentCardIdx === this.flashcardList.length - 1);

        const currentKey = item.sentence;
        const isStarred = this.isStarred(currentKey);
        const isMastered = this.isMastered(currentKey);
        if (this.fcStar) {
          this.fcStar.classList.toggle('active', isStarred);
          this.fcStar.textContent = isStarred ? 'Đã lưu' : 'Lưu';
        }
        if (this.fcMaster) {
          this.fcMaster.classList.toggle('active', isMastered);
          this.fcMaster.textContent = isMastered ? 'Đã thuộc' : 'Thuộc';
        }
        return;
      }

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

      const currentKey = item.word;
      const isStarred = this.isStarred(currentKey);
      const isMastered = this.isMastered(currentKey);
      if (this.fcStar) {
        this.fcStar.classList.toggle('active', isStarred);
        this.fcStar.textContent = isStarred ? 'Đã lưu' : 'Lưu';
      }
      if (this.fcMaster) {
        this.fcMaster.classList.toggle('active', isMastered);
        this.fcMaster.textContent = isMastered ? 'Đã thuộc' : 'Thuộc';
      }
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

    isGenericTitle(str) {
      if (!str) return true;
      const lower = String(str).trim().toLowerCase();
      return (
        lower === 'netflix' ||
        lower === 'netflix movie' ||
        lower === 'netflix video' ||
        lower.startsWith('netflix phim #') ||
        lower.startsWith('netflix video #') ||
        lower === 'youtube' ||
        lower === 'youtube video' ||
        lower.startsWith('youtube video #') ||
        lower === 'không tên' ||
        lower === 'movie' ||
        lower === 'movie_sample' ||
        lower === 'fx_vocab' ||
        lower === 'video đang phát'
      );
    },

    repairGenericTitles(items) {
      if (!Array.isArray(items) || items.length === 0) return;

      items.forEach((item) => {
        if (!this.isGenericTitle(item.title) || !item.url) return;

        // Netflix title repair
        if (item.platform === 'netflix' || item.url.includes('netflix.com/watch/')) {
          const m = item.url.match(/\/watch\/(\d+)/);
          if (m && m[1]) {
            chrome.runtime.sendMessage({ action: 'resolve_netflix_title', watchId: m[1] }, (res) => {
              if (res && res.success && res.title && res.title.toLowerCase() !== 'netflix' && !res.title.startsWith('Netflix Phim #')) {
                item.title = res.title;
                if (this.historyGridEl) {
                  const card = this.historyGridEl.querySelector(`.fx-history-card[data-id="${item.id}"]`);
                  if (card) {
                    const titleEl = card.querySelector('.fx-history-title');
                    if (titleEl) {
                      titleEl.textContent = res.title;
                      titleEl.title = res.title;
                    }
                  }
                }
                this.persistUpdatedHistoryItem(item);
              }
            });
          }
        }

        // YouTube title repair
        if (item.platform === 'youtube' || item.url.includes('youtube.com')) {
          chrome.runtime.sendMessage({ action: 'resolve_youtube_title', url: item.url }, (res) => {
            if (res && res.success && res.title && res.title.toLowerCase() !== 'youtube') {
              item.title = res.title;
              if (this.historyGridEl) {
                const card = this.historyGridEl.querySelector(`.fx-history-card[data-id="${item.id}"]`);
                if (card) {
                  const titleEl = card.querySelector('.fx-history-title');
                  if (titleEl) {
                    titleEl.textContent = res.title;
                    titleEl.title = res.title;
                  }
                }
              }
              this.persistUpdatedHistoryItem(item);
            }
          });
        }
      });
    },

    persistUpdatedHistoryItem(updatedItem) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fxScanHistory'], (res) => {
          let list = (res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : [];
          const idx = list.findIndex(x => x.id === updatedItem.id || (x.url && x.url === updatedItem.url));
          if (idx !== -1) {
            list[idx].title = updatedItem.title;
            chrome.storage.local.set({ fxScanHistory: list });
          }
        });
      }
      const neon = this.getNeonClient();
      if (neon) {
        neon.saveMovie(updatedItem).catch(() => {});
      }
    },

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
        sentencesCount: this.analysis.categories?.sentences?.count || this.analysis.totals.communicativeCount || 0,
        cues: this.cues || [],
        analysis: this.analysis
      };

      // 1. Instant local persistence (offline-first)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fxScanHistory'], (res) => {
          let history = (res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : [];
          history = history.filter((item) => {
            // Case A: Both have URLs -> deduplicate ONLY if exact same URL
            if (this.movieUrl && item.url) {
              return item.url !== this.movieUrl;
            }
            // Case B: Neither has a URL -> deduplicate ONLY if both have identical non-generic title
            if (!this.movieUrl && !item.url) {
              if (!this.isGenericTitle(title) && item.title === title) {
                return false;
              }
            }
            // Case C: Distinct items -> keep both
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
          this.repairGenericTitles(localHistory);
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
          const key = (m.url && m.url.trim()) ? m.url.trim() : m.id;
          map.set(key, m);
        });

        // Merge local movies
        localHistory.forEach((loc) => {
          const key = (loc.url && loc.url.trim()) ? loc.url.trim() : loc.id;
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
        this.repairGenericTitles(merged);
        this.setNeonSyncStatus('synced', 'Neon DB (Đã đồng bộ)');

        // Background sync: push any local-only movie up to Neon
        localHistory.forEach((loc) => {
          const existsInCloud = cloudMovies.some((c) => (c.url && loc.url && c.url === loc.url) || c.id === loc.id);
          if (!existsInCloud) {
            neon.saveMovie(loc).catch(() => {});
          }
        });
      } catch (err) {
        console.warn('[FX Neon] Load sync notice:', err);
        this.setNeonSyncStatus('offline', 'Neon DB (Offline)');
        if (localHistory.length > 0) {
          this.renderHistoryList(localHistory);
          this.repairGenericTitles(localHistory);
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
        let platformClass = 'platform-file';
        let platformLabel = 'FILE';

        if (item.platform === 'youtube') {
          platformClass = 'platform-yt';
          platformLabel = 'YOUTUBE';
        } else if (item.platform === 'netflix') {
          platformClass = 'platform-nf';
          platformLabel = 'NETFLIX';
        }

        let resourceUrl = (item.url && item.url.trim()) ? item.url.trim() : '';
        if (!resourceUrl) {
          if (item.platform === 'youtube') {
            resourceUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title)}`;
          } else if (item.platform === 'netflix') {
            resourceUrl = `https://www.netflix.com/search?q=${encodeURIComponent(item.title)}`;
          }
        }

        const isCurrentActive = this.movieTitle === item.title;
        const sCount = item.sentencesCount || item.analysis?.categories?.sentences?.count || 0;

        const platformBadgeHtml = resourceUrl
          ? `<a href="${this.escape(resourceUrl)}" target="_blank" rel="noopener noreferrer" class="fx-hist-platform-link" title="Mở ${platformLabel} (tab mới)" onclick="event.stopPropagation();">
              <span class="fx-platform-dot ${platformClass}"></span>
              <span class="fx-platform-tag">${platformLabel}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="fx-arrow-icon">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>`
          : `<span class="fx-hist-platform-wrap">
              <span class="fx-platform-dot ${platformClass}"></span>
              <span class="fx-platform-tag">${platformLabel}</span>
            </span>`;

        return `
          <div class="fx-history-card ${isCurrentActive ? 'active' : ''}" data-id="${item.id}">
            <div class="fx-history-card-header">
              ${platformBadgeHtml}
              <div class="fx-history-header-right">
                <span class="fx-history-date">${item.dateFormatted || ''}</span>
                <button type="button" class="fx-btn-del-hist" data-id="${item.id}" title="Xóa bản ghi này">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="fx-history-title-row-card">
              <h4 class="fx-history-title" title="${this.escape(item.title)}">${this.escape(item.title)}</h4>
            </div>

            <div class="fx-history-stats-block">
              <div class="fx-hist-total-num">${(item.wordCount || 0).toLocaleString()} từ</div>
              <div class="fx-hist-specs">${item.nounCount || 0} N  ·  ${item.verbCount || 0} V  ·  ${item.adjCount || 0} Adj  ·  ${item.advCount || 0} Adv${sCount ? `  ·  ${sCount} câu` : ''}</div>
            </div>
          </div>
        `;
      }).join('');

      // Bind Card & Button Clicks
      this.historyGridEl.querySelectorAll('.fx-history-card').forEach((card) => {
        const id = card.dataset.id;
        const item = history.find((h) => h.id === id);
        if (!item) return;

        // Card click -> open item (ignore clicks on delete or external link)
        card.addEventListener('click', (e) => {
          if (e.target.closest('.fx-btn-del-hist') || e.target.closest('.fx-hist-platform-link')) return;
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
        this.translateMissingWords();
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
    },

    // =========================================================================
    // Master Known List Management
    // =========================================================================

    getMasterList() {
      if (typeof APP_MASTER_LIST !== 'undefined') return APP_MASTER_LIST;
      if (typeof window !== 'undefined' && window.masterList) return window.masterList;
      return null;
    },

    async initMasterList() {
      const ml = this.getMasterList();
      if (!ml) return;

      try {
        await ml.load();
        await this.syncWordStatesToMasterList();
        this.updateMasterCount();

        // Optional sync from Neon DB if available
        const neon = this.getNeonClient();
        if (neon) {
          neon.getMasterItems().then((items) => {
            if (Array.isArray(items) && items.length > 0) {
              items.forEach((item) => {
                ml.addOrAccumulate({
                  text: item.text,
                  type: item.type,
                  pos: item.pos,
                  meanings: item.knownMeanings || item.known_meanings || []
                });
              });
              this.updateMasterCount();
              if (this.activeView === 'master') this.renderMasterList();
            }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('[FX MasterList] Init notice:', e);
      }
    },

    async syncWordStatesToMasterList() {
      const ml = this.getMasterList();
      if (!ml) return;

      let changed = false;
      for (const [rawKey, state] of Object.entries(this.wordStates || {})) {
        if (state && state.mastered) {
          const cleanKey = rawKey.trim().toLowerCase();
          if (!ml.has(cleanKey)) {
            let meaning = '';
            let pos = 'N';
            let type = cleanKey.includes(' ') ? 'sentence' : 'word';
            if (this.analysis?.allWords) {
              const found = this.analysis.allWords.find((w) => (w.word || '').toLowerCase() === cleanKey);
              if (found) {
                meaning = (found.vietnamese || found.translation || '').trim();
                pos = found.pos || 'N';
              }
            }
            await ml.addOrAccumulate({
              text: cleanKey,
              type,
              pos,
              meanings: (meaning && meaning !== 'Đang tra nghĩa...' && meaning !== 'Đang cập nhật') ? [meaning] : ['Đã thuộc']
            });
            changed = true;
          }
        }
      }

      if (changed) {
        this.updateMasterCount();
        if (this.activeView === 'master') {
          this.renderMasterList();
        }
      }
    },

    switchView(viewName) {
      this.activeView = viewName;
      const isStudio = (viewName === 'studio');

      if (this.navTabStudio) this.navTabStudio.classList.toggle('active', isStudio);
      if (this.navTabMaster) this.navTabMaster.classList.toggle('active', !isStudio);

      if (this.studioView) this.studioView.style.display = isStudio ? 'block' : 'none';
      if (this.masterView) this.masterView.style.display = isStudio ? 'none' : 'block';

      // Hide movie-specific action buttons from the top navbar when in Master view
      if (this.btnToggleFlashcards) {
        this.btnToggleFlashcards.style.display = (isStudio && this.analysis) ? 'inline-flex' : 'none';
      }
      if (this.btnExportAnkiTop) {
        this.btnExportAnkiTop.style.display = (isStudio && this.analysis) ? 'inline-flex' : 'none';
      }
      if (this.btnExportCsvTop) {
        this.btnExportCsvTop.style.display = (isStudio && this.analysis) ? 'inline-flex' : 'none';
      }

      if (!isStudio) {
        this.syncWordStatesToMasterList();
        this.renderMasterList();
      }
    },

    updateMasterCount() {
      const ml = this.getMasterList();
      const allItems = ml ? ml.getAll() : [];
      const totalCount = allItems.length;

      if (this.navMasterCount) {
        this.navMasterCount.textContent = totalCount.toLocaleString();
      }

      if (this.masterCountAll) {
        this.masterCountAll.textContent = totalCount.toLocaleString();
      }

      if (this.masterCountWord) {
        const words = allItems.filter(i => i.type === 'word').length;
        this.masterCountWord.textContent = words.toLocaleString();
      }

      if (this.masterCountSentence) {
        const sentences = allItems.filter(i => i.type === 'sentence').length;
        this.masterCountSentence.textContent = sentences.toLocaleString();
      }

      if (this.masterCountPolysemy) {
        const polysemy = allItems.filter(i => Array.isArray(i.knownMeanings) && i.knownMeanings.length > 1).length;
        this.masterCountPolysemy.textContent = polysemy.toLocaleString();
      }
    },

    renderMasterList() {
      if (!this.masterGridEl) return;
      const ml = this.getMasterList();
      if (!ml) return;

      if (this.masterTabsGroup) {
        this.masterTabsGroup.querySelectorAll('.fx-tab-btn').forEach((btn) => {
          btn.classList.toggle('active', (btn.dataset.type || 'all') === this.activeMasterFilter);
        });
      }

      const items = ml.search(this.masterSearchQuery, this.activeMasterFilter);
      this.masterGridEl.innerHTML = '';

      if (items.length === 0) {
        if (this.masterEmptyEl) {
          this.masterEmptyEl.style.display = 'block';
          if (this.masterSearchQuery) {
            this.masterEmptyEl.innerHTML = `<p>Không tìm thấy từ hoặc câu nào khớp với từ khóa "${this.escape(this.masterSearchQuery)}".</p>`;
          } else {
            this.masterEmptyEl.innerHTML = `<p>Chưa có mục nào trong danh mục này. Khi bạn bấm đánh dấu dấu tích (Đã biết) trên bất kỳ thẻ từ vựng nào, từ đó cùng ngữ nghĩa phim sẽ tự động lưu vào đây.</p>`;
          }
        }
        return;
      }

      if (this.masterEmptyEl) this.masterEmptyEl.style.display = 'none';

      items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'fx-master-item-card';

        const meanings = Array.isArray(item.knownMeanings) ? item.knownMeanings : [];
        const isPolysemy = meanings.length > 1;

        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '';
        const posCode = item.pos || (item.type === 'sentence' ? 'Idiom' : 'N');

        const meaningsHtml = meanings.map((m) => `
          <div class="fx-meaning-pill">
            <span>${this.escape(m)}</span>
            <button type="button" class="fx-btn-remove-meaning" title="Xóa nghĩa này" data-text="${this.escape(item.text)}" data-meaning="${this.escape(m)}">&times;</button>
          </div>
        `).join('');

        card.innerHTML = `
          <div class="fx-master-card-top">
            <div class="fx-master-card-title-group">
              <span class="fx-master-card-text">${this.escape(item.text)}</span>
              <span class="fx-badge-pos">${this.escape(posCode)}</span>
            </div>
            <button type="button" class="fx-btn-icon-raw fx-btn-delete-master" title="Xóa khỏi Master List" data-id="${this.escape(item.id)}" data-text="${this.escape(item.text)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>

          <div class="fx-master-card-meanings">
            ${meaningsHtml}
            <button type="button" class="fx-btn-add-meaning-inline" data-text="${this.escape(item.text)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Thêm nghĩa</span>
            </button>
          </div>

          <div class="fx-master-card-meta">
            <span>Đã thêm: ${this.escape(dateStr || 'Gần đây')}</span>
            ${isPolysemy ? `<span style="color: #A1A1AA; font-weight: 500;">Đa nghĩa (${meanings.length} nghĩa)</span>` : ''}
          </div>
        `;

        // Bind delete item
        const btnDelete = card.querySelector('.fx-btn-delete-master');
        if (btnDelete) {
          btnDelete.onclick = (e) => {
            e.stopPropagation();
            this.removeMasterItem(item.text);
          };
        }

        // Bind remove meaning buttons
        card.querySelectorAll('.fx-btn-remove-meaning').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const text = btn.dataset.text;
            const meaning = btn.dataset.meaning;
            this.removeMeaningFromItem(text, meaning);
          };
        });

        // Bind inline add meaning button
        const btnAddMeaning = card.querySelector('.fx-btn-add-meaning-inline');
        if (btnAddMeaning) {
          btnAddMeaning.onclick = (e) => {
            e.stopPropagation();
            this.addMeaningInline(item.text);
          };
        }

        this.masterGridEl.appendChild(card);
      });
    },

    openAddMasterModal(initialText = '') {
      if (!this.addMasterModal) return;
      if (this.inputMasterText) this.inputMasterText.value = initialText;
      if (this.inputMasterMeanings) this.inputMasterMeanings.value = '';
      if (this.addMasterStatus) this.addMasterStatus.style.display = 'none';
      this.addMasterModal.style.display = 'flex';
      setTimeout(() => {
        if (initialText && this.inputMasterMeanings) {
          this.inputMasterMeanings.focus();
        } else if (this.inputMasterText) {
          this.inputMasterText.focus();
        }
      }, 50);
    },

    closeAddMasterModal() {
      if (this.addMasterModal) this.addMasterModal.style.display = 'none';
    },

    showAddMasterStatus(type, msg) {
      if (!this.addMasterStatus) return;
      this.addMasterStatus.className = `fx-settings-status ${type}`;
      this.addMasterStatus.textContent = msg;
      this.addMasterStatus.style.display = 'block';
    },

    async submitAddMaster() {
      const text = (this.inputMasterText?.value || '').trim();
      const pos = (this.selectMasterPos?.value || 'N').trim();
      const rawMeanings = (this.inputMasterMeanings?.value || '').trim();

      if (!text) {
        this.showAddMasterStatus('error', 'Vui lòng nhập từ vựng hoặc câu tiếng Anh.');
        return;
      }

      const meanings = rawMeanings
        ? rawMeanings.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Đã thuộc'];

      const ml = this.getMasterList();
      if (!ml) return;

      this.showAddMasterStatus('loading', 'Đang lưu vào Master List...');

      try {
        const type = text.includes(' ') ? 'sentence' : 'word';
        const res = await ml.addOrAccumulate({ text, type, pos, meanings });

        // Update wordStates locally
        const cleanKey = text.toLowerCase();
        if (!this.wordStates[cleanKey]) {
          this.wordStates[cleanKey] = { starred: false, mastered: true, updatedAt: Date.now() };
        } else {
          this.wordStates[cleanKey].mastered = true;
          this.wordStates[cleanKey].updatedAt = Date.now();
        }
        this.saveWordStates();

        // Neon DB background sync
        const neon = this.getNeonClient();
        if (neon && res?.item) {
          neon.saveMasterItem(res.item).catch((err) => console.warn('[FX Neon] saveMasterItem notice:', err));
        }

        this.showAddMasterStatus('success', `Đã lưu "${text}" vào Master List.`);
        this.updateMasterCount();
        this.updateStats();

        setTimeout(() => {
          this.closeAddMasterModal();
          this.renderMasterList();
          if (this.analysis) this.renderVocabularyGrid();
        }, 600);
      } catch (err) {
        this.showAddMasterStatus('error', err.message || 'Lỗi lưu vào Master List.');
      }
    },

    async removeMasterItem(text) {
      if (!text) return;
      const clean = text.trim().toLowerCase();
      if (!confirm(`Bạn có chắc muốn xóa "${clean}" khỏi Master List?`)) return;

      const ml = this.getMasterList();
      if (ml) {
        await ml.remove(clean);
      }

      if (this.wordStates[clean]) {
        this.wordStates[clean].mastered = false;
        this.saveWordStates();
      }

      const neon = this.getNeonClient();
      if (neon) {
        neon.deleteMasterItem(clean).catch(() => {});
      }

      this.updateMasterCount();
      this.updateStats();
      this.renderMasterList();
      if (this.analysis) this.renderVocabularyGrid();
    },

    async removeMeaningFromItem(text, meaning) {
      if (!text || !meaning) return;
      const ml = this.getMasterList();
      if (!ml) return;

      await ml.removeMeaning(text, meaning);

      const neon = this.getNeonClient();
      if (neon) {
        const updatedItem = ml.get(text);
        if (updatedItem) neon.saveMasterItem(updatedItem).catch(() => {});
      }

      this.updateMasterCount();
      this.renderMasterList();
    },

    async addMeaningInline(text) {
      if (!text) return;
      const newMeaning = prompt(`Nhập nghĩa tiếng Việt mới cho từ "${text}":`);
      if (!newMeaning || !newMeaning.trim()) return;

      const ml = this.getMasterList();
      if (!ml) return;

      const res = await ml.addOrAccumulate({
        text,
        meanings: [newMeaning.trim()]
      });

      const neon = this.getNeonClient();
      if (neon && res?.item) {
        neon.saveMasterItem(res.item).catch(() => {});
      }

      this.updateMasterCount();
      this.renderMasterList();
    },

    async clearMasterList() {
      if (!confirm('Bạn có chắc muốn xóa TOÀN BỘ Master Known List?')) return;

      const ml = this.getMasterList();
      if (ml) {
        await ml.clear();
      }

      // Clear mastered in wordStates
      Object.keys(this.wordStates).forEach((k) => {
        this.wordStates[k].mastered = false;
      });
      this.saveWordStates();

      this.updateMasterCount();
      this.updateStats();
      this.renderMasterList();
      if (this.analysis) this.renderVocabularyGrid();
    },

    exportMasterAnki() {
      const ml = this.getMasterList();
      if (!ml) return;
      const content = ml.exportToAnki();
      if (!content) {
        alert('Master List hiện đang trống, chưa có từ vựng nào để xuất.');
        return;
      }
      this.downloadBlob(content, 'fx_master_known_list_anki.txt', 'text/plain;charset=utf-8;');
    },

    exportMasterCsv() {
      const ml = this.getMasterList();
      if (!ml) return;
      const content = ml.exportToCsv();
      if (!content) {
        alert('Master List hiện đang trống, chưa có từ vựng nào để xuất.');
        return;
      }
      this.downloadBlob(content, 'fx_master_known_list.csv', 'text/csv;charset=utf-8;');
    }
  };

  document.addEventListener('DOMContentLoaded', () => Studio.init());
})();
