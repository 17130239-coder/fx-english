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
  '../lib/neonClient.js',
  '../lib/masterList.js',
  '../lib/aiClient.js'
);

const MessageDispatcher = {
  handlers: {
    // Open Full-screen Vocabulary Studio
    ['open_studio']: async () => {
      const url = chrome.runtime.getURL('studio/studio.html');
      await chrome.tabs.create({ url });
      return { success: true };
    },

    // 9Router AI Linguistic Analysis (Contextual Translation, Lemmatization, Idioms, Master List filtering)
    ['analyze_with_ai']: async (message) => {
      const ai = (typeof APP_AI_CLIENT !== 'undefined') ? APP_AI_CLIENT : null;
      if (!ai) throw new Error('AIClient is not available in background worker');

      const cues = message.cues || [];
      const masterList = message.masterList || null;
      const analysis = await ai.analyzeSubtitles(cues, null, masterList);
      return { success: true, analysis };
    },

    // Master Known List handlers
    ['get_master_list']: async () => {
      const master = (typeof APP_MASTER_LIST !== 'undefined') ? APP_MASTER_LIST : null;
      if (!master) return { success: false, items: [] };
      const items = await master.load();
      return { success: true, items };
    },

    ['add_master_item']: async (message) => {
      const master = (typeof APP_MASTER_LIST !== 'undefined') ? APP_MASTER_LIST : null;
      if (!master) return { success: false };
      const res = await master.addOrAccumulate(message.item);
      return { success: true, ...res };
    },

    ['remove_master_item']: async (message) => {
      const master = (typeof APP_MASTER_LIST !== 'undefined') ? APP_MASTER_LIST : null;
      if (!master) return { success: false };
      const removed = await master.remove(message.identifier);
      return { success: true, removed };
    },

    // Test 9Router API Connection
    ['test_ai_connection']: async (message) => {
      const ai = (typeof APP_AI_CLIENT !== 'undefined') ? APP_AI_CLIENT : null;
      if (!ai) throw new Error('AIClient is not available in background worker');

      const result = await ai.testConnection(message.config);
      return result;
    },

    // Robust HTTP proxy for AI endpoints (bypasses CORS / Private Network Access from extension UI tabs)
    ['ai_http_request']: async (message) => {
      const { url, apiKey, payload } = message;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey || ''}`
          },
          body: JSON.stringify(payload || {})
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          let errMsg = `Lỗi HTTP ${resp.status}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson?.error?.message) {
              errMsg = errJson.error.message;
            }
          } catch (e) {
            if (errText) errMsg += `: ${errText.slice(0, 150)}`;
          }
          return { ok: false, status: resp.status, error: errMsg };
        }

        const data = await resp.json();
        return { ok: true, status: resp.status, data };
      } catch (err) {
        let msg = err.message || 'Lỗi kết nối mạng từ background worker';
        if (msg === 'Failed to fetch') {
          msg = `Failed to fetch: Không thể kết nối tới ${url}. Vui lòng kiểm tra server AI đã bật chưa.`;
        }
        return { ok: false, status: 0, error: msg };
      }
    },

    // NLP Subtitle Vocabulary Analysis (Offline fallback)
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

    // Web Title Resolvers for accurate naming of Netflix movies & YouTube videos
    ['resolve_netflix_title']: async (message) => {
      const watchId = message.watchId;
      const title = await resolveNetflixTitleFromWeb(watchId);
      return { success: Boolean(title), title: title || '' };
    },

    ['resolve_youtube_title']: async (message) => {
      const url = message.url;
      const title = await resolveYouTubeTitleFromWeb(url);
      return { success: Boolean(title), title: title || '' };
    },

    // Batch English-to-Vietnamese word translator using Google Translate API
    ['translate_words']: async (message) => {
      const words = message.words;
      if (!Array.isArray(words) || words.length === 0) return { success: true, translations: {} };

      const results = {};
      const BATCH_SIZE = 35;

      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        try {
          const text = batch.join('\n');
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            const sentences = data?.[0] || [];
            const fullTranslated = sentences.map(s => s[0]).join('');
            const lines = fullTranslated.split('\n');
            batch.forEach((w, idx) => {
              const trans = (lines[idx] || '').trim();
              if (trans) {
                results[w.toLowerCase()] = trans.toLowerCase();
              }
            });
          }
        } catch (err) {
          console.warn('[FX Translate] Batch error:', err);
        }
      }

      return { success: true, translations: results };
    },

    // Query active tab media status for Popup & Studio
    ['get_active_media_status']: async () => {
      const inspectTab = async (tab) => {
        if (!tab || !tab.url) return null;
        const isYT = tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts/') || tab.url.includes('youtube.com/live/');
        const isNF = tab.url.includes('netflix.com/watch/');
        if (!isYT && !isNF) return null;

        let realTitle = '';

        // 1. Ask content script for active player title
        try {
          const resp = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: 'get_media_info' }, (r) => {
              if (!chrome.runtime.lastError && r && r.success && r.title) resolve(r.title);
              else resolve('');
            });
          });
          if (resp && resp.toLowerCase() !== 'netflix' && resp.toLowerCase() !== 'youtube' && !resp.startsWith('Netflix Phim #')) {
            realTitle = resp;
          }
        } catch (e) {}

        // 2. Fallback resolution for Netflix: extract watchId and fetch public HTML
        if (isNF && (!realTitle || realTitle.toLowerCase() === 'netflix' || realTitle.startsWith('Netflix Phim #'))) {
          const m = tab.url.match(/\/watch\/(\d+)/);
          if (m) {
            const webTitle = await resolveNetflixTitleFromWeb(m[1]);
            if (webTitle) realTitle = webTitle;
          }
        }

        // 3. Fallback resolution for YouTube: clean document.title or call oEmbed
        if (isYT && !realTitle) {
          const docClean = (tab.title || '').replace(/\s*-\s*YouTube.*$/i, '').trim();
          if (docClean && docClean.toLowerCase() !== 'youtube' && docClean !== 'YouTube Video') {
            realTitle = docClean;
          } else {
            const ytOembed = await resolveYouTubeTitleFromWeb(tab.url);
            if (ytOembed) realTitle = ytOembed;
          }
        }

        return {
          isMedia: true,
          platform: isNF ? 'netflix' : 'youtube',
          tabId: tab.id,
          title: realTitle || tab.title || (isNF ? 'Netflix Movie' : 'YouTube Video'),
          url: tab.url
        };
      };

      // 1. Try currently active tab first (Popup context)
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const res = await inspectTab(activeTab);
        if (res) return res;
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
          for (const tab of mediaTabs) {
            const res = await inspectTab(tab);
            if (res) return res;
          }
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

