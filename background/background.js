/**
 * FX English - Background Service Worker
 * Manages background subtitle analysis, file exports, media status querying, and studio tab.
 */

'use strict';

// Load Core Libraries into Service Worker
importScripts(
  '../lib/compromise.js',
  '../lib/subtitleParser.js',
  '../lib/cefrDict.js',
  '../lib/vocabAnalyzer.js',
  '../lib/neonClient.js'
);

const MessageDispatcher = {
  handlers: {
    // Open Full-screen Vocabulary Studio
    ['open_studio']: async () => {
      const url = chrome.runtime.getURL('studio/studio.html');
      await chrome.tabs.create({ url });
      return { success: true };
    },

    // NLP Subtitle Vocabulary Analysis (POS: Nouns, Verbs, Adjectives, Adverbs)
    ['analyze_subtitles']: async (message) => {
      const analyzer = (typeof APP_VOCAB_ANALYZER !== 'undefined') ? APP_VOCAB_ANALYZER : null;
      if (!analyzer) throw new Error('VocabAnalyzer is not available in background worker');

      const cues = message.cues || [];
      const options = message.options || {};
      const analysis = analyzer.analyzeSubtitles(cues, options);
      return { success: true, analysis };
    },

    // Export Vocabulary List (Anki or CSV)
    ['export_vocab']: async (message) => {
      const analyzer = (typeof APP_VOCAB_ANALYZER !== 'undefined') ? APP_VOCAB_ANALYZER : null;
      if (!analyzer) throw new Error('VocabAnalyzer is not available in background worker');

      const words = message.words || [];
      const title = (message.title || 'fx_vocab').replace(/[/\\?%*:|"<>]/g, '_');
      let content = '';
      let filename = '';
      let mime = 'text/plain;charset=utf-8;';

      if (message.format === 'anki') {
        content = analyzer.exportToAnkiFormat(words);
        filename = `${title}_anki.txt`;
      } else {
        content = analyzer.exportToCsvFormat(words);
        filename = `${title}_vocab.csv`;
        mime = 'text/csv;charset=utf-8;';
      }

      return { success: true, content, filename, mime };
    },


    // Robust YouTube Subtitle Extractor using Android InnerTube API (bypasses botwall, poToken, and exp=xpe)
    ['fetch_youtube_captions']: async (message) => {
      let videoId = message.videoId;
      if (!videoId && message.url) {
        try {
          const u = new URL(message.url);
          videoId = u.searchParams.get('v');
          if (!videoId) {
            const m = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
            if (m) videoId = m[1];
          }
        } catch (e) {}
      }
      if (!videoId) throw new Error('Missing videoId');

      const parser = (typeof APP_SUBTITLE_PARSER !== 'undefined') ? APP_SUBTITLE_PARSER : null;

      const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38'
            }
          },
          videoId: videoId
        })
      });

      if (!resp.ok) throw new Error(`YouTube API Error: ${resp.status}`);
      const data = await resp.json();

      const rawTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const title = data?.videoDetails?.title || '';

      if (rawTracks.length === 0) {
        throw new Error('Video này không có phụ đề (No captions available for this video).');
      }

      // Prioritize English track, then any available track
      const selectedTrack = rawTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('en') && t.kind !== 'asr') ||
                            rawTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('en')) ||
                            rawTracks[0];

      let rawXml = '';
      if (selectedTrack && selectedTrack.baseUrl) {
        const subResp = await fetch(selectedTrack.baseUrl);
        if (subResp.ok) {
          rawXml = await subResp.text();
        }
      }

      const cues = (parser && rawXml) ? parser.parse(rawXml) : [];
      if (!cues || cues.length === 0) {
        throw new Error('Không phân tích được nội dung phụ đề từ YouTube.');
      }

      return {
        success: true,
        title: title,
        tracks: rawTracks,
        selectedTrack,
        cues: cues
      };
    },

    // Proxy external fetch (bypasses CSP on YouTube/Netflix when downloading captions)
    ['fetch_external_url']: async (message) => {
      const resp = await fetch(message.url);
      if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
      const text = await resp.text();
      return { success: true, text };
    },

    // Query active tab media status for Popup & Studio
    ['get_active_media_status']: async () => {
      // 1. Try currently active tab first (Popup context)
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.url) {
          const isYT = activeTab.url.includes('youtube.com/watch') || activeTab.url.includes('youtube.com/shorts/') || activeTab.url.includes('youtube.com/live/');
          const isNF = activeTab.url.includes('netflix.com/watch/');
          if (isYT || isNF) {
            return {
              isMedia: true,
              platform: isNF ? 'netflix' : 'youtube',
              tabId: activeTab.id,
              title: activeTab.title || '',
              url: activeTab.url
            };
          }
        }
      } catch (e) {}

      // 2. Fallback: Search any open Netflix or YouTube tab across all windows (Studio context)
      try {
        const mediaTabs = await chrome.tabs.query({
          url: [
            '*://*.youtube.com/watch*',
            '*://*.youtube.com/shorts/*',
            '*://*.youtube.com/live/*',
            '*://*.netflix.com/watch/*'
          ]
        });

        if (mediaTabs && mediaTabs.length > 0) {
          const tab = mediaTabs[0];
          const isNF = tab.url.includes('netflix.com/watch/');
          return {
            isMedia: true,
            platform: isNF ? 'netflix' : 'youtube',
            tabId: tab.id,
            title: tab.title || '',
            url: tab.url
          };
        }
      } catch (e) {}

      return { isMedia: false };
    },

    // Neon Database: Save scanned movie & vocabulary
    ['neon_save_movie']: async (message) => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      const movie = await client.saveMovie(message.item);
      return { success: true, movie };
    },

    // Neon Database: Retrieve scanned movies
    ['neon_get_movies']: async (message) => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      const movies = await client.getMovies(message.limit || 100);
      return { success: true, movies };
    },

    // Neon Database: Delete scanned movie
    ['neon_delete_movie']: async (message) => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      const deleted = await client.deleteMovie(message.id);
      return { success: true, deleted };
    },

    // Neon Database: Clear all scanned movies
    ['neon_clear_all_movies']: async () => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      await client.clearAllMovies();
      return { success: true };
    },

    // Neon Database: Health check
    ['neon_check_health']: async () => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      const health = await client.checkHealth();
      return { success: true, health };
    },

    // Neon Database: Raw SQL Query
    ['neon_query']: async (message) => {
      const client = (typeof APP_NEON_CLIENT !== 'undefined') ? APP_NEON_CLIENT : null;
      if (!client) throw new Error('Neon client is not initialized in background worker');
      const rows = await client.queryDirect(message.sql, message.params || []);
      return { success: true, rows };
    }
  },

  dispatch(message, sender, sendResponse) {
    if (!message || !message.action) return false;
    const handler = this.handlers[message.action];
    if (typeof handler !== 'function') return false;

    Promise.resolve(handler(message, sender))
      .then((res) => {
        sendResponse(res || { success: true });
      })
      .catch((err) => {
        console.error(`[FX Background] Error in '${message.action}':`, err);
        sendResponse({ success: false, error: err.message || String(err) });
      });

    return true; // Keep message channel open for async response
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return MessageDispatcher.dispatch(message, sender, sendResponse);
});

console.log('[FX English] Background Service Worker ready');
