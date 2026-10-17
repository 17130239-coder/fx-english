/**
 * FX English - Netflix Content Script
 * Manages floating player widget, subtitle downloads (.SRT, .VTT, .TXT),
 * and in-page POS vocabulary categorizer (Nouns, Verbs, Adj, Adv).
 */

(function () {
  'use strict';

  if (window.__fxNetflixContentInjected) return;
  window.__fxNetflixContentContentInjected = true;

  const PARSER = (typeof APP_SUBTITLE_PARSER !== 'undefined') ? APP_SUBTITLE_PARSER : null;

  let currentMovieData = {
    movieId: null,
    title: '',
    season: null,
    episode: null,
    episodeTitle: '',
    isSeries: false,
    tracks: [],
    selectedTrack: null,
    cues: [],
    analysis: null
  };

  let activePosFilter = 'all';

  function injectBridge() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('content/netflixInjected.js');
      s.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.warn('[FX Netflix] Bridge injection failed:', e);
    }
  }

  window.addEventListener('fx_netflix_bridge_event', (e) => {
    const { type, data } = e.detail || {};
    if (!data) return;

    if (type === 'metadata_ready' || type === 'tracks_ready') {
      if (data.movieId) currentMovieData.movieId = data.movieId;
      if (data.title) currentMovieData.title = data.title;
      if (data.season !== undefined) currentMovieData.season = data.season;
      if (data.episode !== undefined) currentMovieData.episode = data.episode;
      if (data.episodeTitle) currentMovieData.episodeTitle = data.episodeTitle;
      if (data.isSeries !== undefined) currentMovieData.isSeries = data.isSeries;

      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        currentMovieData.tracks = data.tracks;
        const enTrack = data.tracks.find(t => t.isEnglish && !t.isForced) || data.tracks.find(t => t.isEnglish) || data.tracks[0];
        currentMovieData.selectedTrack = enTrack;
      }

      updateWidgetUI();
    }
  });

  function getFullDisplayTitle() {
    let title = currentMovieData.title || document.title.replace(' - Netflix', '').trim() || 'Netflix Movie';
    if (currentMovieData.isSeries && currentMovieData.season && currentMovieData.episode) {
      const s = String(currentMovieData.season).padStart(2, '0');
      const ep = String(currentMovieData.episode).padStart(2, '0');
      title = `${title} S${s}E${ep}`;
      if (currentMovieData.episodeTitle) {
        title += ` - ${currentMovieData.episodeTitle}`;
      }
    }
    return title;
  }

  let widgetEl = null;
  let modalEl = null;

  function createWidget() {
    if (widgetEl) return;
    widgetEl = document.createElement('div');
    widgetEl.id = 'fx-netflix-widget';
    widgetEl.innerHTML = `
      <button class="fx-widget-pill" title="FX English - Tải phụ đề & Tách từ vựng">
        <span class="fx-widget-icon">⚡ FX</span>
        <span class="fx-widget-title">Phụ đề & Từ vựng</span>
        <span class="fx-widget-badge" id="fx-widget-badge">Đang tìm...</span>
      </button>
    `;

    document.body.appendChild(widgetEl);
    widgetEl.querySelector('.fx-widget-pill').onclick = () => openVocabModal();
  }

  function updateWidgetUI() {
    if (!widgetEl) createWidget();
    const badge = document.getElementById('fx-widget-badge');
    if (!badge) return;

    if (currentMovieData.selectedTrack) {
      badge.textContent = currentMovieData.selectedTrack.label || 'English';
      badge.classList.add('active');
    } else {
      badge.textContent = 'Bật CC';
      badge.classList.remove('active');
    }
  }

  async function fetchSubtitles() {
    if (currentMovieData.cues.length > 0) return currentMovieData.cues;
    if (!currentMovieData.selectedTrack || !currentMovieData.selectedTrack.downloadUrl) {
      window.dispatchEvent(new CustomEvent('fx_netflix_request_info'));
      throw new Error('Chưa tìm thấy đường dẫn phụ đề. Hãy đảm bảo phim đã bật phụ đề tiếng Anh.');
    }

    const resp = await fetch(currentMovieData.selectedTrack.downloadUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: Không tải được phụ đề`);
    const raw = await resp.text();
    const cues = PARSER ? PARSER.parse(raw) : [];
    if (!cues || cues.length === 0) throw new Error('Không phân tích được nội dung phụ đề.');
    currentMovieData.cues = cues;
    return cues;
  }

  function openVocabModal() {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'fx-netflix-modal-backdrop';
      modalEl.className = 'fx-modal-backdrop';
      document.body.appendChild(modalEl);
    }

    const displayTitle = getFullDisplayTitle();
    const hasTrack = Boolean(currentMovieData.selectedTrack);

    modalEl.innerHTML = `
      <div class="fx-modal-card">
        <div class="fx-modal-header">
          <div class="fx-modal-title-group">
            <span class="fx-modal-tag">🎬 FX Netflix English</span>
            <h2 class="fx-modal-title">${escapeHtml(displayTitle)}</h2>
          </div>
          <button class="fx-modal-close" id="fx-modal-btn-close">&times;</button>
        </div>

        <div class="fx-modal-body">
          <div class="fx-track-bar">
            <label class="fx-field-label">Kênh phụ đề:</label>
            <select id="fx-select-track" class="fx-select">
              ${(currentMovieData.tracks || []).map((t, idx) => `
                <option value="${idx}" ${t === currentMovieData.selectedTrack ? 'selected' : ''}>
                  ${t.label} (${t.language}) ${t.isClosedCaptions ? '[CC]' : ''}
                </option>
              `).join('')}
              ${(!currentMovieData.tracks || currentMovieData.tracks.length === 0) ? '<option value="">(Chưa bắt được phụ đề - phát video vài giây)</option>' : ''}
            </select>
          </div>

          <div class="fx-actions-row">
            <button id="fx-btn-analyze" class="fx-btn fx-btn-primary" ${!hasTrack ? 'disabled' : ''}>
              <span>⚡ Tách từ vựng (POS: Danh, Động, Tính, Trạng)</span>
            </button>

            <div class="fx-dl-group">
              <button id="fx-btn-dl-srt" class="fx-btn fx-btn-outline" title="Tải file .SRT">⬇ .SRT</button>
              <button id="fx-btn-dl-vtt" class="fx-btn fx-btn-outline" title="Tải file .VTT">⬇ .VTT</button>
              <button id="fx-btn-dl-txt" class="fx-btn fx-btn-outline" title="Tải file transcript .TXT">⬇ .TXT</button>
            </div>

            <button id="fx-btn-open-studio" class="fx-btn fx-btn-secondary" title="Mở Vocabulary Studio">
              <span>Mở Studio ↗</span>
            </button>
          </div>

          <div id="fx-modal-loading" class="fx-loading-state" style="display:none;">
            <div class="fx-spinner"></div>
            <span id="fx-loading-text">Đang phân tích từ vựng...</span>
          </div>

          <div id="fx-analysis-results" class="fx-analysis-results" style="display:none;">
            <div class="fx-pos-tabs">
              <button class="fx-pos-tab active" data-pos="all">Tất cả (<span id="fx-count-all">0</span>)</button>
              <button class="fx-pos-tab" data-pos="noun">📘 Danh từ (<span id="fx-count-noun">0</span>)</button>
              <button class="fx-pos-tab" data-pos="verb">📙 Động từ (<span id="fx-count-verb">0</span>)</button>
              <button class="fx-pos-tab" data-pos="adjective">📗 Tính từ (<span id="fx-count-adj">0</span>)</button>
              <button class="fx-pos-tab" data-pos="adverb">📕 Trạng từ (<span id="fx-count-adv">0</span>)</button>
            </div>

            <div class="fx-search-bar">
              <input type="text" id="fx-search-input" placeholder="Tìm kiếm từ vựng hoặc nghĩa tiếng Việt...">
              <button id="fx-btn-export-anki" class="fx-btn-sm fx-btn-anki">🗂️ Xuất Anki</button>
              <button id="fx-btn-export-csv" class="fx-btn-sm fx-btn-csv">📊 Xuất CSV</button>
            </div>

            <div id="fx-words-grid" class="fx-words-grid"></div>
          </div>
        </div>
      </div>
    `;

    modalEl.style.display = 'flex';

    document.getElementById('fx-modal-btn-close').onclick = () => { modalEl.style.display = 'none'; };
    modalEl.onclick = (e) => { if (e.target === modalEl) modalEl.style.display = 'none'; };

    const trackSelect = document.getElementById('fx-select-track');
    if (trackSelect) {
      trackSelect.onchange = () => {
        const idx = parseInt(trackSelect.value, 10);
        if (!isNaN(idx) && currentMovieData.tracks[idx]) {
          currentMovieData.selectedTrack = currentMovieData.tracks[idx];
          currentMovieData.cues = [];
          currentMovieData.analysis = null;
          updateWidgetUI();
        }
      };
    }

    document.getElementById('fx-btn-dl-srt').onclick = () => handleDownload('srt');
    document.getElementById('fx-btn-dl-vtt').onclick = () => handleDownload('vtt');
    document.getElementById('fx-btn-dl-txt').onclick = () => handleDownload('txt');
    document.getElementById('fx-btn-analyze').onclick = () => runVocabularyAnalysis();

    document.getElementById('fx-btn-open-studio').onclick = () => {
      chrome.storage.local.set({
        fxPendingStudio: {
          title: getFullDisplayTitle(),
          url: window.location.href,
          cues: currentMovieData.cues,
          analysis: currentMovieData.analysis
        }
      }, () => {
        chrome.runtime.sendMessage({ action: 'open_studio' });
      });
    };

    if (currentMovieData.analysis) {
      renderAnalysisResults(currentMovieData.analysis);
    }
  }

  async function runVocabularyAnalysis() {
    const loadingEl = document.getElementById('fx-modal-loading');
    const loadingText = document.getElementById('fx-loading-text');
    const resultsEl = document.getElementById('fx-analysis-results');

    try {
      loadingEl.style.display = 'flex';
      loadingText.textContent = 'Đang tải phụ đề tiếng Anh từ Netflix...';

      const cues = await fetchSubtitles();
      loadingText.textContent = `Đang phân loại ${cues.length} câu phụ đề theo 4 loại từ...`;

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'analyze_subtitles',
          cues: cues,
          options: { videoTitle: getFullDisplayTitle(), videoUrl: window.location.href }
        }, (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (res && res.success) resolve(res.analysis);
          else reject(new Error(res?.error || 'Phân tích thất bại'));
        });
      });

      currentMovieData.analysis = response;
      loadingEl.style.display = 'none';
      resultsEl.style.display = 'block';
      renderAnalysisResults(response);
    } catch (err) {
      loadingEl.style.display = 'none';
      alert(err.message || 'Lỗi khi phân tích từ vựng');
    }
  }

  function renderAnalysisResults(analysis) {
    if (!analysis) return;
    const { summary, posGroups, allWords } = analysis;

    document.getElementById('fx-count-all').textContent = summary.uniqueWords || allWords.length;
    document.getElementById('fx-count-noun').textContent = summary.nounCount || posGroups.nouns.length;
    document.getElementById('fx-count-verb').textContent = summary.verbCount || posGroups.verbs.length;
    document.getElementById('fx-count-adj').textContent = summary.adjCount || posGroups.adjectives.length;
    document.getElementById('fx-count-adv').textContent = summary.advCount || posGroups.adverbs.length;

    // Tabs
    const tabs = document.querySelectorAll('.fx-pos-tab');
    tabs.forEach((tab) => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activePosFilter = tab.getAttribute('data-pos');
        filterAndRenderWords(analysis);
      };
    });

    const searchInput = document.getElementById('fx-search-input');
    if (searchInput) {
      searchInput.oninput = () => filterAndRenderWords(analysis);
    }

    document.getElementById('fx-btn-export-anki').onclick = () => exportVocab('anki', analysis);
    document.getElementById('fx-btn-export-csv').onclick = () => exportVocab('csv', analysis);

    filterAndRenderWords(analysis);
  }

  function filterAndRenderWords(analysis) {
    const grid = document.getElementById('fx-words-grid');
    if (!grid) return;

    let words = [];
    if (activePosFilter === 'all') words = analysis.allWords || [];
    else if (activePosFilter === 'noun') words = analysis.posGroups.nouns || [];
    else if (activePosFilter === 'verb') words = analysis.posGroups.verbs || [];
    else if (activePosFilter === 'adjective') words = analysis.posGroups.adjectives || [];
    else if (activePosFilter === 'adverb') words = analysis.posGroups.adverbs || [];

    const query = (document.getElementById('fx-search-input')?.value || '').toLowerCase().trim();
    if (query) {
      words = words.filter(w =>
        w.word.toLowerCase().includes(query) ||
        (w.translation && w.translation.toLowerCase().includes(query))
      );
    }

    if (words.length === 0) {
      grid.innerHTML = '<div class="fx-empty-msg">Không tìm thấy từ vựng phù hợp.</div>';
      return;
    }

    grid.innerHTML = words.slice(0, 150).map((item) => {
      const firstCtx = (item.contexts && item.contexts[0]) ? item.contexts[0] : null;
      let sentenceHtml = '';
      if (firstCtx) {
        const sentence = firstCtx.sentence || '';
        const hl = firstCtx.highlightWord || item.word;
        const esc = String(hl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sentenceHtml = escapeHtml(sentence).replace(new RegExp(`\\b(${esc})\\b`, 'gi'), '<b>$1</b>');
      }

      return `
        <div class="fx-word-card">
          <div class="fx-word-header">
            <span class="fx-word-text">${item.word}</span>
            <span class="fx-pos-badge ${item.pos}">${item.posLabelVi || item.pos}</span>
            <span class="fx-freq-pill">${item.frequency}x</span>
            <button class="fx-btn-speak" data-speak="${escapeHtml(item.word)}" title="Phát âm">🔊</button>
          </div>
          ${item.ipa ? `<div class="fx-word-ipa">${item.ipa} <span class="fx-cefr-tag">${item.cefr}</span></div>` : ''}
          ${item.translation ? `<div class="fx-word-trans">${escapeHtml(item.translation)}</div>` : ''}
          ${firstCtx ? `
            <div class="fx-word-context">
              <div class="fx-context-text">"${sentenceHtml}"</div>
              <button class="fx-btn-seek" data-sec="${firstCtx.startSec}" title="Nhảy tới cảnh này">▶ ${firstCtx.startTime}</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Speak buttons
    grid.querySelectorAll('.fx-btn-speak').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        speakWord(btn.getAttribute('data-speak'));
      };
    });

    // Seek buttons
    grid.querySelectorAll('.fx-btn-seek').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sec = parseFloat(btn.getAttribute('data-sec'));
        if (!isNaN(sec)) {
          window.dispatchEvent(new CustomEvent('fx_netflix_seek', { detail: { seconds: sec } }));
        }
      };
    });
  }

  function speakWord(text) {
    if (!text || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  async function handleDownload(format) {
    try {
      const cues = await fetchSubtitles();
      const safeTitle = (getFullDisplayTitle() || 'netflix_subtitles').replace(/[/\\?%*:|"<>]/g, '_');
      let content = '';
      let filename = `${safeTitle}.${format}`;
      let mimeType = 'text/plain;charset=utf-8;';

      if (format === 'srt') {
        content = PARSER.toSRT(cues);
        mimeType = 'application/x-subrip;charset=utf-8;';
      } else if (format === 'vtt') {
        content = PARSER.toWebVTT(cues);
        mimeType = 'text/vtt;charset=utf-8;';
      } else if (format === 'txt') {
        content = PARSER.toReadableTranscript(cues);
      }

      downloadFile(content, filename, mimeType);
    } catch (err) {
      alert(err.message || 'Không thể tải file phụ đề');
    }
  }

  function exportVocab(format, analysis) {
    let words = [];
    if (activePosFilter === 'all') words = analysis.allWords || [];
    else if (activePosFilter === 'noun') words = analysis.posGroups.nouns || [];
    else if (activePosFilter === 'verb') words = analysis.posGroups.verbs || [];
    else if (activePosFilter === 'adjective') words = analysis.posGroups.adjectives || [];
    else if (activePosFilter === 'adverb') words = analysis.posGroups.adverbs || [];

    chrome.runtime.sendMessage({
      action: 'export_vocab',
      words: words,
      format: format,
      title: getFullDisplayTitle()
    }, (res) => {
      if (res && res.success && res.content) {
        downloadFile(res.content, res.filename, res.mime);
      } else {
        alert('Lỗi khi xuất file');
      }
    });
  }

  function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Runtime message listener for Popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'get_media_info') {
      sendResponse({
        success: true,
        platform: 'netflix',
        title: getFullDisplayTitle(),
        hasTracks: currentMovieData.tracks && currentMovieData.tracks.length > 0,
        selectedTrack: currentMovieData.selectedTrack ? {
          label: currentMovieData.selectedTrack.label || 'English'
        } : null
      });
      return false;
    }

    if (msg.action === 'open_vocab_modal') {
      openVocabModal();
      sendResponse({ success: true });
      return false;
    }

    if (msg.action === 'download_subtitles') {
      handleDownload(msg.format || 'srt').then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (msg.action === 'get_subtitles') {
      fetchSubtitles().then((cues) => {
        sendResponse({
          success: true,
          platform: 'netflix',
          title: getFullDisplayTitle(),
          cues: cues
        });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
  });

  function init() {
    injectBridge();
    createWidget();

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        currentMovieData.cues = [];
        currentMovieData.analysis = null;
        window.dispatchEvent(new CustomEvent('fx_netflix_request_info'));
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