/**
 * Helper to resolve accurate Netflix movie / series title by public URL
 */
async function resolveNetflixTitleFromWeb(watchId) {
  if (!watchId) return '';
  try {
    const resp = await fetch(`https://www.netflix.com/title/${watchId}`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (resp.ok) {
      const html = await resp.text();
      // 1. Netflix public page main heading <h1>Title</h1>
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match && h1Match[1] && h1Match[1].trim() && h1Match[1].toLowerCase() !== 'netflix') {
        return h1Match[1].trim();
      }
      // 2. OpenGraph og:title
      const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogMatch && ogMatch[1] && ogMatch[1].toLowerCase() !== 'netflix') {
        return ogMatch[1].replace(/\s*[-–—|]\s*Netflix.*$/i, '').trim();
      }
      // 3. Document <title>
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const clean = titleMatch[1]
          .replace(/^Watch\s+/i, '')
          .replace(/\s*[-–—|]\s*Netflix.*$/i, '')
          .replace(/^Netflix\s*[-–—|]\s*/i, '')
          .trim();
        if (clean && clean.toLowerCase() !== 'netflix') return clean;
      }
    }
  } catch (e) {}
  return '';
}

/**
 * Helper to resolve accurate YouTube video title using YouTube oEmbed
 */
async function resolveYouTubeTitleFromWeb(url) {
  if (!url) return '';
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const resp = await fetch(oembedUrl);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.title && data.title.toLowerCase() !== 'youtube') {
        return data.title.trim();
      }
    }
  } catch (e) {}
  return '';
}

console.log('[FX English] Background Service Worker ready');
