/**
 * FX English - Automated Verification Test Suite
 * Tests subtitle parsing (SRT, VTT, TXT), POS separation (Noun, Verb, Adj, Adv),
 * CEFR lookups, morphological lemmatization, and Anki/CSV exports.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🚀 Running FX English Test Suite...\n');

// 1. Check Manifest and Assets
console.log('📦 1. Verifying manifest.json and icon assets...');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
assert.ok(fs.existsSync(manifestPath), 'manifest.json exists');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.name, 'FX English - Subtitle Downloader & Vocab POS Studio');
assert.strictEqual(manifest.manifest_version, 3);
assert.ok(manifest.permissions.includes('storage'), 'manifest includes storage permission');

const iconSizes = [16, 32, 48, 128, 512];
iconSizes.forEach((size) => {
  const iconPath = path.join(__dirname, '..', 'icons', `icon${size}.png`);
  assert.ok(fs.existsSync(iconPath), `icon${size}.png exists`);
  assert.ok(fs.statSync(iconPath).size > 100, `icon${size}.png is not empty`);
});
console.log('   ✓ Manifest V3 and 5 icon assets verified.\n');

// 2. Load Core Libraries
console.log('📚 2. Loading core NLP & Domain modules...');
// Mock browser globals for Node test environment
global.window = global;
global.self = global;

const nlpModule = require('../lib/compromise.js');
global.nlp = nlpModule;
global.window.nlp = nlpModule;
assert.ok(typeof global.nlp === 'function', 'compromise nlp library loaded');

const parser = require('../lib/subtitleParser.js');
global.APP_SUBTITLE_PARSER = parser;
assert.ok(parser, 'subtitleParser loaded');

const dict = require('../lib/cefrDict.js');
global.APP_CEFR_DICT = dict;
assert.ok(dict, 'cefrDict loaded');

const analyzer = require('../lib/vocabAnalyzer.js');
global.APP_VOCAB_ANALYZER = analyzer;
assert.ok(analyzer, 'vocabAnalyzer loaded');
console.log('   ✓ All 4 core libraries loaded successfully.\n');

// 3. Test Subtitle Parser
console.log('🎬 3. Testing Universal Subtitle Parser (SRT, VTT, TXT)...');
const sampleSrt = `1
00:00:01,500 --> 00:00:04,200
Learning English through <i>movies</i> is <b>fascinating</b> and effective.

2
00:00:05,000 --> 00:00:08,800
The young astronomer discovered a mysterious ancient map softly.
`;

const cues = parser.parse(sampleSrt);
assert.strictEqual(cues.length, 2, 'Parsed exactly 2 cues');
assert.strictEqual(cues[0].startSec, 1.5, 'Start timestamp parsed correctly');
assert.strictEqual(cues[0].endSec, 4.2, 'End timestamp parsed correctly');
assert.ok(!cues[0].cleanText.includes('<i>'), 'HTML tags stripped from cue text');
assert.ok(cues[0].cleanText.includes('fascinating'), 'Cue text content intact');

// Test format conversions
const srtOutput = parser.toSRT(cues);
assert.ok(srtOutput.includes('00:00:01,500 --> 00:00:04,200'), 'Formatted valid SRT');

const vttOutput = parser.toWebVTT(cues);
assert.ok(vttOutput.startsWith('WEBVTT'), 'Formatted valid WebVTT');
assert.ok(vttOutput.includes('00:00:01.500 --> 00:00:04.200'), 'VTT timestamp uses dot separator');

const txtOutput = parser.toReadableTranscript(cues);
assert.ok(txtOutput.includes('Learning English through movies is fascinating and effective.'), 'Clean transcript TXT formatted');

// Test YouTube TimedText format="3" XML parsing
const sampleYtXml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<body>
<p t="18640" d="3240">♪ We&#39;re no strangers to love ♪</p>
<p t="22640" d="4320">♪ You know the rules and so do I ♪</p>
</body>
</timedtext>`;
const ytCues = parser.parse(sampleYtXml);
assert.strictEqual(ytCues.length, 2, 'Parsed 2 YouTube format 3 cues');
assert.strictEqual(ytCues[0].startSec, 18.64, 'YouTube cue start parsed correctly in seconds');
assert.strictEqual(ytCues[0].cleanText, "♪ We're no strangers to love ♪", 'YouTube cue text and entities cleaned');

// Test Netflix TTML / DFXP XML with ttp:tickRate and ticks "t"
const sampleNetflixTtml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000" ttp:frameRate="24">
<body>
  <div>
    <p begin="186400000t" end="218800000t">
      <span>Learning English with Netflix is extraordinary.</span>
    </p>
    <p begin="00:01:23:12" end="00:01:26:00">
      <span>The scholar discovered an ancient secret map.<br/>He smiled warmly.</span>
    </p>
  </div>
</body>
</tt>`;
const nfCues = parser.parse(sampleNetflixTtml);
assert.strictEqual(nfCues.length, 2, 'Parsed 2 Netflix TTML cues');
assert.strictEqual(nfCues[0].startSec, 18.64, 'Netflix tickRate 10M converted 186400000t to 18.64s');
assert.strictEqual(nfCues[0].endSec, 21.88, 'Netflix tickRate 10M converted 218800000t to 21.88s');
assert.strictEqual(nfCues[1].startSec, 83.5, 'Netflix frame format 00:01:23:12 converted to 83.5s');
assert.ok(nfCues[1].cleanText.includes('ancient secret map. He smiled warmly'), 'BR tag cleaned properly into space');

console.log('   ✓ Subtitle parser passed: SRT, VTT, YouTube TimedText XML, Netflix TTML/DFXP, clean TXT verified.\n');

// 4. Test Offline CEFR Dictionary
console.log('📖 4. Testing Offline CEFR Dictionary & Morphology...');
const testWords = [
  { word: 'fascinating', expCefr: 'B2', hasTrans: true },
  { word: 'astronomer', expCefr: 'B2', hasTrans: true },
  { word: 'mysterious', expCefr: 'B2', hasTrans: true },
  { word: 'ancient', expCefr: 'B1', hasTrans: true },
  { word: 'effective', expCefr: 'B1', hasTrans: true }
];

testWords.forEach(({ word, expCefr, hasTrans }) => {
  const entry = dict.lookup(word);
  assert.ok(entry, `Entry found for "${word}"`);
  assert.ok(entry.ipa, `IPA phonetic exists for "${word}": ${entry.ipa}`);
  if (hasTrans) {
    assert.ok(entry.vi, `Vietnamese meaning exists for "${word}": ${entry.vi}`);
  }
  if (expCefr) {
    assert.strictEqual(entry.cefr, expCefr, `CEFR matches for "${word}" (got ${entry.cefr}, expected ${expCefr})`);
  }
});

// Morphology fallback test (plural 'astronomers' -> 'astronomer')
const pluralLookup = dict.lookup('astronomers');
assert.ok(pluralLookup, 'Plural word morphology lookup succeeded');
assert.ok(pluralLookup.vi.includes('thiên văn'), 'Meaning retrieved via morphological fallback');
console.log('   ✓ CEFR dictionary passed: IPA, Vietnamese definitions & morphology verified.\n');

// 5. Test POS Vocabulary Analyzer (4 Types: Noun, Verb, Adj, Adv)
console.log('⚡ 5. Testing POS Categorizer (Danh, Động, Tính, Trạng)...');
const analysis = analyzer.analyzeSubtitles(cues);
assert.ok(analysis.categories, 'Analysis categories generated');

const { noun, verb, adjective, adverb } = analysis.categories;

console.log(`   - 📘 Danh từ (Nouns): ${noun.count} words`);
console.log(`   - 📙 Động từ (Verbs): ${verb.count} words`);
console.log(`   - 📗 Tính từ (Adjectives): ${adjective.count} words`);
console.log(`   - 📕 Trạng từ (Adverbs): ${adverb.count} words`);

assert.ok(noun.count > 0, 'Extracted nouns');
assert.ok(verb.count > 0, 'Extracted verbs');
assert.ok(adjective.count > 0, 'Extracted adjectives');
assert.ok(adverb.count > 0, 'Extracted adverbs');

// Verify POS classification accuracy on test sentence:
// "The young astronomer discovered a mysterious ancient map softly."
const nounWords = noun.words.map(w => w.word);
const verbWords = verb.words.map(w => w.word);
const adjWords = adjective.words.map(w => w.word);
const advWords = adverb.words.map(w => w.word);

assert.ok(nounWords.includes('astronomer') || nounWords.includes('map') || nounWords.includes('movie') || nounWords.includes('movies'), 'Identified nouns');
assert.ok(verbWords.includes('discover') || verbWords.includes('discovered') || verbWords.includes('learn'), 'Identified verbs');
assert.ok(adjWords.includes('fascinating') || adjWords.includes('mysterious') || adjWords.includes('ancient') || adjWords.includes('young') || adjWords.includes('effective'), 'Identified adjectives');
assert.ok(advWords.includes('softly') || advWords.includes('through'), 'Identified adverbs');

// Verify auxiliary filter (e.g. 'is' should be filtered out)
assert.ok(!verbWords.includes('is'), 'Auxiliary verb "is" was properly filtered');

// Verify 'there' is classified as adverb and NEVER as noun
const testCues = [
  { startSec: 1, endSec: 3, text: 'There is an ancient car over there.' }
];
const testAnalysis = analyzer.analyzeSubtitles(testCues);
const testNouns = testAnalysis.categories.noun.words.map(w => w.word);
const testAdverbs = testAnalysis.categories.adverb.words.map(w => w.word);
assert.ok(testAdverbs.includes('there'), '"there" must be classified as an adverb');
assert.ok(!testNouns.includes('there'), '"there" must NEVER be classified as a noun');
assert.ok(!testNouns.includes('this'), '"this" pronoun must NEVER be classified as a noun');
console.log('   ✓ POS Categorization passed with high accuracy (verified "there" is adverb, zero noun leak).\n');

// 6. Test Anki & CSV Export Formats
console.log('🗂️ 6. Testing Anki & CSV Exporters...');
const sampleWordList = [
  noun.words[0] || { word: 'astronomer', pos: 'noun', cefr: 'B2', frequency: 2, ipa: '/əˈstrɒnəmə/', vietnamese: 'nhà thiên văn học', contexts: [{ text: 'The young astronomer discovered a mysterious map.' }] },
  adjective.words[0] || { word: 'fascinating', pos: 'adjective', cefr: 'B2', frequency: 1, ipa: '/ˈfæsɪneɪtɪŋ/', vietnamese: 'hấp dẫn, lôi cuốn', contexts: [{ text: 'Learning English is fascinating.' }] }
];

const ankiDeck = analyzer.exportToAnkiFormat(sampleWordList);
assert.ok(ankiDeck.includes('#separator:Tab'), 'Anki header specifies Tab separator');
assert.ok(ankiDeck.includes('#html:true'), 'Anki header enables HTML rendering');
assert.ok(ankiDeck.includes('fascinating') || ankiDeck.includes('astronomer'), 'Anki contains word');

const csvExport = analyzer.exportToCsvFormat(sampleWordList);
assert.ok(csvExport.startsWith('"Từ vựng","Loại từ"'), 'CSV header is well-formed');
assert.ok(csvExport.includes('fascinating') || csvExport.includes('astronomer'), 'CSV contains target word');
console.log('   ✓ Anki and CSV export formatting verified.\n');

// 7. Testing Scanned Movie & Video History Data Architecture
console.log('📂 7. Testing Scanned History Data Architecture...');
const mockHistory = [];
const mockMovieAnalysis = analyzer.analyzeSubtitles(cues);

function isGenericTitle(str) {
  if (!str) return true;
  const lower = String(str).trim().toLowerCase();
  return (
    lower === 'netflix' ||
    lower === 'netflix movie' ||
    lower === 'netflix video' ||
    lower === 'youtube' ||
    lower === 'youtube video' ||
    lower === 'không tên' ||
    lower === 'movie' ||
    lower === 'movie_sample' ||
    lower === 'fx_vocab' ||
    lower === 'video đang phát'
  );
}

function saveToMockHistory(history, item) {
  let updated = history.filter((h) => {
    if (item.url && h.url) {
      return h.url !== item.url;
    }
    if (!item.url && !h.url) {
      if (!isGenericTitle(item.title) && h.title === item.title) {
        return false;
      }
    }
    return true;
  });
  updated.unshift(item);
  return updated.slice(0, 50);
}

const item1 = {
  id: 'scan_yt_1',
  title: 'English Lesson 101',
  platform: 'youtube',
  url: 'https://www.youtube.com/watch?v=mock123',
  timestamp: Date.now(),
  dateFormatted: '17/10/2026, 23:00',
  wordCount: mockMovieAnalysis.totals.uniqueWords,
  nounCount: mockMovieAnalysis.categories.noun.count,
  verbCount: mockMovieAnalysis.categories.verb.count,
  adjCount: mockMovieAnalysis.categories.adjective.count,
  advCount: mockMovieAnalysis.categories.adverb.count,
  cues: cues,
  analysis: mockMovieAnalysis
};

let currentHistory = saveToMockHistory(mockHistory, item1);
assert.strictEqual(currentHistory.length, 1, 'History has 1 item');
assert.strictEqual(currentHistory[0].platform, 'youtube', 'Platform correctly tagged as youtube');
assert.strictEqual(currentHistory[0].advCount, 1, 'Adverb count stored correctly');

// Re-saving same URL updates and deduplicates
const item1Updated = { ...item1, wordCount: 99 };
currentHistory = saveToMockHistory(currentHistory, item1Updated);
assert.strictEqual(currentHistory.length, 1, 'Deduplication works when scanning same URL');
assert.strictEqual(currentHistory[0].wordCount, 99, 'Item updated to latest stats');

// Scanning 2 different movies on Netflix (both titled 'Netflix' or with watch IDs) PRESERVES BOTH
const nfMovie1 = {
  id: 'scan_nf_1',
  title: 'Netflix',
  platform: 'netflix',
  url: 'https://www.netflix.com/watch/80057281',
  timestamp: Date.now() - 1000,
  wordCount: 500
};
const nfMovie2 = {
  id: 'scan_nf_2',
  title: 'Netflix',
  platform: 'netflix',
  url: 'https://www.netflix.com/watch/80186931',
  timestamp: Date.now(),
  wordCount: 750
};

let nfHistory = saveToMockHistory([], nfMovie1);
assert.strictEqual(nfHistory.length, 1, 'First Netflix movie saved');
nfHistory = saveToMockHistory(nfHistory, nfMovie2);
assert.strictEqual(nfHistory.length, 2, 'Second Netflix movie preserved, NOT overwritten even if title is "Netflix"!');

console.log('   ✓ Scanned history model & multi-movie deduplication logic verified.\n');

// 8. Testing Real-World Subtitle POS Analysis with Repeated Lexemes
console.log('⚡ 8. Testing Real-World Subtitle POS Multi-Pass Lexemes...');
const testParagraph = [
  { startSec: 1, endSec: 4, text: "I've been living in a Tesla for 2 years without rent." },
  { startSec: 4, endSec: 8, text: "Living here is cheap, but rent in the city is high." },
  { startSec: 8, endSec: 12, text: "He lived there, smiled warmly, and drove fast." }
];
const testMultiPassAnalysis = analyzer.analyzeSubtitles(testParagraph);
assert.ok(testMultiPassAnalysis.totals.uniqueWords > 0, 'Unique words counted');
assert.ok(testMultiPassAnalysis.categories.noun.count > 0, 'Extracted nouns without scope errors');
assert.ok(testMultiPassAnalysis.categories.verb.count > 0, 'Extracted verbs without scope errors');
assert.ok(testMultiPassAnalysis.categories.adverb.count > 0, 'Extracted adverbs without scope errors');
console.log('   ✓ Multi-pass repeated lexeme analysis passed without ReferenceErrors.\n');

// 9. Testing Neon Serverless Database Client
console.log('☁️ 9. Testing Neon Serverless Database Client...');
const neonClient = require('../lib/neonClient.js');
assert.ok(neonClient, 'neonClient loaded successfully');
assert.strictEqual(typeof neonClient.queryDirect, 'function', 'queryDirect method exists');
assert.strictEqual(typeof neonClient.saveMovie, 'function', 'saveMovie method exists');
assert.strictEqual(typeof neonClient.getMovies, 'function', 'getMovies method exists');

(async () => {
  try {
    const health = await neonClient.checkHealth();
    assert.ok(health.ok, 'Neon database connection is healthy');
    console.log('   ✓ Neon health check passed (Connected to host: ' + health.host + ')');

    const testId = 'verify_test_' + Date.now();
    const testMovie = {
      id: testId,
      title: 'Neon Integration Test Video',
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=neon_test_verify',
      timestamp: Date.now(),
      dateFormatted: '17/10/2026, 23:40',
      wordCount: 12,
      nounCount: 4,
      verbCount: 3,
      adjCount: 3,
      advCount: 2,
      cues: [{ startSec: 0, endSec: 3, text: 'Hello Neon PostgreSQL world' }],
      analysis: testMultiPassAnalysis
    };

    const saved = await neonClient.saveMovie(testMovie);
    assert.ok(saved, 'Movie saved to Neon');
    assert.strictEqual(saved.id, testId, 'Saved movie has matching ID');
    assert.strictEqual(saved.title, testMovie.title, 'Saved movie has matching title');
    assert.strictEqual(saved.nounCount, 4, 'Saved movie has matching noun count');
    assert.ok(saved.analysis, 'Saved movie includes full analysis JSONB');

    const movies = await neonClient.getMovies(10);
    assert.ok(Array.isArray(movies), 'getMovies returns an array');
    const retrieved = movies.find(m => m.id === testId);
    assert.ok(retrieved, 'Retrieved saved movie from Neon');

    const deleted = await neonClient.deleteMovie(testId);
    assert.ok(deleted, 'Cleaned up test movie from Neon');
    console.log('   ✓ Full Neon CRUD cycle verified (saveMovie, getMovies, deleteMovie).\n');

    console.log('====================================================');
    console.log('🎉 ALL UNIT & INTEGRATION TESTS PASSED (100% OK)');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Neon Integration Test Error:', err);
    process.exit(1);
  }
})();


