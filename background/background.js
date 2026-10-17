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
  '../lib/vocabAnalyzer.js'
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
          const isYT = activeTab.url.includes('youtube.com/watch') || activeTab.url.includes('youtube.com/shorts/');
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
