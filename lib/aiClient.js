/**
 * FX English - 9Router AI Linguistic Engine Client
 * OpenAI-compatible endpoint integration for contextual translation,
 * smart lemmatization & deduplication, and phrasal verbs/idioms extraction.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const client = factory();
    root.APP_AI_CLIENT = client;
    root.aiClient = client;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    baseUrl: 'https://api.9router.com/v1',
    apiKey: '',
    model: 'gemini-3.8-flash'
  };

  const STORAGE_KEY = 'fx_ai_config';

  const SYSTEM_PROMPT = `You are an expert linguistic engine for a movie-based English learning platform.
Analyze the provided movie subtitle data and return ONLY a valid JSON object matching the exact schema below.

RULES:
1. LEMMATIZATION & DEDUPLICATION: Convert all inflected words to their base dictionary form (lemma). Merge duplicates (e.g., "industries" and "industry" -> "industry") and sum their frequencies.
2. NOISE REMOVAL: Exclude proper nouns, character names, interjections, and trivial stop words.
3. CONTEXTUAL VIETNAMESE MEANING: Provide a concise Vietnamese meaning (strictly 2-4 words) that fits the exact movie quote context. Do not list multiple dictionary definitions.
4. IDIOMS & PHRASAL VERBS: Extract the most natural idioms, phrasal verbs, or slang expressions from the quotes into the "highlights" array.

OUTPUT JSON SCHEMA:
{
  "vocabulary": [
    {
      "word": "string (base lemma in lowercase)",
      "originalForm": "string (exact word matched inside the quote for highlighting)",
      "pos": "N" | "V" | "Adj" | "Adv",
      "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "ipa": "string (US IPA, e.g., /ˈɪndəstri/)",
      "meaningVi": "string (concise contextual meaning in Vietnamese, 2-4 words)",
      "contextSentence": "string (the original movie quote)",
      "frequency": number
    }
  ],
  "highlights": [
    {
      "phrase": "string (idiom, phrasal verb, or slang)",
      "meaningVi": "string (Vietnamese meaning in this scene)",
      "contextSentence": "string (the original movie quote)",
      "nuance": "string (1 short sentence in Vietnamese explaining tone/usage)"
    }
  ]
}`;

  // Common high-frequency trivial stop words to ignore during pre-processing
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet',
    'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to', 'up', 'with',
    'as', 'if', 'than', 'because', 'while', 'though', 'although',
    'oh', 'ah', 'uh', 'um', 'yeah', 'yes', 'no', 'okay', 'ok', 'hey', 'hi', 'hello',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'this', 'that', 'these', 'those', 'there', 'here',
    'gonna', 'wanna', 'gotta', 'huh', 'wow', 'ooh'
  ]);

  class AIClient {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.loadConfigSync();
    }

    /**
     * Synchronously load config from localStorage if available.
     */
    loadConfigSync() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            this.config = {
              baseUrl: (parsed.baseUrl && String(parsed.baseUrl).trim()) || DEFAULT_CONFIG.baseUrl,
              apiKey: (parsed.apiKey && String(parsed.apiKey).trim()) || '',
              model: (parsed.model && String(parsed.model).trim()) || DEFAULT_CONFIG.model
            };
          }
        }
      } catch (e) {
        console.warn('[FX AIClient] LocalStorage read notice:', e);
      }
    }

    /**
     * Asynchronously loads configuration, checking chrome.storage.local if available.
     */
    async getConfig() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['fxAiConfig'], (res) => {
            if (res && res.fxAiConfig) {
              this.config = {
                baseUrl: (res.fxAiConfig.baseUrl && String(res.fxAiConfig.baseUrl).trim()) || DEFAULT_CONFIG.baseUrl,
                apiKey: (res.fxAiConfig.apiKey && String(res.fxAiConfig.apiKey).trim()) || '',
                model: (res.fxAiConfig.model && String(res.fxAiConfig.model).trim()) || DEFAULT_CONFIG.model
              };
            }
            resolve({ ...this.config });
          });
        } else {
          this.loadConfigSync();
          resolve({ ...this.config });
        }
      });
    }

    /**
     * Save configuration to localStorage and chrome.storage.local.
     * @param {Object} newConfig
     */
    async saveConfig(newConfig = {}) {
      const baseUrl = (newConfig.baseUrl && String(newConfig.baseUrl).trim()) || DEFAULT_CONFIG.baseUrl;
      const apiKey = (newConfig.apiKey && String(newConfig.apiKey).trim()) || '';
      const model = (newConfig.model && String(newConfig.model).trim()) || DEFAULT_CONFIG.model;

      this.config = { baseUrl, apiKey, model };

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        }
      } catch (e) {}

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ fxAiConfig: this.config }, () => resolve());
        });
      }

      return { ...this.config };
    }

    /**
     * Check if a valid API key is currently configured.
     */
    isConfigured() {
      return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 5);
    }

    /**
     * Test connection to 9router endpoint.
     * Sends a minimal completion request to verify both the base URL, API key, and model availability.
     * @param {Object} [testConfig]
     */
    async testConnection(testConfig = null) {
      const conf = testConfig || await this.getConfig();
      const baseUrl = (conf.baseUrl || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, '');
      const apiKey = conf.apiKey ? conf.apiKey.trim() : '';
      const model = conf.model || DEFAULT_CONFIG.model;

      if (!apiKey) {
        return { ok: false, error: 'Vui lòng nhập API Key từ 9router.' };
      }

      try {
        const url = `${baseUrl}/chat/completions`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: 'Reply with JSON {"status":"ok"}' }
            ],
            max_tokens: 15,
            temperature: 0.1
          })
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          let message = `Lỗi HTTP ${resp.status}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson?.error?.message) {
              message = errJson.error.message;
            }
          } catch (e) {
            if (errText) message += `: ${errText.slice(0, 100)}`;
          }
          return { ok: false, error: message };
        }

        const data = await resp.json();
        if (data && data.choices && data.choices.length > 0) {
          return { ok: true, message: `Kết nối thành công với ${model}!` };
        }
        return { ok: true, message: 'Kết nối 9router thành công!' };
      } catch (err) {
        return { ok: false, error: err.message || 'Không thể kết nối đến máy chủ 9router.' };
      }
    }

    /**
     * Client-side Zero-Token Pre-processing.
     * Cleans subtitle text, extracts candidate words with quotes & frequencies,
     * and divides them into batches of 60–80 words for parallel execution.
     * @param {Array<Object>} cues
     * @param {number} [batchSize=70]
     * @returns {Array<Object>} Array of chunk objects
     */
    prepareSubtitleChunks(cues = [], batchSize = 70) {
      if (!Array.isArray(cues) || cues.length === 0) {
        return [];
      }

      const candidateMap = new Map();
      const cleanQuotes = [];

      cues.forEach((cue) => {
        let text = cue.cleanText || cue.text || '';
        if (!text) return;

        // Strip any residual HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        // Strip parenthetical subtitle audio/music notes like (LAUGHS), [UPBEAT MUSIC]
        text = text.replace(/\[[^\]]+\]/g, ' ').replace(/\([^)]+\)/g, ' ');
        // Clean excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 3) return;

        cleanQuotes.push(text);

        // Word tokenization
        const tokens = text.match(/\b[a-zA-Z]{2,}(?:'[a-zA-Z]{1,2})?\b/g);
        if (!tokens) return;

        tokens.forEach((raw) => {
          const lower = raw.toLowerCase().replace(/^(?:'s|'ve|'re|'ll|'d|'m|n't)$/, '');
          if (!lower || lower.length < 2) return;
          if (STOPWORDS.has(lower)) return;

          if (candidateMap.has(lower)) {
            const existing = candidateMap.get(lower);
            existing.frequency += 1;
            // Keep the most representative sentence if current is shorter or simpler
            if (!existing.context || (existing.context.length > 120 && text.length <= 120)) {
              existing.context = text;
              existing.startSec = cue.startSec || 0;
              existing.startTime = cue.startTime || cue.start || '';
            }
          } else {
            candidateMap.set(lower, {
              word: raw,
              lower: lower,
              frequency: 1,
              context: text,
              startSec: cue.startSec || 0,
              startTime: cue.startTime || cue.start || ''
            });
          }
        });
      });

      const candidates = Array.from(candidateMap.values());
      // Sort candidates by frequency descending so the most impactful vocabulary gets analyzed first
      candidates.sort((a, b) => b.frequency - a.frequency);

      if (candidates.length === 0) {
        return [];
      }

      // Sample up to 25 conversational dialogue quotes for idiom/slang discovery
      const sampleQuotes = cleanQuotes
        .filter((q) => q.length > 12 && q.length < 130)
        .slice(0, 30);

      const chunks = [];
      for (let i = 0; i < candidates.length; i += batchSize) {
        const slice = candidates.slice(i, i + batchSize);
        chunks.push({
          batchIndex: chunks.length + 1,
          words: slice.map((c) => ({
            word: c.word,
            frequency: c.frequency,
            context: c.context,
            startSec: c.startSec,
            startTime: c.startTime
          })),
          sampleQuotes: chunks.length === 0 ? sampleQuotes : [] // Provide quotes to primary chunk
        });
      }

      return chunks;
    }

    /**
     * Executes parallel batch AI analysis via 9router with concurrency control (concurrency = 3).
     * @param {Array<Object>} cues
     * @param {Function} [onProgress] Progress callback (current, total, message)
     * @returns {Promise<Object>} Normalized analysis object
     */
    async analyzeSubtitles(cues, onProgress = null) {
      const config = await this.getConfig();
      if (!config.apiKey || !config.apiKey.trim()) {
        const err = new Error('NO_API_KEY');
        err.code = 'NO_API_KEY';
        throw err;
      }

      const chunks = this.prepareSubtitleChunks(cues, 70);
      if (chunks.length === 0) {
        return this.createEmptyAnalysis();
      }

      const totalBatches = chunks.length;
      let completedBatches = 0;

      if (typeof onProgress === 'function') {
        onProgress(0, totalBatches, `Bắt đầu xử lý ${totalBatches} batch từ vựng...`);
      }

      const baseUrl = config.baseUrl.replace(/\/+$/, '');
      const apiKey = config.apiKey.trim();
      const model = config.model || DEFAULT_CONFIG.model;

      // Concurrency runner (limit = 3)
      const CONCURRENCY_LIMIT = 3;
      const chunkResults = [];

      const worker = async (chunk) => {
        const promptData = {
          itemsToAnalyze: chunk.words.map((w) => ({
            word: w.word,
            count: w.frequency,
            quote: w.context
          })),
          sampleQuotes: chunk.sampleQuotes
        };

        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(promptData) }
            ]
          })
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`9Router API error (${resp.status}): ${errText.slice(0, 150)}`);
        }

        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content || '{}';
        let parsed = null;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          // If markdown ```json block returned
          const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (m) parsed = JSON.parse(m[1]);
          else throw new Error('Không phân tích được định dạng JSON từ model.');
        }

        completedBatches++;
        if (typeof onProgress === 'function') {
          onProgress(completedBatches, totalBatches, `Đã hoàn thành ${completedBatches}/${totalBatches} batch...`);
        }

        return { chunk, parsed };
      };

      // Run chunks with concurrency limit
      const executing = new Set();
      for (const chunk of chunks) {
        const p = Promise.resolve().then(() => worker(chunk));
        chunkResults.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        if (executing.size >= CONCURRENCY_LIMIT) {
          await Promise.race(executing);
        }
      }

      const settled = await Promise.all(chunkResults);

      // Consolidate & Deduplicate AI Results
      return this.consolidateAIResults(settled, cues);
    }

    /**
     * Consolidates, deduplicates, and lemmatizes AI output into the standard analysis object.
     * @param {Array<Object>} settled
     * @param {Array<Object>} cues
     */
    consolidateAIResults(settled, cues = []) {
      const vocabMap = new Map();
      const highlightMap = new Map();

      // Index cues for timestamp lookup
      const cueIndex = new Map();
      cues.forEach((c) => {
        const t = (c.cleanText || c.text || '').trim();
        if (t) cueIndex.set(t, c);
      });

      settled.forEach(({ chunk, parsed }) => {
        if (!parsed || typeof parsed !== 'object') return;

        // 1. Process Vocabulary
        const vocabList = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
        vocabList.forEach((item) => {
          if (!item.word || typeof item.word !== 'string') return;

          const lemma = item.word.trim().toLowerCase();
          if (!lemma || lemma.length < 2 || STOPWORDS.has(lemma)) return;

          // Map POS code ("N", "V", "Adj", "Adv") to standard pos string
          let stdPos = 'noun';
          const rawPos = String(item.pos || '').trim().toLowerCase();
          if (rawPos === 'v' || rawPos === 'verb') stdPos = 'verb';
          else if (rawPos === 'adj' || rawPos === 'adjective') stdPos = 'adjective';
          else if (rawPos === 'adv' || rawPos === 'adverb') stdPos = 'adverb';
          else stdPos = 'noun';

          const posLabelVi = this.getPosLabelVi(stdPos);
          const cefr = String(item.cefr || 'A1').trim().toUpperCase();
          const ipa = String(item.ipa || '').trim();
          const meaningVi = String(item.meaningVi || '').trim();
          const contextSentence = String(item.contextSentence || '').trim();
          const originalForm = String(item.originalForm || lemma).trim();
          const freq = Number(item.frequency) || 1;

          // Lookup timestamp if possible
          let startSec = 0;
          let startTime = '';
          if (contextSentence && cueIndex.has(contextSentence)) {
            const matched = cueIndex.get(contextSentence);
            startSec = matched.startSec || 0;
            startTime = matched.startTime || matched.start || '';
          }

          if (vocabMap.has(lemma)) {
            const existing = vocabMap.get(lemma);
            existing.frequency += freq;
            if (meaningVi && (!existing.vietnamese || existing.vietnamese === 'Đang tra nghĩa...')) {
              existing.vietnamese = meaningVi;
              existing.translation = meaningVi;
            }
            if (ipa && !existing.ipa) existing.ipa = ipa;
            if (contextSentence && !existing.contexts.some((c) => c.text === contextSentence)) {
              existing.contexts.push({
                text: contextSentence,
                startSec: startSec,
                startTime: startTime
              });
            }
          } else {
            vocabMap.set(lemma, {
              word: lemma,
              lemma: lemma,
              originalForm: originalForm,
              pos: stdPos,
              posLabelVi: posLabelVi,
              cefr: cefr,
              ipa: ipa,
              vietnamese: meaningVi,
              translation: meaningVi,
              frequency: freq,
              contexts: contextSentence ? [{ text: contextSentence, startSec, startTime }] : []
            });
          }
        });

        // 2. Process Highlights (Phrasal Verbs, Idioms, Slang)
        const hlList = Array.isArray(parsed.highlights) ? parsed.highlights : [];
        hlList.forEach((h) => {
          if (!h.phrase || typeof h.phrase !== 'string') return;
          const phraseKey = h.phrase.trim().toLowerCase();
          if (highlightMap.has(phraseKey)) return;

          let startSec = 0;
          let startTime = '';
          const quote = String(h.contextSentence || '').trim();
          if (quote && cueIndex.has(quote)) {
            const matched = cueIndex.get(quote);
            startSec = matched.startSec || 0;
            startTime = matched.startTime || matched.start || '';
          }

          highlightMap.set(phraseKey, {
            sentence: quote || h.phrase,
            vietnamese: String(h.meaningVi || '').trim(),
            highlightPhrase: String(h.phrase || '').trim(),
            usageNote: String(h.nuance || '').trim(),
            tag: 'Câu hay',
            pos: 'sentences',
            startSec: startSec,
            startTime: startTime,
            frequency: 1
          });
        });
      });

      const allWords = Array.from(vocabMap.values());
      allWords.sort((a, b) => b.frequency - a.frequency);

      const nouns = allWords.filter((w) => w.pos === 'noun');
      const verbs = allWords.filter((w) => w.pos === 'verb');
      const adjs = allWords.filter((w) => w.pos === 'adjective');
      const advs = allWords.filter((w) => w.pos === 'adverb');
      const highlights = Array.from(highlightMap.values()).slice(0, 20);

      return {
        totals: {
          totalWords: cues.length * 8, // Estimated
          uniqueWords: allWords.length,
          nounCount: nouns.length,
          verbCount: verbs.length,
          adjCount: adjs.length,
          advCount: advs.length
        },
        categories: {
          noun: { count: nouns.length, words: nouns },
          verb: { count: verbs.length, words: verbs },
          adjective: { count: adjs.length, words: adjs },
          adverb: { count: advs.length, words: advs },
          sentences: { count: highlights.length, words: highlights }
        },
        allWords: allWords,
        communicativeSentences: highlights,
        highlights: highlights
      };
    }

    getPosLabelVi(pos) {
      switch (pos) {
        case 'noun': return 'Danh từ';
        case 'verb': return 'Động từ';
        case 'adjective': return 'Tính từ';
        case 'adverb': return 'Trạng từ';
        case 'sentences': return 'Câu giao tiếp';
        default: return 'Từ vựng';
      }
    }

    createEmptyAnalysis() {
      return {
        totals: { totalWords: 0, uniqueWords: 0, nounCount: 0, verbCount: 0, adjCount: 0, advCount: 0 },
        categories: {
          noun: { count: 0, words: [] },
          verb: { count: 0, words: [] },
          adjective: { count: 0, words: [] },
          adverb: { count: 0, words: [] },
          sentences: { count: 0, words: [] }
        },
        allWords: [],
        communicativeSentences: [],
        highlights: []
      };
    }
  }

  return new AIClient();
});
