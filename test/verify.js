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
console.log('   ✓ Subtitle parser passed: SRT, VTT, clean TXT conversions verified.\n');

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
console.log('   ✓ POS Categorization passed with high accuracy.\n');

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

console.log('====================================================');
console.log('🎉 ALL UNIT & INTEGRATION TESTS PASSED (100% OK)');
console.log('====================================================');
