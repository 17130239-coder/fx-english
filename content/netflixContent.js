/**
 * FX English - Netflix Content Script
 * Headless content worker: communicates with Netflix player bridge in MAIN world,
 * tracks movie/series metadata and caption tracks, and serves subtitle data
 * directly to Extension Popup and Studio.
 * Zero in-page popup / widget overlays on the video player.
 */

(function () {
  'use strict';

  if (window.__fxNetflixContentInjected) return;
  window.__fxNetflixContentInjected = true;

  // Clean up any legacy in-page popup or widget if previously injected
  try {
    document.getElementById('fx-netflix-widget')?.remove();
    document.getElementById('fx-netflix-modal-backdrop')?.remove();
  } catch (e) {}

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
    cues: []
  };

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
        const enTrack = data.tracks.find(t => t.isEnglish && !t.isForced) ||
                        data.tracks.find(t => t.isEnglish) ||
                        data.tracks[0];
        currentMovieData.selectedTrack = enTrack;
      }
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

  async function fetchSubtitles() {
    if (currentMovieData.cues.length > 0) return currentMovieData.cues;
    if (!currentMovieData.selectedTrack || !currentMovieData.selectedTrack.downloadUrl) {
      window.dispatchEvent(new CustomEvent('fx_netflix_request_info'));
      throw new Error('Chưa tìm thấy đường dẫn phụ đề. Hãy đảm bảo phim đã bật phụ đề tiếng Anh.');
    }

    let raw = '';
    try {
      const resp = await fetch(currentMovieData.selectedTrack.downloadUrl);
      if (resp.ok) raw = await resp.text();
    } catch (e) {}

    if (!raw) {
      const fb = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetch_external_url', url: currentMovieData.selectedTrack.downloadUrl }, resolve);
      });
      if (fb && fb.success && fb.text) raw = fb.text;
    }

    if (!raw) throw new Error('Không tải được nội dung phụ đề từ Netflix. Hãy thử phát video vài giây rồi tải lại.');

    const cues = PARSER ? PARSER.parse(raw) : [];
    if (!cues || cues.length === 0) throw new Error('Không phân tích được nội dung phụ đề.');
    currentMovieData.cues = cues;
    return cues;
  }

  async function handleDownload(format) {
    const cues = await fetchSubtitles();
    const safeTitle = getFullDisplayTitle().replace(/[/\\?%*:|"<>]/g, '_');
    let content = '';
    let filename = `${safeTitle}.${format}`;
    let mimeType = 'text/plain;charset=utf-8;';

    if (format === 'srt') {
      content = PARSER ? PARSER.toSRT(cues) : '';
      mimeType = 'application/x-subrip;charset=utf-8;';
    } else if (format === 'vtt') {
      content = PARSER ? PARSER.toWebVTT(cues) : '';
      mimeType = 'text/vtt;charset=utf-8;';
    } else if (format === 'txt') {
      content = PARSER ? PARSER.toReadableTranscript(cues) : '';
    }

    download(content, filename, mimeType);
  }

  function download(content, filename, mimeType = 'text/plain;charset=utf-8;') {
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

  // Runtime message listener for Popup & Studio
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

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        currentMovieData.cues = [];
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
