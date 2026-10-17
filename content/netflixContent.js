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

  // Thoroughly purge and suppress any in-page floating popups or widgets (both FX and AF legacy)
  const purgeInPageOverlays = () => {
    const selectors = [
      '#fx-youtube-widget',
      '#af-youtube-widget',
      '#fx-netflix-widget',
      '#af-netflix-widget',
      '.af-widget-pill',
      '.fx-widget-pill',
      '#fx-youtube-modal-backdrop',
      '#af-modal-backdrop',
      '#fx-netflix-modal-backdrop'
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        try { el.remove(); } catch (e) {}
      });
    });
  };

  try {
    purgeInPageOverlays();

    // Inject CSS rule to guarantee elements are completely hidden and unclickable
    if (!document.getElementById('fx-hide-all-overlays')) {
      const hideStyle = document.createElement('style');
      hideStyle.id = 'fx-hide-all-overlays';
      hideStyle.textContent = `
        #fx-youtube-widget, #af-youtube-widget,
        #fx-netflix-widget, #af-netflix-widget,
        .af-widget-pill, .fx-widget-pill,
        #fx-youtube-modal-backdrop, #af-modal-backdrop,
        #fx-netflix-modal-backdrop {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
        }
      `;
      (document.head || document.documentElement).appendChild(hideStyle);
    }

    // Watch for dynamic element insertions and remove immediately
    const observer = new MutationObserver(() => {
      purgeInPageOverlays();
    });
    if (document.documentElement || document.body) {
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }
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

  async function resolveTitleFromWeb(watchId) {
    if (!watchId) return null;
    try {
      const resp = await fetch(`https://www.netflix.com/title/${watchId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (resp.ok) {
        const html = await resp.text();
        // 1. Netflix public page main heading <h1>Title</h1>
        const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1 && h1[1] && h1[1].trim() && h1[1].toLowerCase() !== 'netflix') {
          return h1[1].trim();
        }
        // 2. OpenGraph og:title
        const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
        if (og && og[1] && og[1].toLowerCase() !== 'netflix') {
          return og[1].replace(/\s*[-–—|]\s*Netflix.*$/i, '').trim();
        }
        // 3. Document <title>
        const tm = html.match(/<title>([^<]+)<\/title>/i);
        if (tm && tm[1]) {
          const c = tm[1]
            .replace(/^Watch\s+/i, '')
            .replace(/\s*[-–—|]\s*Netflix.*$/i, '')
            .replace(/^Netflix\s*[-–—|]\s*/i, '')
            .trim();
          if (c && c.toLowerCase() !== 'netflix') return c;
        }
      }
    } catch (e) {}
    return null;
  }

  function getFullDisplayTitle() {
    let title = currentMovieData.title;

    // 1. Try DOM elements in Netflix player
    if (!title || title.trim().toLowerCase() === 'netflix') {
      // Wake up controls overlay if dormant
      try {
        const playerView = document.querySelector('.watch-video--player-view-container, .netflix-sans-font-loaded');
        if (playerView) {
          playerView.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }));
        }
      } catch (e) {}

      const titleEl = document.querySelector('[data-uia="video-title"], .video-title, h4.ellipsize-text');
      if (titleEl) {
        const h4El = titleEl.querySelector('h4');
        const spanEl = titleEl.querySelector('span');
        if (h4El && spanEl) {
          const h4Text = (h4El.textContent || '').trim();
          const spanText = (spanEl.textContent || '').trim();
          if (h4Text && h4Text.toLowerCase() !== 'netflix') {
            title = spanText ? `${h4Text} - ${spanText}` : h4Text;
          }
        }
        if (!title || title.toLowerCase() === 'netflix') {
          const text = (titleEl.textContent || titleEl.innerText || '').trim();
          if (text && text.toLowerCase() !== 'netflix') {
            title = text.replace(/\n+/g, ' - ').replace(/\s{2,}/g, ' ');
          }
        }
      }
    }

    // 2. Try Back to Browse button (aria-label: "Back to Browse: Movie Title")
    if (!title || title.trim().toLowerCase() === 'netflix') {
      const backBtn = document.querySelector('button[data-uia="nested-back-button"], a[data-uia="back-to-browse"]');
      if (backBtn) {
        const label = backBtn.getAttribute('aria-label') || '';
        const m = label.match(/:\s*(.+)$/);
        if (m && m[1] && m[1].toLowerCase() !== 'netflix') {
          title = m[1].trim();
        }
      }
    }

    // 3. Try document.title
    if (!title || title.trim().toLowerCase() === 'netflix') {
      const docClean = (document.title || '')
        .replace(/\s*[-–—|]\s*Netflix.*$/i, '')
        .replace(/^Netflix\s*[-–—|]\s*/i, '')
        .trim();
      if (docClean && docClean.toLowerCase() !== 'netflix') {
        title = docClean;
      }
    }

    // 4. Try <meta property="og:title">
    if (!title || title.trim().toLowerCase() === 'netflix') {
      const ogMeta = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
      if (ogMeta && ogMeta.content) {
        const ogClean = ogMeta.content.replace(/\s*[-–—|]\s*Netflix.*$/i, '').trim();
        if (ogClean && ogClean.toLowerCase() !== 'netflix') {
          title = ogClean;
        }
      }
    }

    // 5. Fallback: Extract watch ID from URL so different Netflix movies/episodes never have identical titles
    const match = window.location.pathname.match(/\/watch\/(\d+)/);
    const watchId = match ? match[1] : (currentMovieData.movieId || '');

    if (!title || title.trim().toLowerCase() === 'netflix') {
      title = watchId ? `Netflix Phim #${watchId}` : 'Netflix Video';
    }

    if (currentMovieData.isSeries && currentMovieData.season && currentMovieData.episode) {
      const s = String(currentMovieData.season).padStart(2, '0');
      const ep = String(currentMovieData.episode).padStart(2, '0');
      const epCode = `S${s}E${ep}`;
      if (!title.includes(epCode)) {
        title = `${title} ${epCode}`;
      }
      if (currentMovieData.episodeTitle && !title.includes(currentMovieData.episodeTitle)) {
        title += ` - ${currentMovieData.episodeTitle}`;
      }
    }

    if (title && title.toLowerCase() !== 'netflix' && !title.startsWith('Netflix Phim #')) {
      currentMovieData.title = title;
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
      let title = getFullDisplayTitle();
      const match = window.location.pathname.match(/\/watch\/(\d+)/);
      const watchId = match ? match[1] : (currentMovieData.movieId || '');

      if ((!title || title.toLowerCase() === 'netflix' || title.startsWith('Netflix Phim #')) && watchId) {
        resolveTitleFromWeb(watchId).then((webTitle) => {
          if (webTitle) currentMovieData.title = webTitle;
        }).catch(() => {});
      }

      sendResponse({
        success: true,
        platform: 'netflix',
        title: title,
        url: window.location.href,
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
      (async () => {
        try {
          const cues = await fetchSubtitles();
          let title = getFullDisplayTitle();
          const match = window.location.pathname.match(/\/watch\/(\d+)/);
          const watchId = match ? match[1] : (currentMovieData.movieId || '');
          if ((!title || title.toLowerCase() === 'netflix' || title.startsWith('Netflix Phim #')) && watchId) {
            const webTitle = await resolveTitleFromWeb(watchId);
            if (webTitle) {
              title = webTitle;
              currentMovieData.title = webTitle;
            }
          }
          sendResponse({
            success: true,
            platform: 'netflix',
            title: title,
            url: window.location.href,
            cues: cues
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (msg.action === 'seek_to_time') {
      const timeSec = Number(msg.timeSec) || 0;
      window.dispatchEvent(new CustomEvent('fx_netflix_seek', {
        detail: { seconds: timeSec, timeSec: timeSec }
      }));
      const video = document.querySelector('video');
      if (video) {
        try { video.currentTime = timeSec; } catch (e) {}
      }
      sendResponse({ success: true, timeSec });
      return false;
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
