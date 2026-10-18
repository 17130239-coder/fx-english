/**
 * FX English - Core Domain Types & Shared Constants
 * Single Source of Truth for Parts of Speech (POS), CEFR Levels, and Media Platforms.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_TYPES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Standard Part of Speech (POS) Identifiers
   */
  const POS = Object.freeze({
    NOUN: 'noun',
    VERB: 'verb',
    ADJECTIVE: 'adjective',
    ADVERB: 'adverb',
    PHRASE: 'phrase',
    PATTERN: 'pattern',
    SENTENCES: 'phrase', // Backward compatibility
    ALL: 'all',
    STARRED: 'starred'
  });

  /**
   * Vietnamese Display Labels for POS
   */
  const POS_LABELS_VI = Object.freeze({
    [POS.NOUN]: 'Danh từ',
    [POS.VERB]: 'Động từ',
    [POS.ADJECTIVE]: 'Tính từ',
    [POS.ADVERB]: 'Trạng từ',
    [POS.PHRASE]: 'Cụm từ',
    [POS.PATTERN]: 'Cấu trúc câu',
    [POS.STARRED]: 'Đã lưu'
  });

  /**
   * Compact POS Codes used in AI Prompts and Master List
   */
  const POS_CODES = Object.freeze({
    'N': POS.NOUN,
    'V': POS.VERB,
    'Adj': POS.ADJECTIVE,
    'Adv': POS.ADVERB,
    'Phrase': POS.PHRASE,
    'Pattern': POS.PATTERN,
    'Idiom': POS.PHRASE
  });

  /**
   * CEFR Levels
   */
  const CEFR_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

  /**
   * Spaced Repetition (SRS) Rating Definitions
   */
  const SRS_RATINGS = Object.freeze({
    AGAIN: 1, // 1 minute
    HARD: 2,  // 10 minutes
    GOOD: 3,  // 1 day
    EASY: 4   // 4 days
  });

  /**
   * Map any POS string or code to standard POS identifier
   * @param {string} raw
   * @returns {string}
   */
  function normalizePos(raw) {
    if (!raw) return POS.NOUN;
    const clean = String(raw).trim().toLowerCase();
    if (clean === 'n' || clean === 'noun') return POS.NOUN;
    if (clean === 'v' || clean === 'verb') return POS.VERB;
    if (clean === 'adj' || clean === 'adjective') return POS.ADJECTIVE;
    if (clean === 'adv' || clean === 'adverb') return POS.ADVERB;
    if (clean === 'pattern' || clean === 'sentence_structure' || clean === 'structure') return POS.PATTERN;
    if (clean === 'phrase' || clean === 'phrasal_verb' || clean === 'collocation' || clean === 'idiom' || clean === 'slang' || clean === 'sentences') return POS.PHRASE;
    return POS.NOUN;
  }

  /**
   * Get localized Vietnamese label for a POS
   * @param {string} pos
   * @returns {string}
   */
  function getPosLabelVi(pos) {
    const std = normalizePos(pos);
    return POS_LABELS_VI[std] || 'Từ vựng';
  }

  return {
    POS,
    POS_LABELS_VI,
    POS_CODES,
    CEFR_LEVELS,
    SRS_RATINGS,
    normalizePos,
    getPosLabelVi
  };
});
