/**
 * AF English - Universal Subtitle Parser & Serializer
 * Supports: WebVTT, SRT, TTML/DFXP (Netflix IMSC1/XML), YouTube TimedText (XML & JSON3).
 * Compatible with Browser, Service Worker, and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_SUBTITLE_PARSER = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Parse timestamp string to seconds.
   * Handles:
   * - "01:23:45.678" or "01:23:45,678"
   * - "23:45.678" or "23:45,678"
   * - "123.45s" or "123450ms" or "123.45"
   * - TTML frame ticks if provided
   */
  function timeToSeconds(timeStr, options = {}) {
    if (!timeStr) return 0;
    timeStr = String(timeStr).trim();

    const tickRate = options.tickRate || 10000000;
    const frameRate = options.frameRate || 24;

    // Check ticks: "12345678t" or "12345678.5t"
    const tickMatch = timeStr.match(/^(\d+(?:\.\d+)?)t$/i);
    if (tickMatch) {
      return parseFloat(tickMatch[1]) / tickRate;
    }

    // Check millisecond unit "123450ms"
    if (/^\d+(\.\d+)?ms$/i.test(timeStr)) {
      return parseFloat(timeStr) / 1000;
    }

    // Check second unit "123.45s"
    if (/^\d+(\.\d+)?s$/i.test(timeStr)) {
      return parseFloat(timeStr);
    }

    // Pure number
    if (/^\d+(\.\d+)?$/.test(timeStr)) {
      return parseFloat(timeStr);
    }

    // Replace comma with dot
    timeStr = timeStr.replace(',', '.');

    const parts = timeStr.split(':');
    if (parts.length === 4) {
      // Clock with frames: "01:23:45:12" (HH:MM:SS:FF)
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      const frames = parseFloat(parts[3]) || 0;
      return hours * 3600 + minutes * 60 + seconds + (frames / frameRate);
    } else if (parts.length === 3) {
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else if (parts.length === 1) {
      return parseFloat(parts[0]) || 0;
    }

    return 0;
  }

  /**
   * Convert seconds to timestamp string.
   * @param {number} seconds
   * @param {boolean} isSrt - True for SRT (00:00:00,000), False for VTT (00:00:00.000)
   */
  function secondsToTimestamp(seconds, isSrt = false) {
    const totalSec = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const millis = Math.floor((totalSec - Math.floor(totalSec)) * 1000);

    const separator = isSrt ? ',' : '.';
    const h = String(hrs).padStart(2, '0');
    const m = String(mins).padStart(2, '0');
    const s = String(secs).padStart(2, '0');
    const ms = String(millis).padStart(3, '0');

    return `${h}:${m}:${s}${separator}${ms}`;
  }

  /**
   * Format friendly display time (e.g. "01:24" or "1:02:15")
   */
  function formatDisplayTime(seconds) {
    const totalSec = Math.max(0, Math.floor(Number(seconds) || 0));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Smart normalization of text:
   * - Strips music notes (♪, ♫, #)
   * - Strips surrounding quote marks and trailing dangling commas
   * - Converts all-caps text (SDH / shouting captions) to natural Sentence case
   */
  function normalizeSentenceCase(text) {
    if (!text) return '';
    let str = String(text).trim();
    // Strip music notes & non-speech symbols
    str = str.replace(/[♪♫#]/g, '').trim();
    // Strip surrounding quotes
    str = str.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    // Strip trailing commas/semicolons
    str = str.replace(/[,;]+$/, '').trim();
    str = str.replace(/\s+/g, ' ');

    // Check if text is predominantly uppercase (>65% of letters are uppercase)
    const letters = str.replace(/[^a-zA-Z]/g, '');
    const upper = str.replace(/[^A-Z]/g, '');
    if (letters.length >= 3 && (upper.length / letters.length) > 0.65) {
      str = str.toLowerCase();
      // Capitalize first letter of each sentence
      str = str.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
      // Capitalize standalone pronoun 'I'
      str = str.replace(/\b(i)\b/g, 'I');
      // Capitalize standard contractions with I (I'm, I'll, I've, I'd)
      str = str.replace(/\bi'([a-z]+)\b/g, (_, p1) => "I'" + p1);
    }
    return str;
  }

  /**
   * Strip HTML/VTT tags, speaker prefixes, sound effects.
   */
  function cleanCueText(text) {
    if (!text) return '';
    let cleaned = String(text)
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Strip VTT tags like <c.yellow>, <v Speaker>, <b>, </i>, <00:01:23.456>
      .replace(/<[^>]+>/g, ' ')
      // Strip zero-width & non-printable characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Strip music notes
      .replace(/[♪♫#]/g, ' ')
      // Strip Netflix sound effect cues in uppercase or brackets, e.g. [theme music playing], (laughter)
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/\([^)]+\)/g, ' ')
      // Strip speaker prefixes like "JOHN: ", ">> ", "- "
      .replace(/^[A-Z0-9_\s]{2,15}:\s*/gm, '')
      .replace(/^>>\s*/gm, '')
      .replace(/^-\s*/gm, '')
      // Normalize line breaks & whitespace
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();

    return normalizeSentenceCase(cleaned);
  }

  /**
   * Parse WebVTT formatted string into cues.
   */
  function parseWebVTT(vttText) {
    const cues = [];
    if (!vttText) return cues;

    // Normalize newlines
    const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let i = 0;

    // Skip WEBVTT header & metadata blocks (STYLE, NOTE, REGION)
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === 'WEBVTT' || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          i++;
        }
      } else {
        break;
      }
    }

    const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;

    let currentCue = null;

    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentCue && currentCue.rawText) {
          currentCue.text = currentCue.rawText.trim();
          currentCue.cleanText = cleanCueText(currentCue.text);
          if (currentCue.cleanText) {
            cues.push(currentCue);
          }
          currentCue = null;
        }
        continue;
      }

      const match = line.match(timeRegex);
      if (match) {
        // If there was a preceding identifier line, we overwrite
        if (currentCue && currentCue.rawText) {
          currentCue.text = currentCue.rawText.trim();
          currentCue.cleanText = cleanCueText(currentCue.text);
          if (currentCue.cleanText) cues.push(currentCue);
        }

        const startSec = timeToSeconds(match[1]);
        const endSec = timeToSeconds(match[2]);

        currentCue = {
          index: cues.length + 1,
          start: secondsToTimestamp(startSec, false),
          end: secondsToTimestamp(endSec, false),
          startSec: startSec,
          endSec: endSec,
          rawText: ''
        };
      } else if (currentCue) {
        currentCue.rawText += (currentCue.rawText ? ' ' : '') + line;
      }
    }

    if (currentCue && currentCue.rawText) {
      currentCue.text = currentCue.rawText.trim();
      currentCue.cleanText = cleanCueText(currentCue.text);
      if (currentCue.cleanText) cues.push(currentCue);
    }

    return cues;
  }

  /**
   * Parse SRT (SubRip) formatted string.
   */
  function parseSRT(srtText) {
    // SRT and WebVTT cue time matching is virtually identical with timeToSeconds handling ',' and '.'
    return parseWebVTT(srtText);
  }

  /**
   * Parse TTML / DFXP / XML (Netflix timed text).
   */
  function parseTTML(xmlText) {
    const cues = [];
    if (!xmlText) return cues;

    // 1. Detect tickRate & frameRate from root <tt> or <head>
    let tickRate = 1;
    const tickRateMatch = xmlText.match(/\b(?:ttp:)?tickRate=["'](\d+)["']/i);
    if (tickRateMatch) {
      tickRate = parseInt(tickRateMatch[1], 10) || 1;
    } else if (/\bbegin=["']\d+t["']/i.test(xmlText)) {
      // Netflix standard default tick rate is 10,000,000 (10M ticks per second)
      tickRate = 10000000;
    }

    let frameRate = 24;
    const frameRateMatch = xmlText.match(/\b(?:ttp:)?frameRate=["'](\d+)["']/i);
    if (frameRateMatch) {
      frameRate = parseInt(frameRateMatch[1], 10) || 24;
    }

    const timingOpts = { tickRate, frameRate };

    // Extract all <p ...>...</p> subtitle cues
    const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = pRegex.exec(xmlText)) !== null) {
      const attrs = match[1];
      const rawContent = match[2];

      let beginStr = null;
      let endStr = null;
      let durStr = null;

      const beginMatch = attrs.match(/\bbegin=["']([^"']+)["']/i);
      const endMatch = attrs.match(/\bend=["']([^"']+)["']/i);
      const durMatch = attrs.match(/\bdur=["']([^"']+)["']/i);

      if (beginMatch) {
        beginStr = beginMatch[1];
        if (endMatch) endStr = endMatch[1];
        if (durMatch) durStr = durMatch[1];
      } else {
        // Fallback: Check if inner span has begin/end
        const spanMatch = rawContent.match(/<span\b[^>]*\bbegin=["']([^"']+)["'][^>]*>/i);
        if (spanMatch) {
          beginStr = spanMatch[1];
          const spanEnd = rawContent.match(/<span\b[^>]*\bend=["']([^"']+)["'][^>]*>/i);
          if (spanEnd) endStr = spanEnd[1];
          const spanDur = rawContent.match(/<span\b[^>]*\bdur=["']([^"']+)["'][^>]*>/i);
          if (spanDur) durStr = spanDur[1];
        }
      }

      if (!beginStr) continue;

      const startSec = timeToSeconds(beginStr, timingOpts);
      let endSec = startSec + 3;
      if (endStr) {
        endSec = timeToSeconds(endStr, timingOpts);
      } else if (durStr) {
        endSec = startSec + timeToSeconds(durStr, timingOpts);
      }

      const clean = cleanCueText(rawContent);
      if (clean) {
        cues.push({
          index: cues.length + 1,
          start: secondsToTimestamp(startSec, false),
          end: secondsToTimestamp(endSec, false),
          startSec: startSec,
          endSec: endSec,
          text: rawContent.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          cleanText: clean
        });
      }
    }

    // Sort chronologically by startSec
    cues.sort((a, b) => a.startSec - b.startSec);
    cues.forEach((c, idx) => { c.index = idx + 1; });

    return cues;
  }

  /**
   * Parse YouTube timedtext XML format:
   * - Format 3: <timedtext format="3"><p t="18640" d="3240">Hello world</p>...</timedtext>
   * - Legacy: <transcript><text start="12.34" dur="2.5">Hello world</text>...</transcript>
   */
  function parseYouTubeXML(xmlText) {
    const cues = [];
    if (!xmlText) return cues;

    // 1. Format 3: <p t="ms" d="ms">...</p>
    const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = pRegex.exec(xmlText)) !== null) {
      const attrs = match[1];
      const rawContent = match[2];

      const tMatch = attrs.match(/\bt=["'](\d+)["']/i);
      const dMatch = attrs.match(/\bd=["'](\d+)["']/i);

      if (tMatch) {
        const startSec = parseInt(tMatch[1], 10) / 1000;
        const durSec = dMatch ? parseInt(dMatch[1], 10) / 1000 : 3;
        const endSec = startSec + durSec;

        const clean = cleanCueText(rawContent);
        if (clean) {
          cues.push({
            index: cues.length + 1,
            start: secondsToTimestamp(startSec, false),
            end: secondsToTimestamp(endSec, false),
            startSec: startSec,
            endSec: endSec,
            text: rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            cleanText: clean
          });
        }
      }
    }

    if (cues.length > 0) return cues;

    // 2. Legacy format: <text start="12.34" dur="2.5">...</text>
    const textRegex = /<text\b[^>]*\bstart=["']([^"']+)["'][^>]*\bdur=["']([^"']+)["'][^>]*>([\s\S]*?)<\/text>/gi;

    while ((match = textRegex.exec(xmlText)) !== null) {
      const startSec = parseFloat(match[1]) || 0;
      const durSec = parseFloat(match[2]) || 0;
      const endSec = startSec + durSec;
      const rawContent = match[3];

      const clean = cleanCueText(rawContent);
      if (clean) {
        cues.push({
          index: cues.length + 1,
          start: secondsToTimestamp(startSec, false),
          end: secondsToTimestamp(endSec, false),
          startSec: startSec,
          endSec: endSec,
          text: rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          cleanText: clean
        });
      }
    }

    return cues;
  }

  /**
   * Parse YouTube timedtext JSON3 format.
   */
  function parseYouTubeJSON3(jsonObjOrString) {
    const cues = [];
    let data = jsonObjOrString;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return cues;
      }
    }

    if (!data || !Array.isArray(data.events)) return cues;

    for (const evt of data.events) {
      if (!evt.segs || !Array.isArray(evt.segs)) continue;

      const startMs = Number(evt.tStartMs) || 0;
      const durMs = Number(evt.dDurationMs) || 0;
      const startSec = startMs / 1000;
      const endSec = (startMs + durMs) / 1000;

      const raw = evt.segs.map(s => s.utf8 || '').join('');
      const clean = cleanCueText(raw);

      if (clean) {
        cues.push({
          index: cues.length + 1,
          start: secondsToTimestamp(startSec, false),
          end: secondsToTimestamp(endSec, false),
          startSec: startSec,
          endSec: endSec,
          text: raw.trim(),
          cleanText: clean
        });
      }
    }

    return cues;
  }

  /**
   * Universal Smart Parser: automatically detects input format and parses it.
   */
  function parse(input) {
    if (!input) return [];

    // JSON object or JSON string
    if (typeof input === 'object' && input !== null) {
      return parseYouTubeJSON3(input);
    }

    const str = String(input).trim();

    // Check JSON3 format
    if (str.startsWith('{') && (str.includes('"events"') || str.includes('"tStartMs"'))) {
      return parseYouTubeJSON3(str);
    }

    // Check WebVTT
    if (str.startsWith('WEBVTT') || /WEBVTT\b/.test(str.substring(0, 50))) {
      return parseWebVTT(str);
    }

    // Check YouTube XML or TimedText format="3"
    if (str.includes('<timedtext') || str.includes('<transcript') || str.includes('<text start=') || (str.includes('<p t=') && str.includes('d='))) {
      const ytAttempt = parseYouTubeXML(str);
      if (ytAttempt.length > 0) return ytAttempt;
    }

    // Check TTML / DFXP XML (Netflix)
    if (str.includes('<tt') || str.includes('xmlns:tt') || str.includes('xmlns="http://www.w3.org/ns/ttml"')) {
      return parseTTML(str);
    }

    // Check standard SRT (digit followed by timestamp line)
    if (/\d+\s*\n\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(str)) {
      return parseSRT(str);
    }

    // Fallback: Try WebVTT / SRT parser
    const vttAttempt = parseWebVTT(str);
    if (vttAttempt.length > 0) return vttAttempt;

    // Fallback: Try TTML / XML
    const xmlAttempt = parseTTML(str);
    if (xmlAttempt.length > 0) return xmlAttempt;

    return [];
  }

  /**
   * Serialize cues to SubRip (.srt) format.
   */
  function toSRT(cues) {
    if (!Array.isArray(cues) || cues.length === 0) return '';
    const lines = [];

    cues.forEach((cue, idx) => {
      lines.push(idx + 1);
      const start = secondsToTimestamp(cue.startSec, true);
      const end = secondsToTimestamp(cue.endSec, true);
      lines.push(`${start} --> ${end}`);
      lines.push(cue.cleanText || cue.text || '');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Serialize cues to WebVTT (.vtt) format.
   */
  function toWebVTT(cues) {
    if (!Array.isArray(cues) || cues.length === 0) return 'WEBVTT\n\n';
    const lines = ['WEBVTT', ''];

    cues.forEach((cue, idx) => {
      lines.push(idx + 1);
      const start = secondsToTimestamp(cue.startSec, false);
      const end = secondsToTimestamp(cue.endSec, false);
      lines.push(`${start} --> ${end}`);
      lines.push(cue.cleanText || cue.text || '');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Serialize cues to clean, readable transcript text (.txt).
   * Combines cues into coherent sentences and deduplicates overlapping phrases.
   */
  function toReadableTranscript(cues, includeTimestamps = true) {
    if (!Array.isArray(cues) || cues.length === 0) return '';
    const paragraphs = [];
    let currentParagraph = '';
    let currentStartTime = '';

    cues.forEach((cue) => {
      const text = (cue.cleanText || cue.text || '').trim();
      if (!text) return;

      if (!currentStartTime) {
        currentStartTime = formatDisplayTime(cue.startSec);
      }

      // Avoid duplicating identical consecutive subtitle lines (common in ASR rolling captions)
      if (currentParagraph.endsWith(text)) {
        return;
      }

      currentParagraph += (currentParagraph ? ' ' : '') + text;

      // Group into paragraphs every ~300 characters or when ending with sentence terminal
      if (/[.!?]$/.test(text) && currentParagraph.length > 180) {
        if (includeTimestamps) {
          paragraphs.push(`[${currentStartTime}] ${currentParagraph}`);
        } else {
          paragraphs.push(currentParagraph);
        }
        currentParagraph = '';
        currentStartTime = '';
      }
    });

    if (currentParagraph) {
      if (includeTimestamps && currentStartTime) {
        paragraphs.push(`[${currentStartTime}] ${currentParagraph}`);
      } else {
        paragraphs.push(currentParagraph);
      }
    }

    return paragraphs.join('\n\n');
  }

  return Object.freeze({
    timeToSeconds,
    secondsToTimestamp,
    formatDisplayTime,
    cleanCueText,
    normalizeSentenceCase,
    parse,
    parseWebVTT,
    parseSRT,
    parseTTML,
    parseYouTubeXML,
    parseYouTubeJSON3,
    toSRT,
    toWebVTT,
    toReadableTranscript
  });
});
