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
    baseUrl: (typeof process !== 'undefined' && process.env?.AI_BASE_URL) || 'http://localhost:20128/v1',
    apiKey: (typeof process !== 'undefined' && process.env?.AI_API_KEY) || '',
    model: (typeof process !== 'undefined' && process.env?.AI_MODEL) || 'ag/gemini-3.8-flash-low'
  };

  const STORAGE_KEY = 'fx_ai_config';

  const SYSTEM_PROMPT = `You are an elite linguistic engine and lexicographer specialized in movie/TV dialogue subtitle analysis for English learners.
Analyze the provided subtitle dialogue items, cross-reference with \`userKnownWords\` (if provided), and return ONLY a valid, raw JSON object matching the exact schema below. Do not wrap in markdown code blocks unless requested.

CORE LINGUISTIC RULES:
1. LEMMATIZATION & CANONICAL FORMS:
   - Convert inflected tokens to lowercase base dictionary lemmas (e.g., 'ran' -> 'run', 'phenomena' -> 'phenomenon').
   - For phrasal verbs, extract the canonical infinitive (e.g., 'broke down' -> 'break down').
   - Deduplicate lemmas and sum frequencies.
2. ACCURATE POS & DISAMBIGUATION:
   - Classify based on the ACTUAL syntactic function in the specific movie context:
     * N (Noun): Exclude pronouns ('this', 'someone'), determiners, and character proper names.
     * V (Verb): Exclude auxiliary/modal verbs ('is', 'have', 'would', 'can').
     * Adj (Adjective): Correctly classify participle adjectives ('a broken heart' -> Adj 'broken').
     * Adv (Adverb): Correctly identify adverbs and adverbial particles ('there', 'suddenly', 'away').
3. NATURAL CONTEXTUAL VIETNAMESE MEANING:
   - Provide a natural, idiomatic Vietnamese translation (1-4 words, maximum 5 words) matching the exact nuance of the movie quote.
   - Avoid robotic word-by-word machine translations.
4. MASTER LIST & POLYSEMY RESOLUTION (CRITICAL):
   - Compare the contextual meaning of each candidate word with the \`knownMeanings\` in \`userKnownWords\`.
   - Semantic Equivalence: Treat meanings as THE SAME if they are synonyms, paraphrases, or closely related nuances (e.g., 'relax' vs 'rest'). OMIT the word completely.
   - New Semantic Sense: ONLY treat as DIFFERENT if it represents a distinct semantic sense, lexical domain, or metaphor (e.g., 'bank' as river bank vs financial institution; 'book' as novel vs reserve a ticket). INCLUDE with "isNewMeaning": true.
   - For words not in \`userKnownWords\`, include with "isNewMeaning": false.
5. HIGHLIGHTS (IDIOMS, PHRASAL VERBS, SLANG):
   - Extract natural colloquial idioms, phrasal verbs, slang, or conversational chunks from dialogue quotes.
   - Categorize each as: "phrasal_verb" | "idiom" | "slang" | "collocation".

FEW-SHOT DEMONSTRATIONS:
- Example 1:
  Word: "bank", Quote: "We set up camp on the muddy bank of the river."
  User known: { "bank": ["ngân hàng"] }
  -> Result: Include "bank", pos: "N", meaningVi: "bờ sông", isNewMeaning: true.
- Example 2:
  Word: "plant", Quote: "He watered the green plant in his room."
  User known: { "plant": ["cây cối"] }
  -> Result: OMIT (Same semantic meaning).

OUTPUT JSON SCHEMA:
{
  "vocabulary": [
    {
      "word": "string (base lemma, lowercase)",
      "originalForm": "string (exact word matched in the quote for highlighting)",
      "pos": "N" | "V" | "Adj" | "Adv",
      "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "ipa": "string (US IPA, e.g. /əˈstrɒnəmər/)",
      "meaningVi": "string (concise, natural contextual Vietnamese, 1-4 words)",
      "contextSentence": "string (original movie quote)",
      "frequency": number,
      "isNewMeaning": boolean
    }
  ],
  "highlights": [
    {
      "phrase": "string (canonical phrase, e.g. 'break down')",
      "category": "phrasal_verb" | "idiom" | "slang" | "collocation",
      "meaningVi": "string",
      "contextSentence": "string",
      "nuance": "string (short Vietnamese explanation)"
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
              apiKey: (parsed.apiKey && String(parsed.apiKey).trim()) || DEFAULT_CONFIG.apiKey,
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
                apiKey: (res.fxAiConfig.apiKey && String(res.fxAiConfig.apiKey).trim()) || DEFAULT_CONFIG.apiKey,
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
      const rawBase = (newConfig.baseUrl && String(newConfig.baseUrl).trim()) || DEFAULT_CONFIG.baseUrl;
      const baseUrl = this.normalizeBaseUrl(rawBase);
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
     * Normalizes base URL, automatically ensuring standard /v1 suffix if missing.
     * @param {string} url
     * @returns {string}
     */
    normalizeBaseUrl(url) {
      if (!url) return DEFAULT_CONFIG.baseUrl;
      let trimmed = String(url).trim().replace(/\/+$/, '');
      if (!trimmed.endsWith('/v1') && !trimmed.includes('/v1/')) {
        trimmed = `${trimmed}/v1`;
      }
      return trimmed;
    }

    /**
     * Internal robust request dispatcher.
     * Routes via background service worker when running in extension UI (bypassing CORS / Private Network Access),
     * and falls back to direct fetch in Node.js or background worker.
     * @param {string} baseUrl
     * @param {string} apiKey
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async _requestChatCompletion(baseUrl, apiKey, payload) {
      const normalizedBase = this.normalizeBaseUrl(baseUrl);
      const url = `${normalizedBase}/chat/completions`;
      const enrichedPayload = {
        stream: false,
        ...payload
      };

      // 1. If running in an extension UI page (studio, popup)
      const isExtensionPage = typeof chrome !== 'undefined' &&
        chrome.runtime &&
        typeof chrome.runtime.sendMessage === 'function' &&
        typeof importScripts === 'undefined';

      if (isExtensionPage) {
        try {
          const bgRes = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'ai_http_request',
              url: url,
              apiKey: apiKey,
              payload: enrichedPayload
            }, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ __fallback: true, error: chrome.runtime.lastError.message });
              } else {
                resolve(response);
              }
            });
          });

          if (bgRes && !bgRes.__fallback) {
            if (!bgRes.ok) {
              const err = new Error(bgRes.error || `HTTP ${bgRes.status}`);
              err.status = bgRes.status;
              throw err;
            }
            return bgRes.data;
          }
        } catch (e) {
          console.warn('[FX AIClient] Background worker dispatch notice, using direct fetch:', e);
        }
      }

      // 2. Direct fetch (Node.js test environment, Service Worker, or fallback)
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(enrichedPayload)
        });
      } catch (networkErr) {
        let msg = networkErr.message || 'Không thể kết nối đến máy chủ AI.';
        if (msg === 'Failed to fetch') {
          msg = `Failed to fetch: Không thể kết nối tới ${normalizedBase}. Vui lòng kiểm tra server AI/proxy đã được bật và cho phép kết nối.`;
        }
        const err = new Error(msg);
        err.originalError = networkErr;
        throw err;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        let message = `Lỗi HTTP ${resp.status}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson?.error?.message) {
            message = errJson.error.message;
          }
        } catch (e) {
          if (errText) message += `: ${errText.slice(0, 150)}`;
        }
        const err = new Error(message);
        err.status = resp.status;
        throw err;
      }

      return await resp.json();
    }

    /**
     * Test connection to 9router / custom OpenAI-compatible endpoint.
     * Sends a minimal completion request to verify base URL, API key, and model availability.
     * @param {Object} [testConfig]
     */
    async testConnection(testConfig = null) {
      const conf = testConfig || await this.getConfig();
      const baseUrl = this.normalizeBaseUrl(conf.baseUrl || DEFAULT_CONFIG.baseUrl);
      const apiKey = conf.apiKey ? conf.apiKey.trim() : '';
      const model = conf.model || DEFAULT_CONFIG.model;

      if (!apiKey) {
        return { ok: false, error: 'Vui lòng nhập API Key từ 9router.' };
      }

      try {
        const data = await this._requestChatCompletion(baseUrl, apiKey, {
          model: model,
          messages: [
            { role: 'user', content: 'Reply with JSON {"status":"ok"}' }
          ],
          max_tokens: 15,
          temperature: 0.1
        });

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
     * cross-references with masterList to extract userKnownWords for each batch,
     * and divides them into batches of 60–80 words for parallel execution.
     * @param {Array<Object>} cues
     * @param {number} [batchSize=70]
     * @param {Object|Array} [masterList=null]
     * @returns {Array<Object>} Array of chunk objects
     */
    prepareSubtitleChunks(cues = [], batchSize = 70, masterList = null) {
      if (!Array.isArray(cues) || cues.length === 0) {
        return [];
      }

      // Resolve master list instance if available
      let resolvedMaster = masterList;
      if (!resolvedMaster && typeof APP_MASTER_LIST !== 'undefined') {
        resolvedMaster = APP_MASTER_LIST;
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

        // Client-side pre-filtering against master list to save tokens (~95% savings)
        let userKnownWords = [];
        if (resolvedMaster && typeof resolvedMaster.extractKnownWordsForBatch === 'function') {
          userKnownWords = resolvedMaster.extractKnownWordsForBatch(slice);
        } else if (Array.isArray(resolvedMaster) && resolvedMaster.length > 0) {
          const sliceSet = new Set();
          slice.forEach((s) => {
            const w = (s.lower || s.word || '').toLowerCase();
            sliceSet.add(w);
            if (w.endsWith('ies')) sliceSet.add(w.slice(0, -3) + 'y');
            if (w.endsWith('ves')) {
              sliceSet.add(w.slice(0, -3) + 'f');
              sliceSet.add(w.slice(0, -3) + 'fe');
            }
            if (w.endsWith('es')) sliceSet.add(w.slice(0, -2));
            if (w.endsWith('s')) sliceSet.add(w.slice(0, -1));
            if (w.endsWith('ing')) sliceSet.add(w.slice(0, -3));
            if (w.endsWith('ed')) {
              sliceSet.add(w.slice(0, -2));
              sliceSet.add(w.slice(0, -1));
            }
          });
          userKnownWords = resolvedMaster
            .filter((item) => item && sliceSet.has((item.text || '').toLowerCase()))
            .map((item) => ({ word: item.text, knownMeanings: item.knownMeanings || [] }));
        }

        chunks.push({
          batchIndex: chunks.length + 1,
          words: slice.map((c) => ({
            word: c.word,
            frequency: c.frequency,
            context: c.context,
            startSec: c.startSec,
            startTime: c.startTime
          })),
          userKnownWords: userKnownWords,
          sampleQuotes: chunks.length === 0 ? sampleQuotes : [] // Provide quotes to primary chunk
        });
      }

      return chunks;
    }

    /**
     * Executes parallel batch AI analysis via 9router with concurrency control (concurrency = 3).
     * @param {Array<Object>} cues
     * @param {Function} [onProgress] Progress callback (current, total, message)
     * @param {Object|Array} [masterList=null] Optional master list for semantic cross-referencing
     * @returns {Promise<Object>} Normalized analysis object
     */
    async analyzeSubtitles(cues, onProgress = null, masterList = null) {
      const config = await this.getConfig();
      if (!config.apiKey || !config.apiKey.trim()) {
        const err = new Error('NO_API_KEY');
        err.code = 'NO_API_KEY';
        throw err;
      }

      const chunks = this.prepareSubtitleChunks(cues, 70, masterList);
      if (chunks.length === 0) {
        return this.createEmptyAnalysis();
      }

      const totalBatches = chunks.length;
      let completedBatches = 0;

      if (typeof onProgress === 'function') {
        onProgress(0, totalBatches, `Bắt đầu xử lý ${totalBatches} batch từ vựng...`);
      }

      const baseUrl = this.normalizeBaseUrl(config.baseUrl);
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
          userKnownWords: chunk.userKnownWords || [],
          sampleQuotes: chunk.sampleQuotes
        };

        const data = await this._requestChatCompletion(baseUrl, apiKey, {
          model: model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(promptData) }
          ]
        });
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
      return this.consolidateAIResults(settled, cues, masterList);
    }

    /**
     * Consolidates, deduplicates, and lemmatizes AI output into the standard analysis object.
     * Cross-references against masterList to strictly omit already known words.
     * @param {Array<Object>} settled
     * @param {Array<Object>} cues
     * @param {Object|Array} [masterList=null]
     */
    consolidateAIResults(settled, cues = [], masterList = null) {
      const vocabMap = new Map();
      const highlightMap = new Map();

      // Build known items map from masterList for deterministic deduplication
      const knownMap = new Map();
      if (masterList) {
        const items = (typeof masterList.getAll === 'function')
          ? masterList.getAll()
          : (Array.isArray(masterList) ? masterList : []);
        items.forEach((it) => {
          if (it && it.text) {
            const k = it.text.trim().toLowerCase();
            const meanings = Array.isArray(it.knownMeanings)
              ? it.knownMeanings.map((m) => String(m).trim().toLowerCase()).filter(Boolean)
              : [];
            knownMap.set(k, meanings);
          }
        });
      }

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

          const isNewMeaning = Boolean(item.isNewMeaning);
          const meaningVi = String(item.meaningVi || '').trim();

          // Deduplication against Master List:
          // If word is in master list and not explicitly a new semantic sense, OMIT IT!
          if (knownMap.has(lemma)) {
            if (!isNewMeaning) return;
            const existingMeanings = knownMap.get(lemma);
            const lowerMeaning = meaningVi.toLowerCase();
            if (existingMeanings.some((m) => m === lowerMeaning || m.includes(lowerMeaning) || lowerMeaning.includes(m))) {
              return;
            }
          }

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
            if (isNewMeaning) existing.isNewMeaning = true;
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
              isNewMeaning: isNewMeaning,
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

          const category = String(h.category || '').toLowerCase().trim();
          let displayTag = 'Câu hay';
          if (category === 'phrasal_verb') displayTag = 'Cụm động từ';
          else if (category === 'slang') displayTag = 'Tiếng lóng';
          else if (category === 'collocation') displayTag = 'Cụm từ';
          else if (category === 'idiom') displayTag = 'Thành ngữ';

          highlightMap.set(phraseKey, {
            sentence: quote || h.phrase,
            vietnamese: String(h.meaningVi || '').trim(),
            highlightPhrase: String(h.phrase || '').trim(),
            category: category || 'idiom',
            usageNote: String(h.nuance || '').trim(),
            tag: displayTag,
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
