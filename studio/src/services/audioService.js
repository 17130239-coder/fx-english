/**
 * FX English - Audio & Pronunciation Service
 * Manages text-to-speech pronunciation using Web Speech API with rate and voice controls.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_AUDIO_SERVICE = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class AudioService {
    constructor() {
      this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
      this.preferredVoice = null;
      this.rate = 0.95;
      if (this.isSupported) {
        this._initVoices();
      }
    }

    _initVoices() {
      const update = () => {
        const voices = window.speechSynthesis.getVoices();
        // Prefer US English natural or standard voices
        this.preferredVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))) ||
                              voices.find(v => v.lang === 'en-US') ||
                              voices.find(v => v.lang.startsWith('en')) ||
                              null;
      };
      update();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = update;
      }
    }

    /**
     * Pronounce a word or sentence in English
     * @param {string} text
     * @param {number} [customRate]
     */
    speak(text, customRate = null) {
      if (!this.isSupported || !text) return;

      try {
        window.speechSynthesis.cancel(); // Stop any pending utterance
        const clean = String(text).replace(/<[^>]+>/g, ' ').trim();
        if (!clean) return;

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'en-US';
        utterance.rate = (typeof customRate === 'number') ? customRate : this.rate;

        if (this.preferredVoice) {
          utterance.voice = this.preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[FX Audio] Speech synthesis notice:', err);
      }
    }

    /**
     * Immediately stop speech playback
     */
    stop() {
      if (!this.isSupported) return;
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  return new AudioService();
});
