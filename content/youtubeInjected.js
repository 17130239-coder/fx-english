/**
 * FX English - YouTube Injected Script (Runs in page context: MAIN world)
 * Extracts full YouTube caption tracks directly from movie_player or ytInitialPlayerResponse,
 * intercepts timedtext network requests, and triggers player caption loading.
 */

(function () {
  'use strict';

  if (window.__fxYoutubeInjected) return;
  window.__fxYoutubeInjected = true;

  // Cache for captured timedtext by language, URL, and latest
  const capturedTimedText = new Map();

  function dispatchToContent(type, data) {
    try {
      window.dispatchEvent(new CustomEvent('fx_youtube_bridge_event', {
        detail: { type, data }
      }));
    } catch (e) {
      console.warn('[FX YouTube Injected] Dispatch error:', e);
    }
  }

  // 1. Intercept window.fetch to capture player's own timedtext requests (which include pot and valid tokens)
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    const res = await origFetch.apply(this, args);

    if (url && url.includes('/api/timedtext')) {
      try {
        const clone = res.clone();
        clone.text().then((text) => {
          if (text && text.trim().length > 20) {
            const langMatch = url.match(/[?&]lang=([a-zA-Z0-9_-]+)/);
            const lang = langMatch ? langMatch[1] : 'en';
            capturedTimedText.set(lang, text);
            capturedTimedText.set('latest', text);
            capturedTimedText.set(url, text);
            dispatchToContent('youtube_subtitles_text_ready', { success: true, text });
          }
        }).catch(() => {});
      } catch (e) {}
    }
    return res;
  };

  // 2. Intercept XMLHttpRequest to capture player's timedtext requests
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    const url = args[1];
    if (typeof url === 'string' && url.includes('/api/timedtext')) {
      this.addEventListener('load', function () {
        try {
          const text = this.responseText;
          if (text && text.trim().length > 20) {
            const langMatch = url.match(/[?&]lang=([a-zA-Z0-9_-]+)/);
            const lang = langMatch ? langMatch[1] : 'en';
            capturedTimedText.set(lang, text);
            capturedTimedText.set('latest', text);
            capturedTimedText.set(url, text);
            dispatchToContent('youtube_subtitles_text_ready', { success: true, text });
          }
        } catch (e) {}
      }, false);
    }
    return origOpen.apply(this, args);
  };

  function getCaptionTracks() {
    let tracks = null;
    let videoTitle = '';

    // 0. Ensure captions module is loaded in player
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.loadModule === 'function') {
        player.loadModule('captions');
      }
    } catch (e) {}

    // 1. Check movie_player.getPlayerResponse()
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.getPlayerResponse === 'function') {
        const resp = player.getPlayerResponse();
        tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        videoTitle = resp?.videoDetails?.title || '';
      }
    } catch (e) {}

    // 2. Fallback to ytInitialPlayerResponse
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      try {
        if (window.ytInitialPlayerResponse) {
          tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (!videoTitle) {
            videoTitle = window.ytInitialPlayerResponse?.videoDetails?.title || '';
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to ytInitialData
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      try {
        if (window.ytInitialData) {
          const pr = window.ytInitialData.playerResponse;
          if (pr) {
            tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!videoTitle) videoTitle = pr.videoDetails?.title || '';
          }
        }
      } catch (e) {}
    }

    // 4. Fallback to player.getOption('captions', 'tracklist') only if baseUrl exists
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      try {
        const player = document.getElementById('movie_player');
        if (player && typeof player.getOption === 'function') {
          const optTracks = player.getOption('captions', 'tracklist');
          if (Array.isArray(optTracks) && optTracks.length > 0) {
            const valid = optTracks.filter(t => Boolean(t.baseUrl || t.url));
            if (valid.length > 0) {
              tracks = valid.map(t => ({
                baseUrl: t.url || t.baseUrl,
                languageCode: t.languageCode,
                name: { simpleText: t.name || t.displayName || t.languageName || t.languageCode },
                kind: t.kind || (t.is_default ? '' : 'asr')
              }));
            }
          }
        }
      } catch (e) {}
    }

    if (!videoTitle) {
      const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title');
      videoTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '').trim();
    }

    const cleanTracks = [];
    if (Array.isArray(tracks)) {
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t.baseUrl) continue;
        const lang = t.languageCode || 'en';
        const name = t.name?.simpleText || t.name?.runs?.[0]?.text || lang;
        const isAsr = t.kind === 'asr';
        const isEnglish = lang.toLowerCase().startsWith('en') || /english|tiếng anh/i.test(name);

        cleanTracks.push({
          index: cleanTracks.length,
          baseUrl: t.baseUrl,
          language: lang,
          label: `${name}${isAsr ? ' (Tự động)' : ''}`,
          isEnglish: isEnglish,
          isAutoGenerated: isAsr
        });
      }
    }

    // ALWAYS sort English tracks to the top so English is selected by default
    cleanTracks.sort((a, b) => {
      if (a.isEnglish && !b.isEnglish) return -1;
      if (!a.isEnglish && b.isEnglish) return 1;
      if (a.isEnglish && b.isEnglish) {
        if (!a.isAutoGenerated && b.isAutoGenerated) return -1;
        if (a.isAutoGenerated && !b.isAutoGenerated) return 1;
      }
      return a.label.localeCompare(b.label);
    });

    cleanTracks.forEach((t, idx) => { t.index = idx; });

    return {
      title: videoTitle,
      tracks: cleanTracks
    };
  }

  function notifyTracks() {
    const info = getCaptionTracks();
    if (info && info.tracks && info.tracks.length > 0) {
      dispatchToContent('youtube_tracks_ready', info);
    }
  }

  // Request info listener from content script
  window.addEventListener('fx_youtube_request_info', () => {
    notifyTracks();
  });

  // Fetch timedtext directly from MAIN page context
  window.addEventListener('fx_youtube_fetch_timedtext', async (e) => {
    const { url, lang, requestId } = e.detail || {};
    if (!url) return;

    // 1. Check if we already intercepted timedtext for this language or url
    const cached = capturedTimedText.get(lang || 'en') || capturedTimedText.get(url) || capturedTimedText.get('latest');
    if (cached && cached.trim().length > 20) {
      dispatchToContent('youtube_subtitles_text_ready', { success: true, text: cached, requestId });
      return;
    }

    // 2. Trigger player to load captions for this language code (player fetches with pot token)
    try {
      const player = document.getElementById('movie_player');
      if (player) {
        if (typeof player.loadModule === 'function') {
          player.loadModule('captions');
        }
        if (typeof player.getOption === 'function') {
          const tracklist = player.getOption('captions', 'tracklist') || [];
          const matched = tracklist.find(t => t.languageCode === lang || (lang && t.languageCode && t.languageCode.startsWith(lang))) ||
                          tracklist.find(t => t.languageCode === 'en' || (t.languageCode && t.languageCode.startsWith('en')));
          if (matched && typeof player.setOption === 'function') {
            player.setOption('captions', 'track', matched);
          } else if (typeof player.setOption === 'function') {
            player.setOption('captions', 'track', { languageCode: lang || 'en' });
          }
        } else if (typeof player.setOption === 'function') {
          player.setOption('captions', 'track', { languageCode: lang || 'en' });
        }
      }

      // Also ensure CC button is turned on if available
      const ccBtn = document.querySelector('.ytp-subtitles-button');
      if (ccBtn && ccBtn.getAttribute('aria-pressed') !== 'true') {
        ccBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        ccBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        ccBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    } catch (e) {}

    // 3. Attempt direct fetch with credentials
    const tryUrls = [
      url,
      url.includes('fmt=') ? url : url + '&fmt=srv3',
      url.includes('fmt=') ? url : url + '&fmt=vtt',
      url.includes('fmt=') ? url : url + '&fmt=json3'
    ];

    for (const u of tryUrls) {
      try {
        const resp = await fetch(u, { credentials: 'include' });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 20) {
            capturedTimedText.set(lang || 'en', text);
            dispatchToContent('youtube_subtitles_text_ready', { success: true, text, requestId });
            return;
          }
        }
      } catch (err) {}
    }

    // 4. Poll for player's intercepted network response
    let attempts = 0;
    const waitInterval = setInterval(() => {
      attempts++;
      const text = capturedTimedText.get(lang || 'en') || capturedTimedText.get(url) || capturedTimedText.get('latest');
      if (text && text.trim().length > 20) {
        clearInterval(waitInterval);
        dispatchToContent('youtube_subtitles_text_ready', { success: true, text, requestId });
      } else if (attempts >= 15) {
        clearInterval(waitInterval);
        dispatchToContent('youtube_subtitles_text_ready', {
          success: false,
          error: 'YouTube chưa trả về nội dung phụ đề cho video này. Hãy bấm bật biểu tượng [CC] trên video rồi thử lại.',
          requestId
        });
      }
    }, 200);
  });

  // Seek video listener
  window.addEventListener('fx_youtube_seek', (e) => {
    try {
      const seconds = Number(e.detail && e.detail.seconds);
      if (isNaN(seconds) || seconds < 0) return;
      const player = document.getElementById('movie_player');
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(seconds, true);
        player.playVideo();
      } else {
        const video = document.querySelector('video.html5-main-video, video');
        if (video) {
          video.currentTime = seconds;
          video.play();
        }
      }
    } catch (err) {}
  });

  // Player API Change hook
  try {
    const player = document.getElementById('movie_player');
    if (player && typeof player.addEventListener === 'function') {
      player.addEventListener('onApiChange', () => {
        setTimeout(notifyTracks, 300);
      });
    }
  } catch (e) {}

  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(notifyTracks, 800);
    setTimeout(notifyTracks, 1800);
  });

  // Poll for tracks on page load
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    const info = getCaptionTracks();
    if (info && info.tracks && info.tracks.length > 0) {
      dispatchToContent('youtube_tracks_ready', info);
      clearInterval(poll);
    } else if (attempts >= 10) {
      clearInterval(poll);
    }
  }, 1000);

  setTimeout(notifyTracks, 1500);
})();
