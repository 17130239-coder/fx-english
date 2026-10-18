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
    masterCefrFilter: 'all',
    masterSearchQuery: '',
    activeView: 'studio',

    // Flashcard State
    flashcardList: [],
    currentCardIdx: 0,
    isCardFlipped: false,

    init() {
      this.bindElements();
      this.bindEvents();
      this.initServices();
      this.loadWordStates();
      this.initMasterList();
      this.loadHistory();
      this.checkPendingStorage();
      this.detectActiveMedia();
    },

    initServices() {
      if (typeof APP_FLASHCARD_CONTROLLER !== 'undefined' && APP_FLASHCARD_CONTROLLER) {
        APP_FLASHCARD_CONTROLLER.init({
          store: typeof APP_STUDIO_STATE !== 'undefined' ? APP_STUDIO_STATE : null,
          audioService: typeof APP_AUDIO_SERVICE !== 'undefined' ? APP_AUDIO_SERVICE : null,
          onToggleMaster: (key, item, isMastered) => this.toggleMastered(key, item, isMastered),
          showToast: (msg, type) => this.showToast(msg, type)
        });
      }
    },

    bindElements() {
      // History elements
      this.historySection = document.getElementById('fx-history-section');
      this.historyCountEl = document.getElementById('fx-history-count');
      this.historyEmptyEl = document.getElementById('fx-history-empty');
      this.historyGridEl = document.getElementById('fx-history-grid');
      this.btnClearHistory = document.getElementById('fx-btn-clear-history');
      this.btnCloudSync = document.getElementById('fx-btn-cloud-sync');
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
      this.cefrDistSection = document.getElementById('fx-cefr-dist-section');
      this.cefrDistStats = document.getElementById('fx-cefr-dist-stats');
      this.cefrSegA1 = document.getElementById('fx-cefr-seg-a1');
      this.cefrSegA2 = document.getElementById('fx-cefr-seg-a2');
      this.cefrSegB1 = document.getElementById('fx-cefr-seg-b1');
      this.cefrSegB2 = document.getElementById('fx-cefr-seg-b2');
      this.cefrSegC1C2 = document.getElementById('fx-cefr-seg-c1c2');
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
      this.fcSrsBar = document.getElementById('fx-fc-srs-bar');

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

      this.masterCefrDistSection = document.getElementById('fx-master-cefr-dist-section');
      this.masterCefrDistStats = document.getElementById('fx-master-cefr-dist-stats');
      this.masterCefrSegA1 = document.getElementById('fx-master-cefr-seg-a1');
      this.masterCefrSegA2 = document.getElementById('fx-master-cefr-seg-a2');
      this.masterCefrSegB1 = document.getElementById('fx-master-cefr-seg-b1');
      this.masterCefrSegB2 = document.getElementById('fx-master-cefr-seg-b2');
      this.masterCefrSegC1C2 = document.getElementById('fx-master-cefr-seg-c1c2');

      this.masterTabsGroup = document.getElementById('fx-master-tabs');
      this.masterCountAll = document.getElementById('fx-master-count-all');
      this.masterCountNoun = document.getElementById('fx-master-count-noun');
      this.masterCountVerb = document.getElementById('fx-master-count-verb');
      this.masterCountAdj = document.getElementById('fx-master-count-adj');
      this.masterCountAdv = document.getElementById('fx-master-count-adv');
      this.masterCountSentences = document.getElementById('fx-master-count-sentences');
      this.masterCountPolysemy = document.getElementById('fx-master-count-polysemy');
      this.masterCountStarred = document.getElementById('fx-master-count-starred');
      this.masterFilterCefr = document.getElementById('fx-master-filter-cefr');
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

      // Confirmation & Prompt Modal
      this.confirmModal = document.getElementById('fx-confirm-modal');
      this.confirmBackdrop = document.getElementById('fx-confirm-backdrop');
      this.confirmTitle = document.getElementById('fx-confirm-title');
      this.confirmSubtitle = document.getElementById('fx-confirm-subtitle');
      this.confirmClose = document.getElementById('fx-confirm-close');
      this.confirmMessage = document.getElementById('fx-confirm-message');
      this.confirmInputWrap = document.getElementById('fx-confirm-input-wrap');
      this.confirmInputLabel = document.getElementById('fx-confirm-input-label');
      this.confirmInput = document.getElementById('fx-confirm-input');
      this.btnConfirmCancel = document.getElementById('fx-btn-confirm-cancel');
      this.btnConfirmOk = document.getElementById('fx-btn-confirm-ok');
      this.toastContainer = document.getElementById('fx-toast-container');
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
      this.btnExportAnkiTop.addEventListener('click', () => {
        if (this.activeView === 'master') {
          this.exportMasterAnki();
        } else {
          this.exportAnki();
        }
      });
      this.btnExportCsvTop.addEventListener('click', () => {
        if (this.activeView === 'master') {
          this.exportMasterCsv();
        } else {
          this.exportCsv();
        }
      });

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

      // Sync All to Cloud Button
      if (this.btnCloudSync) {
        this.btnCloudSync.addEventListener('click', () => this.syncAllToCloud());
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
            this.activeMasterFilter = btn.dataset.pos || btn.dataset.type || 'all';
            this.renderMasterList();
          });
        });
      }

      // Master List CEFR Filter
      if (this.masterFilterCefr) {
        this.masterFilterCefr.addEventListener('change', (e) => {
          this.masterCefrFilter = e.target.value;
          this.renderMasterList();
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

      // Unified Event Delegation on Cards Grid (Performance & Clean Code)
      if (this.cardsGrid) {
        this.cardsGrid.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;
          e.stopPropagation();
          const action = btn.dataset.action;

          if (action === 'star') {
            const word = btn.dataset.word;
            const sent = btn.dataset.sentence;
            this.toggleStar(word || sent);
          } else if (action === 'master') {
            const word = btn.dataset.word;
            this.toggleMastered(word);
          } else if (action === 'speak') {
            const text = btn.dataset.text;
            if (text) this.speakWord(text);
          } else if (action === 'copy') {
            const text = btn.dataset.text;
            if (text) {
              navigator.clipboard.writeText(text).then(() => {
                const iconCopy = btn.querySelector('.fx-icon-copy');
                const iconCopied = btn.querySelector('.fx-icon-copied');
                if (iconCopy && iconCopied) {
                  iconCopy.style.display = 'none';
                  iconCopied.style.display = 'inline-block';
                  setTimeout(() => {
                    iconCopy.style.display = 'inline-block';
                    iconCopied.style.display = 'none';
                  }, 1500);
                }
              }).catch(() => {});
            }
          } else if (action === 'jump') {
            const sec = parseFloat(btn.dataset.sec) || 0;
            const url = btn.dataset.url || '';
            this.jumpToVideoTimestamp(sec, url);
          }
        });
      }

      // Flashcard SRS Rating Buttons
      if (this.fcSrsBar) {
        this.fcSrsBar.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-srs]');
          if (btn) {
            e.stopPropagation();
            const rating = parseInt(btn.dataset.srs, 10);
            this.rateCardSrs(rating);
          }
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

        // SRS Rating shortcuts when card is flipped (1: Again, 2: Hard, 3: Good, 4: Easy)
        if (this.isCardFlipped && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
          e.preventDefault();
          this.rateCardSrs(parseInt(e.key, 10));
          return;
        }

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
          this.showToast('Không tìm thấy câu phụ đề nào trong video này.', 'warning');
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
                  this.showToast(err, 'error');
                }
              });
            }, 400);
          }).catch(() => {
            this.btnLoadDetected.disabled = false;
            this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
            this.showToast('Không thể kết nối với tab video. Hãy tải lại tab video đó rồi bấm Phân tích.', 'warning');
          });
          return;
        }

        this.btnLoadDetected.disabled = false;
        this.btnLoadDetected.innerHTML = '<span>Phân tích</span>';
        this.showToast(res?.error || chrome.runtime.lastError?.message || 'Không thể tải phụ đề từ tab phim. Hãy đảm bảo video đã bật CC.', 'error');
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
        this.showToast('Vui lòng nhập hoặc dán nội dung phụ đề trước.', 'warning');
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
        this.showToast('Chưa có dữ liệu phụ đề để phân tích.', 'warning');
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
          this.showToast('Lỗi gọi 9Router AI: ' + (err.message || 'Lỗi mạng') + '. Đang chuyển sang bộ tách từ ngoại tuyến.', 'warning', 5000);
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
          this.showToast('Không tìm thấy VocabAnalyzer.', 'error');
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
        apiKey: '',
        model: 'ag/gemini-3.8-flash-low'
      };

      if (this.inputAiBaseUrl) this.inputAiBaseUrl.value = conf.baseUrl || 'http://localhost:20128/v1';
      if (this.inputAiApiKey) this.inputAiApiKey.value = conf.apiKey || '';
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
      const apiKey = (this.inputAiApiKey?.value || '').trim();
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
          let ipa = '';
          let cefr = '';
          let context = '';

          if (itemData) {
            meaning = (itemData.vietnamese || itemData.translation || '').trim();
            pos = itemData.pos || 'N';
            ipa = itemData.ipa || '';
            cefr = itemData.cefr || '';
            context = itemData.contexts?.[0]?.text || itemData.contextSentence || itemData.sentence || '';
            if (itemData.sentence) type = 'sentence';
          } else if (this.analysis?.allWords) {
            const found = this.analysis.allWords.find((w) => (w.word || '').toLowerCase() === cleanKey);
            if (found) {
              meaning = (found.vietnamese || found.translation || '').trim();
              pos = found.pos || 'N';
              ipa = found.ipa || '';
              cefr = found.cefr || '';
              context = found.contexts?.[0]?.text || '';
            }
          }

          const res = await ml.addOrAccumulate({
            text: cleanKey,
            type,
            pos,
            meanings: (meaning && meaning !== 'Đang tra nghĩa...' && meaning !== 'Đang cập nhật') ? [meaning] : ['Đã thuộc'],
            ipa,
            cefr,
            context
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

      // Compute CEFR Distribution for Visual Stacked Bar
      if (this.cefrDistSection && allWords && allWords.length > 0) {
        let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1c2 = 0;
        allWords.forEach((w) => {
          const c = String(w.cefr || '').toUpperCase().trim();
          if (c === 'A1') a1++;
          else if (c === 'A2') a2++;
          else if (c === 'B1') b1++;
          else if (c === 'B2') b2++;
          else if (c === 'C1' || c === 'C2') c1c2++;
          else a1++;
        });

        const total = allWords.length || 1;
        const pA1 = Math.round((a1 / total) * 100);
        const pA2 = Math.round((a2 / total) * 100);
        const pB1 = Math.round((b1 / total) * 100);
        const pB2 = Math.round((b2 / total) * 100);
        const pC1C2 = Math.max(0, 100 - (pA1 + pA2 + pB1 + pB2));

        if (this.cefrSegA1) this.cefrSegA1.style.width = `${pA1}%`;
        if (this.cefrSegA2) this.cefrSegA2.style.width = `${pA2}%`;
        if (this.cefrSegB1) this.cefrSegB1.style.width = `${pB1}%`;
        if (this.cefrSegB2) this.cefrSegB2.style.width = `${pB2}%`;
        if (this.cefrSegC1C2) this.cefrSegC1C2.style.width = `${pC1C2}%`;

        if (this.cefrDistStats) {
          this.cefrDistStats.textContent = `A1: ${pA1}% · A2: ${pA2}% · B1: ${pB1}% · B2: ${pB2}% · C1/C2: ${pC1C2}%`;
        }
        this.cefrDistSection.style.display = 'flex';
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
                ${item.startTime ? `<span class="fx-card-time fx-jump-link" data-action="jump" data-sec="${item.startSec || 0}" data-url="${this.escape(videoUrl)}" title="Nhảy đến phân cảnh phim">${this.escape(item.startTime)}</span>` : ''}
              </div>
              <div class="fx-sent-actions">
                <button type="button" class="fx-btn-icon-raw fx-btn-star ${isSentStarred ? 'active' : ''}" data-action="star" data-sentence="${this.escape(item.sentence)}" title="${isSentStarred ? 'Bỏ lưu' : 'Lưu câu'}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="${isSentStarred ? '#F4F4F6' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                <button type="button" class="fx-btn-icon-raw fx-btn-speak" data-action="speak" data-text="${this.escape(item.sentence)}" title="Phát âm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                </button>
                <button type="button" class="fx-btn-icon-raw fx-btn-copy" data-action="copy" data-text="${this.escape(item.sentence)}" title="Sao chép">
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
              <button type="button" class="fx-btn-icon-raw fx-btn-star ${isStarred ? 'active' : ''}" data-action="star" data-word="${this.escape(item.word)}" title="${isStarred ? 'Bỏ lưu yêu thích' : 'Lưu từ yêu thích'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? '#F4F4F6' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button type="button" class="fx-btn-icon-raw fx-btn-check ${isMastered ? 'active' : ''}" data-action="master" data-word="${this.escape(item.word)}" title="${isMastered ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isMastered ? '#10B981' : 'currentColor'}" stroke-width="${isMastered ? '2' : '1.5'}" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dòng 2: Phiên âm IPA + icon loa mảnh (bỏ viền xám) + Nghĩa tiếng Việt rõ ràng -->
          <div class="fx-card-line-2">
            ${item.ipa ? `<span class="fx-card-ipa">${this.escape(item.ipa)}</span>` : ''}
            <button type="button" class="fx-btn-icon-raw fx-btn-audio" data-action="speak" data-text="${this.escape(item.word)}" title="Phát âm">
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
              ${startTimeStr ? `<span class="fx-card-time fx-jump-link" data-action="jump" data-sec="${startSec}" data-url="${this.escape(videoUrl)}" title="Nhảy đến phân cảnh phim">${this.escape(startTimeStr)}</span>` : ''}
            </div>
          ` : ''}
        `;

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
      if (typeof APP_AUDIO_SERVICE !== 'undefined' && APP_AUDIO_SERVICE) {
        APP_AUDIO_SERVICE.speak(word);
        return;
      }
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    },

    // 3D Flashcards Implementation
    openFlashcards() {
      let words = [];
      if (this.activeView === 'master') {
        const ml = this.getMasterList();
        const allItems = ml ? ml.getAll() : [];
        words = allItems.map((item) => ({
          word: item.text,
          ipa: item.ipa || '',
          pos: item.pos || 'noun',
          cefr: item.cefr || '',
          vietnamese: Array.isArray(item.knownMeanings) ? item.knownMeanings.join(', ') : (item.knownMeanings || ''),
          contexts: item.context ? [{ text: item.context }] : []
        }));
      } else {
        words = this.getFilteredWords();
      }

      if (words.length === 0) {
        this.showToast('Không có từ vựng hoặc câu giao tiếp nào để tạo thẻ ghi nhớ.', 'info');
        return;
      }

      if (typeof APP_FLASHCARD_CONTROLLER !== 'undefined' && APP_FLASHCARD_CONTROLLER) {
        APP_FLASHCARD_CONTROLLER.open(words);
        return;
      }

      this.flashcardList = words;
      this.currentCardIdx = 0;
      this.isCardFlipped = false;
      this.renderFlashcard();
      this.fcModal.style.display = 'flex';
    },

    closeFlashcards() {
      if (typeof APP_FLASHCARD_CONTROLLER !== 'undefined' && APP_FLASHCARD_CONTROLLER) {
        APP_FLASHCARD_CONTROLLER.close();
        return;
      }
      this.fcModal.style.display = 'none';
    },

    flipFlashcard() {
      this.isCardFlipped = !this.isCardFlipped;
      if (this.isCardFlipped) {
        this.fcCard.classList.add('is-flipped');
        if (this.fcSrsBar) this.fcSrsBar.style.display = 'flex';
      } else {
        this.fcCard.classList.remove('is-flipped');
        if (this.fcSrsBar) this.fcSrsBar.style.display = 'none';
      }
    },

    prevFlashcard() {
      if (this.currentCardIdx > 0) {
        this.currentCardIdx--;
        this.isCardFlipped = false;
        this.fcCard.classList.remove('is-flipped');
        if (this.fcSrsBar) this.fcSrsBar.style.display = 'none';
        this.renderFlashcard();
      }
    },

    nextFlashcard() {
      if (this.currentCardIdx < this.flashcardList.length - 1) {
        this.currentCardIdx++;
        this.isCardFlipped = false;
        this.fcCard.classList.remove('is-flipped');
        if (this.fcSrsBar) this.fcSrsBar.style.display = 'none';
        this.renderFlashcard();
      }
    },

    rateCardSrs(rating) {
      const item = this.flashcardList[this.currentCardIdx];
      if (!item) return;

      const key = (item.word || item.sentence || '').toLowerCase().trim();
      if (!key) return;

      if (!this.wordStates[key]) {
        this.wordStates[key] = { starred: false, mastered: false, srsLevel: 0, updatedAt: Date.now() };
      }

      const now = Date.now();
      let nextReview = now;
      let curLevel = this.wordStates[key].srsLevel || 0;

      if (rating === 1) {
        // Again: 1 minute
        nextReview += 60 * 1000;
        this.wordStates[key].srsLevel = 0;
      } else if (rating === 2) {
        // Hard: 10 minutes
        nextReview += 10 * 60 * 1000;
        this.wordStates[key].srsLevel = curLevel;
      } else if (rating === 3) {
        // Good: 1 day
        nextReview += 24 * 60 * 60 * 1000;
        this.wordStates[key].srsLevel = curLevel + 1;
      } else if (rating === 4) {
        // Easy: 4 days (Auto mark mastered)
        nextReview += 4 * 24 * 60 * 60 * 1000;
        this.wordStates[key].srsLevel = curLevel + 2;
        this.toggleMastered(key, item);
      }

      this.wordStates[key].nextReview = nextReview;
      this.wordStates[key].updatedAt = now;
      this.saveWordStates();

      // Automatically advance to the next card if available, or notify completion
      if (this.currentCardIdx < this.flashcardList.length - 1) {
        this.nextFlashcard();
      } else {
        this.isCardFlipped = false;
        this.fcCard.classList.remove('is-flipped');
        if (this.fcSrsBar) this.fcSrsBar.style.display = 'none';
        this.showToast('Chúc mừng! Bạn đã hoàn thành lượt ôn tập tất cả các thẻ từ này.', 'success');
        this.closeFlashcards();
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
        this.showToast('Không có từ vựng nào để xuất.', 'info');
        return;
      }

      if (typeof APP_EXPORT_SERVICE !== 'undefined' && APP_EXPORT_SERVICE) {
        APP_EXPORT_SERVICE.exportToAnki(words, this.movieTitle);
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
        this.showToast('Không có từ vựng nào để xuất.', 'info');
        return;
      }

      if (typeof APP_EXPORT_SERVICE !== 'undefined' && APP_EXPORT_SERVICE) {
        APP_EXPORT_SERVICE.exportToCsv(words, this.movieTitle);
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

        // Background sync: push any local-only movie up to Neon Cloud so Webapp and Cloud have full data
        localHistory.forEach((loc) => {
          const existsInCloud = cloudMovies.some((c) => (c.url && loc.url && c.url.trim() === loc.url.trim()) || c.id === loc.id);
          if (!existsInCloud) {
            neon.saveMovie(loc).catch((err) => console.warn('[FX Neon] Auto-sync to Neon notice:', err));
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

    async openHistoryItem(item) {
      if (!item) return;

      this.movieTitle = item.title || 'fx_vocab';
      this.movieUrl = item.url || '';
      this.cues = item.cues || [];

      // Lazy-load complete analysis and cues on-demand from Neon if only lightweight metadata was fetched
      if ((!item.analysis || !item.cues || item.cues.length === 0) && item.id) {
        const neon = this.getNeonClient();
        if (neon) {
          try {
            const fullItem = await neon.getMovieById(item.id);
            if (fullItem) {
              item.cues = fullItem.cues || [];
              item.analysis = fullItem.analysis || null;
              this.cues = item.cues;
            }
          } catch (e) {
            console.warn('[FX Studio] Failed to fetch full movie details on-demand:', e);
          }
        }
      }

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
      if (!id) return;

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

      // 2. Delete from Neon Cloud Database
      const neon = this.getNeonClient();
      if (neon) {
        try {
          await neon.deleteMovie(id);
          this.showToast('Đã xóa phim khỏi lịch sử', 'info');
        } catch (err) {
          console.warn('[FX Neon] Cloud delete warning:', err);
        }
      }
    },

    async clearAllHistory() {
      const ok = await this.showConfirm({
        title: 'Xóa lịch sử quét',
        subtitle: 'Bao gồm dữ liệu trên trình duyệt và Neon PostgreSQL',
        message: 'Bạn có chắc muốn xóa toàn bộ lịch sử các phim đã quét (cả trên trình duyệt và Neon DB)? Thao tác này không thể hoàn tác.',
        confirmText: 'Xóa toàn bộ',
        cancelText: 'Hủy',
        isDanger: true
      });
      if (!ok) return;

      // 1. Clear local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['fxScanHistory'], () => {
          this.renderHistoryList([]);
        });
      }

      // 2. Clear Neon
      const neon = this.getNeonClient();
      if (neon) {
        try {
          await neon.clearAllMovies();
          this.showToast('Đã xóa sạch lịch sử quét', 'info');
        } catch (err) {
          console.warn('[FX Neon] Cloud clear warning:', err);
        }
      }
    },

    async syncAllToCloud() {
      const neon = this.getNeonClient();
      if (!neon) {
        this.showToast('Không tìm thấy Neon Client.', 'error');
        return;
      }

      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        this.showToast('Không tìm thấy bộ nhớ cục bộ tiện ích.', 'warning');
        return;
      }

      this.setNeonSyncStatus('syncing', 'Đang đồng bộ...');
      this.showToast('Đang đồng bộ toàn bộ phim sang Neon Cloud & Webapp...', 'info');

      chrome.storage.local.get(['fxScanHistory'], async (res) => {
        const history = (res && Array.isArray(res.fxScanHistory)) ? res.fxScanHistory : [];
        if (history.length === 0) {
          this.showToast('Không có phim nào trong bộ nhớ để đồng bộ.', 'info');
          this.setNeonSyncStatus('synced', 'Neon DB');
          return;
        }

        let syncedCount = 0;
        for (const item of history) {
          try {
            await neon.saveMovie(item);
            syncedCount++;
          } catch (e) {
            console.warn('[FX Neon] Sync item error:', item.title, e);
          }
        }

        this.setNeonSyncStatus('synced', 'Neon DB (Đã đồng bộ)');
        if (syncedCount > 0) {
          this.showToast(`Đã đồng bộ thành công ${syncedCount} bộ phim sang Neon Cloud & Webapp!`, 'success', 4500);
        } else {
          this.showToast('Không thể đồng bộ phim lên Cloud. Vui lòng kiểm tra mạng.', 'error');
        }
      });
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
            let ipa = '';
            let cefr = '';
            let context = '';
            if (this.analysis?.allWords) {
              const found = this.analysis.allWords.find((w) => (w.word || '').toLowerCase() === cleanKey);
              if (found) {
                meaning = (found.vietnamese || found.translation || '').trim();
                pos = found.pos || 'N';
                ipa = found.ipa || '';
                cefr = found.cefr || '';
                context = found.contexts?.[0]?.text || '';
              }
            }
            await ml.addOrAccumulate({
              text: cleanKey,
              type,
              pos,
              meanings: (meaning && meaning !== 'Đang tra nghĩa...' && meaning !== 'Đang cập nhật') ? [meaning] : ['Đã thuộc'],
              ipa,
              cefr,
              context
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

      const ml = this.getMasterList();
      const hasMasterItems = Boolean(ml && ml.getAll().length > 0);

      // Top navbar buttons: Flashcards, Anki, CSV
      if (this.btnToggleFlashcards) {
        this.btnToggleFlashcards.style.display = (isStudio ? Boolean(this.analysis) : hasMasterItems) ? 'inline-flex' : 'none';
      }
      if (this.btnExportAnkiTop) {
        this.btnExportAnkiTop.style.display = (isStudio ? Boolean(this.analysis) : hasMasterItems) ? 'inline-flex' : 'none';
      }
      if (this.btnExportCsvTop) {
        this.btnExportCsvTop.style.display = (isStudio ? Boolean(this.analysis) : hasMasterItems) ? 'inline-flex' : 'none';
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

      const getPos = (item) => {
        let p = item.pos || (item.type === 'sentence' ? 'Idiom' : 'N');
        if ((!p || p === 'N') && typeof APP_CEFR_DICT !== 'undefined') {
          const d = APP_CEFR_DICT.lookup(item.text);
          if (d && d.pos) p = d.pos;
        }
        const clean = String(p).trim().toLowerCase();
        if (clean === 'n' || clean === 'noun') return 'noun';
        if (clean === 'v' || clean === 'verb') return 'verb';
        if (clean === 'adj' || clean === 'adjective') return 'adjective';
        if (clean === 'adv' || clean === 'adverb') return 'adverb';
        if (clean === 'idiom' || clean === 'phrase' || clean === 'sentences' || item.type === 'sentence') return 'sentences';
        return 'noun';
      };

      if (this.masterCountAll) this.masterCountAll.textContent = totalCount.toLocaleString();
      if (this.masterCountNoun) this.masterCountNoun.textContent = allItems.filter(i => getPos(i) === 'noun').length.toLocaleString();
      if (this.masterCountVerb) this.masterCountVerb.textContent = allItems.filter(i => getPos(i) === 'verb').length.toLocaleString();
      if (this.masterCountAdj) this.masterCountAdj.textContent = allItems.filter(i => getPos(i) === 'adjective').length.toLocaleString();
      if (this.masterCountAdv) this.masterCountAdv.textContent = allItems.filter(i => getPos(i) === 'adverb').length.toLocaleString();
      if (this.masterCountSentences) this.masterCountSentences.textContent = allItems.filter(i => getPos(i) === 'sentences').length.toLocaleString();
      if (this.masterCountPolysemy) this.masterCountPolysemy.textContent = allItems.filter(i => Array.isArray(i.knownMeanings) && i.knownMeanings.length > 1).length.toLocaleString();
      if (this.masterCountStarred) this.masterCountStarred.textContent = allItems.filter(i => this.isStarred(i.text)).length.toLocaleString();

      // Compute Master CEFR Distribution Bar
      if (this.masterCefrDistSection) {
        if (totalCount === 0) {
          this.masterCefrDistSection.style.display = 'none';
        } else {
          let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1c2 = 0;
          allItems.forEach((item) => {
            let c = String(item.cefr || '').toUpperCase().trim();
            if (!c && typeof APP_CEFR_DICT !== 'undefined') {
              const d = APP_CEFR_DICT.lookup(item.text);
              if (d && d.cefr) c = d.cefr.toUpperCase().trim();
            }
            if (c === 'A1') a1++;
            else if (c === 'A2') a2++;
            else if (c === 'B1') b1++;
            else if (c === 'B2') b2++;
            else if (c === 'C1' || c === 'C2') c1c2++;
            else a1++;
          });

          const total = totalCount || 1;
          const pA1 = Math.round((a1 / total) * 100);
          const pA2 = Math.round((a2 / total) * 100);
          const pB1 = Math.round((b1 / total) * 100);
          const pB2 = Math.round((b2 / total) * 100);
          const pC1C2 = Math.max(0, 100 - (pA1 + pA2 + pB1 + pB2));

          if (this.masterCefrSegA1) this.masterCefrSegA1.style.width = `${pA1}%`;
          if (this.masterCefrSegA2) this.masterCefrSegA2.style.width = `${pA2}%`;
          if (this.masterCefrSegB1) this.masterCefrSegB1.style.width = `${pB1}%`;
          if (this.masterCefrSegB2) this.masterCefrSegB2.style.width = `${pB2}%`;
          if (this.masterCefrSegC1C2) this.masterCefrSegC1C2.style.width = `${pC1C2}%`;

          if (this.masterCefrDistStats) {
            this.masterCefrDistStats.textContent = `A1: ${pA1}% · A2: ${pA2}% · B1: ${pB1}% · B2: ${pB2}% · C1/C2: ${pC1C2}%`;
          }
          this.masterCefrDistSection.style.display = 'flex';
        }
      }
    },

    renderMasterList() {
      if (!this.masterGridEl) return;
      const ml = this.getMasterList();
      if (!ml) return;

      this.updateMasterCount();

      if (this.masterTabsGroup) {
        this.masterTabsGroup.querySelectorAll('.fx-tab-btn').forEach((btn) => {
          btn.classList.toggle('active', (btn.dataset.pos || btn.dataset.type || 'all') === this.activeMasterFilter);
        });
      }

      const allItems = ml.getAll();

      const getPos = (item) => {
        let p = item.pos || (item.type === 'sentence' ? 'Idiom' : 'N');
        if ((!p || p === 'N') && typeof APP_CEFR_DICT !== 'undefined') {
          const d = APP_CEFR_DICT.lookup(item.text);
          if (d && d.pos) p = d.pos;
        }
        const clean = String(p).trim().toLowerCase();
        if (clean === 'n' || clean === 'noun') return 'noun';
        if (clean === 'v' || clean === 'verb') return 'verb';
        if (clean === 'adj' || clean === 'adjective') return 'adjective';
        if (clean === 'adv' || clean === 'adverb') return 'adverb';
        if (clean === 'idiom' || clean === 'phrase' || clean === 'sentences' || item.type === 'sentence') return 'sentences';
        return 'noun';
      };

      const getCefr = (item) => {
        let c = String(item.cefr || '').toUpperCase().trim();
        if (!c && typeof APP_CEFR_DICT !== 'undefined') {
          const d = APP_CEFR_DICT.lookup(item.text);
          if (d && d.cefr) c = d.cefr.toUpperCase().trim();
        }
        return c || 'B1';
      };

      const filtered = allItems.filter((item) => {
        // 1. Tab / POS filter
        if (this.activeMasterFilter !== 'all') {
          if (this.activeMasterFilter === 'starred') {
            if (!this.isStarred(item.text)) return false;
          } else if (this.activeMasterFilter === 'polysemy') {
            if (!item.knownMeanings || item.knownMeanings.length < 2) return false;
          } else {
            const pos = getPos(item);
            if (pos !== this.activeMasterFilter) return false;
          }
        }

        // 2. CEFR filter
        if (this.masterCefrFilter && this.masterCefrFilter !== 'all') {
          const cefr = getCefr(item);
          if (cefr !== this.masterCefrFilter.toUpperCase()) return false;
        }

        // 3. Search query
        if (this.masterSearchQuery) {
          const q = this.masterSearchQuery;
          const matchText = item.text.toLowerCase().includes(q);
          const matchMeanings = item.knownMeanings && item.knownMeanings.some(m => m.toLowerCase().includes(q));
          const matchContext = item.context && item.context.toLowerCase().includes(q);
          if (!matchText && !matchMeanings && !matchContext) return false;
        }

        return true;
      });

      this.masterGridEl.innerHTML = '';

      if (filtered.length === 0) {
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

      filtered.forEach((item) => {
        const card = document.createElement('div');
        const isStarred = this.isStarred(item.text);
        card.className = 'fx-word-card fx-card-mastered' + (isStarred ? ' fx-card-starred' : '');

        const meanings = Array.isArray(item.knownMeanings) ? item.knownMeanings : [];
        const isPolysemy = meanings.length > 1;

        let ipa = item.ipa || '';
        let cefr = getCefr(item);
        let pos = getPos(item);
        const posLabel = this.getPosLabel(pos);

        if (!ipa && typeof APP_CEFR_DICT !== 'undefined') {
          const dictMatch = APP_CEFR_DICT.lookup(item.text);
          if (dictMatch && dictMatch.ipa) ipa = dictMatch.ipa;
        }

        let contextText = item.context || '';
        if (!contextText && this.analysis?.allWords) {
          const found = this.analysis.allWords.find((w) => (w.word || '').toLowerCase() === item.text.toLowerCase());
          if (found && found.contexts?.[0]?.text) {
            contextText = found.contexts[0].text;
          }
        }
        const contextHtml = contextText ? this.highlightWordInContext(contextText, item.text) : '';

        // DÒNG 1: "Danh từ · B1" - STRICTLY NO FREQUENCY (Red circle 2: inspire 9x)
        const specsParts = [posLabel];
        if (cefr) specsParts.push(cefr);
        const specsText = specsParts.join(' · ');

        // DÒNG 2: Phiên âm IPA + loa + nghĩa tiếng Việt
        const meaningsHtml = meanings.map((m) => `
          <span class="fx-master-meaning-item">
            <span class="fx-card-trans">${this.escape(m)}</span>
            ${meanings.length > 1 ? `<button type="button" class="fx-btn-remove-meaning" title="Xóa nghĩa '${this.escape(m)}'" data-text="${this.escape(item.text)}" data-meaning="${this.escape(m)}">&times;</button>` : ''}
          </span>
        `).join('<span class="fx-card-dot-sep">·</span>');

        card.innerHTML = `
          <!-- Dòng 1: Từ vựng + Specs: Danh từ · B1 (KHÔNG có 9x) + Star + Check -->
          <div class="fx-card-line-1">
            <div class="fx-card-word-wrap">
              <span class="fx-card-word">${this.escape(item.text)}</span>
              ${isPolysemy ? `<span class="fx-badge-new-meaning" title="Từ có nhiều nghĩa đã biết">ĐA NGHĨA</span>` : ''}
            </div>
            <div class="fx-card-meta-actions">
              <span class="fx-card-specs">${specsText}</span>
              <button type="button" class="fx-btn-icon-raw fx-btn-star ${isStarred ? 'active' : ''}" title="${isStarred ? 'Bỏ lưu yêu thích' : 'Lưu từ yêu thích'}" data-word="${this.escape(item.text)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isStarred ? '#F4F4F6' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button type="button" class="fx-btn-icon-raw fx-btn-check active" title="Đã trong Master List. Nhấn để xóa khỏi Master List" data-word="${this.escape(item.text)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dòng 2: Phiên âm IPA + Loa + Nghĩa tiếng Việt -->
          <div class="fx-card-line-2">
            ${ipa ? `<span class="fx-card-ipa">${this.escape(ipa)}</span>` : ''}
            <button type="button" class="fx-btn-icon-raw fx-btn-audio" title="Phát âm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <span class="fx-card-dot-sep">·</span>
            <div class="fx-master-meanings-inline">
              ${meaningsHtml}
              <button type="button" class="fx-btn-add-meaning-mini" data-text="${this.escape(item.text)}" title="Thêm nghĩa mới cho từ này">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dòng 3: Ngữ cảnh trực tiếp trong ngoặc kép - STRICTLY NO TIMESTAMP (Red circle 3: fancy 00:00:38.799) -->
          ${contextHtml ? `
            <div class="fx-card-line-3">
              <p class="fx-card-quote">"${contextHtml}"</p>
            </div>
          ` : ''}
        `;

        card.querySelector('.fx-btn-star').onclick = (e) => {
          e.stopPropagation();
          this.toggleStar(item.text);
          this.renderMasterList();
        };

        card.querySelector('.fx-btn-check').onclick = (e) => {
          e.stopPropagation();
          this.removeMasterItem(item.text);
        };

        const audioBtn = card.querySelector('.fx-btn-audio');
        if (audioBtn) {
          audioBtn.onclick = (e) => {
            e.stopPropagation();
            this.speakWord(item.text);
          };
        }

        const addMeaningBtn = card.querySelector('.fx-btn-add-meaning-mini');
        if (addMeaningBtn) {
          addMeaningBtn.onclick = (e) => {
            e.stopPropagation();
            this.addMeaningInline(item.text);
          };
        }

        card.querySelectorAll('.fx-btn-remove-meaning').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const text = btn.dataset.text;
            const meaning = btn.dataset.meaning;
            this.removeMeaningFromItem(text, meaning);
          };
        });

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
      const ok = await this.showConfirm({
        title: 'Xóa khỏi Master List',
        message: `Bạn có chắc muốn xóa "${clean}" khỏi danh sách từ đã biết?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        isDanger: true
      });
      if (!ok) return;

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
      const newMeaning = await this.showPrompt({
        title: 'Thêm nghĩa tiếng Việt',
        message: `Nhập nghĩa tiếng Việt mới cho "${text}":`,
        label: 'Nghĩa tiếng Việt',
        placeholder: 'ví dụ: máy tính, thiết bị điện tử...',
        confirmText: 'Thêm nghĩa',
        cancelText: 'Hủy'
      });
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
      const ok = await this.showConfirm({
        title: 'Xóa toàn bộ Master List',
        subtitle: 'Đặt lại toàn bộ danh sách từ đã biết về 0',
        message: 'Bạn có chắc chắn muốn xóa TOÀN BỘ Master Known List? Thao tác này sẽ đồng bộ xóa trên Neon DB và không thể hoàn tác.',
        confirmText: 'Xóa toàn bộ',
        cancelText: 'Hủy',
        isDanger: true
      });
      if (!ok) return;

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
        this.showToast('Master List hiện đang trống, chưa có từ vựng nào để xuất.', 'info');
        return;
      }
      this.downloadBlob(content, 'fx_master_known_list_anki.txt', 'text/plain;charset=utf-8;');
    },

    exportMasterCsv() {
      const ml = this.getMasterList();
      if (!ml) return;
      const content = ml.exportToCsv();
      if (!content) {
        this.showToast('Master List hiện đang trống, chưa có từ vựng nào để xuất.', 'info');
        return;
      }
      this.downloadBlob(content, 'fx_master_known_list.csv', 'text/csv;charset=utf-8;');
    },

    /**
     * Show non-intrusive Tesla toast notification.
     * @param {string} message - Message text (strictly 0 emojis)
     * @param {'info'|'success'|'error'|'warning'} [type='info'] - Severity type
     * @param {number} [duration=3500] - Duration in ms
     */
    showToast(message, type = 'info', duration = 3500) {
      if (!this.toastContainer) {
        this.toastContainer = document.getElementById('fx-toast-container');
      }
      if (!this.toastContainer) {
        console.log(`[Toast ${type}]`, message);
        return;
      }

      const toast = document.createElement('div');
      toast.className = 'fx-toast-item';

      const dot = document.createElement('span');
      dot.className = `fx-toast-dot fx-toast-dot-${type}`;

      const msg = document.createElement('span');
      msg.className = 'fx-toast-message';
      msg.textContent = message;

      toast.appendChild(dot);
      toast.appendChild(msg);

      this.toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fx-toast-hiding');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 220);
      }, duration);
    },

    /**
     * Show custom Tesla confirmation modal.
     * @param {Object} options
     * @param {string} [options.title] - Header title
     * @param {string} [options.subtitle] - Optional subtitle
     * @param {string} [options.message] - Body text / question
     * @param {string} [options.confirmText] - Label for confirm button (default: "Đồng ý")
     * @param {string} [options.cancelText] - Label for cancel button (default: "Hủy")
     * @param {boolean} [options.isDanger] - If true, style confirm button with red accent
     * @returns {Promise<boolean>}
     */
    showConfirm({ title = 'Xác nhận', subtitle = '', message = '', confirmText = 'Đồng ý', cancelText = 'Hủy', isDanger = false } = {}) {
      return new Promise((resolve) => {
        if (!this.confirmModal) {
          resolve(window.confirm(message));
          return;
        }

        this.confirmTitle.textContent = title;
        if (subtitle) {
          this.confirmSubtitle.textContent = subtitle;
          this.confirmSubtitle.style.display = 'block';
        } else {
          this.confirmSubtitle.style.display = 'none';
        }

        this.confirmMessage.textContent = message;
        this.confirmInputWrap.style.display = 'none';

        this.btnConfirmCancel.textContent = cancelText;
        this.btnConfirmCancel.style.display = cancelText ? 'inline-flex' : 'none';

        this.btnConfirmOk.textContent = confirmText;
        if (isDanger) {
          this.btnConfirmOk.className = 'fx-btn-tesla-danger';
        } else {
          this.btnConfirmOk.className = 'fx-btn-tesla-primary';
        }

        const cleanup = () => {
          this.confirmModal.style.display = 'none';
          this.btnConfirmOk.onclick = null;
          this.btnConfirmCancel.onclick = null;
          this.confirmClose.onclick = null;
          this.confirmBackdrop.onclick = null;
          window.removeEventListener('keydown', onKeyDown);
        };

        const onConfirm = () => {
          cleanup();
          resolve(true);
        };

        const onCancel = () => {
          cleanup();
          resolve(false);
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          }
        };

        this.btnConfirmOk.onclick = onConfirm;
        this.btnConfirmCancel.onclick = onCancel;
        this.confirmClose.onclick = onCancel;
        this.confirmBackdrop.onclick = onCancel;
        window.addEventListener('keydown', onKeyDown);

        this.confirmModal.style.display = 'flex';
        this.btnConfirmOk.focus();
      });
    },

    /**
     * Show custom Tesla prompt modal for text input.
     * @param {Object} options
     * @param {string} [options.title] - Header title
     * @param {string} [options.message] - Body text / instruction
     * @param {string} [options.label] - Label for text input
     * @param {string} [options.defaultValue] - Default value in input
     * @param {string} [options.placeholder] - Placeholder text
     * @param {string} [options.confirmText] - Label for confirm button
     * @param {string} [options.cancelText] - Label for cancel button
     * @returns {Promise<string|null>}
     */
    showPrompt({ title = 'Nhập thông tin', message = '', label = 'Nội dung', defaultValue = '', placeholder = '', confirmText = 'Lưu', cancelText = 'Hủy' } = {}) {
      return new Promise((resolve) => {
        if (!this.confirmModal) {
          resolve(window.prompt(message, defaultValue));
          return;
        }

        this.confirmTitle.textContent = title;
        this.confirmSubtitle.style.display = 'none';
        this.confirmMessage.textContent = message;
        this.confirmInputWrap.style.display = 'flex';
        this.confirmInputLabel.textContent = label;
        this.confirmInput.value = defaultValue;
        this.confirmInput.placeholder = placeholder;

        this.btnConfirmCancel.textContent = cancelText;
        this.btnConfirmCancel.style.display = 'inline-flex';

        this.btnConfirmOk.textContent = confirmText;
        this.btnConfirmOk.className = 'fx-btn-tesla-primary';

        const cleanup = () => {
          this.confirmModal.style.display = 'none';
          this.btnConfirmOk.onclick = null;
          this.btnConfirmCancel.onclick = null;
          this.confirmClose.onclick = null;
          this.confirmBackdrop.onclick = null;
          window.removeEventListener('keydown', onKeyDown);
        };

        const onConfirm = () => {
          const val = this.confirmInput.value.trim();
          cleanup();
          resolve(val);
        };

        const onCancel = () => {
          cleanup();
          resolve(null);
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          }
        };

        this.btnConfirmOk.onclick = onConfirm;
        this.btnConfirmCancel.onclick = onCancel;
        this.confirmClose.onclick = onCancel;
        this.confirmBackdrop.onclick = onCancel;
        window.addEventListener('keydown', onKeyDown);

        this.confirmModal.style.display = 'flex';
        setTimeout(() => {
          this.confirmInput.focus();
          this.confirmInput.select();
        }, 50);
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => Studio.init());
})();
