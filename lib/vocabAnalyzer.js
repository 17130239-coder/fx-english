/**
 * AF English - Advanced Vocabulary Analyzer & POS Categorizer
 * Splits subtitle text into Nouns, Verbs, Adjectives, Adverbs with lemmatization,
 * frequency analysis, movie context sentences, timestamps, and CEFR levels.
 * Compatible with Browser, Service Worker, and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const nlp = require('./compromise.js');
    const cefrDict = require('./cefrDict.js');
    module.exports = factory(nlp, cefrDict);
  } else {
    root.APP_VOCAB_ANALYZER = factory(root.nlp, root.APP_CEFR_DICT);
  }
})(typeof self !== 'undefined' ? self : this, function (nlpInstance, cefrDictInstance) {
  'use strict';

  // Auxiliary verbs to ignore from main lexical verbs list
  const AUXILIARY_VERBS = new Set([
    'be', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
    'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing',
    'can', 'could', 'will', 'would', 'shall', 'should',
    'may', 'might', 'must'
  ]);

  // Common pronouns and determiners that must NEVER be classified as nouns or vocabulary
  const PRONOUN_DETERMINER_BLACKLIST = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their',
    'mine', 'yours', 'hers', 'ours', 'theirs',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
    'this', 'that', 'these', 'those',
    'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever', 'whichever',
    'someone', 'somebody', 'something',
    'anyone', 'anybody', 'anything',
    'everyone', 'everybody', 'everything',
    'no one', 'nobody', 'nothing',
    'none', 'all', 'any', 'some', 'each', 'every', 'either', 'neither',
    'both', 'few', 'fewer', 'many', 'much', 'more', 'most', 'several',
    'other', 'others', 'another', 'such', 'one', 'ones'
  ]);

  // Definite adverbs that rule-based NLP parsers can confuse with nouns or conjunctions
  const KNOWN_ADVERBS = new Set([
    'there', 'here', 'where', 'somewhere', 'anywhere', 'nowhere', 'everywhere',
    'now', 'then', 'today', 'tomorrow', 'yesterday', 'tonight', 'soon',
    'already', 'still', 'yet', 'again', 'ever', 'never', 'always', 'often',
    'sometimes', 'usually', 'seldom', 'rarely', 'also', 'too', 'very', 'quite',
    'really', 'away', 'back', 'together', 'apart', 'ahead', 'abroad',
    'indoors', 'outdoors', 'downstairs', 'upstairs', 'inside', 'outside', 'nearby',
    'almost', 'nearly', 'hardly', 'scarcely', 'barely', 'extremely', 'fairly',
    'pretty', 'rather', 'especially', 'particularly', 'specifically', 'actually',
    'probably', 'maybe', 'perhaps', 'definitely', 'certainly', 'indeed',
    'obviously', 'clearly', 'simply', 'just', 'only', 'even', 'late', 'early',
    'fast', 'hard', 'well', 'anyway', 'instead', 'besides', 'meanwhile',
    'otherwise', 'furthermore', 'moreover', 'nonetheless', 'nevertheless'
  ]);

  // Common high-frequency stopwords that add little value to vocabulary study
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet',
    'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to', 'up', 'with',
    'as', 'if', 'than', 'because', 'while', 'though', 'although',
    'oh', 'ah', 'uh', 'um', 'yeah', 'yes', 'no', 'okay', 'ok', 'hey', 'hi', 'hello',
    'gonna', 'wanna', 'gotta', 'huh', 'wow', 'ooh'
  ]);

  // Curated patterns for high-impact real-life communicative sentences & spoken chunks
  const COMMUNICATIVE_PATTERNS = [
    // Idioms, chunks & everyday spoken phrases
    { pattern: /\b(up to you)\b/i, phrase: "up to you", tag: "Cụm từ", vi: "Tùy bạn quyết định", note: "Dùng khi trao quyền quyết định cho người đối thoại" },
    { pattern: /\b(make(s)? sense)\b/i, phrase: "make sense", tag: "Giao tiếp", vi: "Hợp lý, có lý, dễ hiểu", note: "Dùng để xác nhận điều gì đó nghe hợp logic" },
    { pattern: /\b(take it easy)\b/i, phrase: "take it easy", tag: "Đời sống", vi: "Bình tĩnh nào, thư giãn đi", note: "Khuyên ai đó bớt căng thẳng hoặc dùng khi chào tạm biệt" },
    { pattern: /\b(no big deal|not a big deal)\b/i, phrase: "no big deal", tag: "Đời sống", vi: "Không có gì to tát đâu / Chuyện nhỏ thôi", note: "Dùng trấn an người khác khi có sơ suất" },
    { pattern: /\b(hang in there)\b/i, phrase: "hang in there", tag: "Khích lệ", vi: "Cố lên, kiên trì lên nhé", note: "Lời động viên rất phổ biến của người bản xứ" },
    { pattern: /\b(call it a day)\b/i, phrase: "call it a day", tag: "Thành ngữ", vi: "Hôm nay nghỉ ở đây thôi / Dừng làm việc", note: "Dùng khi kết thúc một ngày làm việc hay học tập" },
    { pattern: /\b(by the way)\b/i, phrase: "by the way", tag: "Chuyển ý", vi: "À mà này, nhân tiện", note: "Dùng để chuyển sang một chủ đề mới trong hội thoại" },
    { pattern: /\b(as a matter of fact|to be honest|to tell (you )?the truth)\b/i, phrase: "to be honest", tag: "Quan điểm", vi: "Thành thật mà nói, thực tế là", note: "Mở đầu bày tỏ quan điểm thẳng thắn" },
    { pattern: /\b(so far so good)\b/i, phrase: "so far so good", tag: "Thành ngữ", vi: "Mọi thứ đến giờ vẫn ổn thỏa", note: "Trả lời khi ai đó hỏi tiến độ công việc" },
    { pattern: /\b(keep (it )?up)\b/i, phrase: "keep it up", tag: "Khích lệ", vi: "Cứ tiếp tục phát huy nhé", note: "Khen ngợi và động viên ai đó giữ vững phong độ" },
    { pattern: /\b(out of the blue)\b/i, phrase: "out of the blue", tag: "Thành ngữ", vi: "Bất ngờ, đột ngột, từ trên trời rơi xuống", note: "Chỉ sự việc xảy ra hoàn toàn không báo trước" },
    { pattern: /\b(sleep on it)\b/i, phrase: "sleep on it", tag: "Thành ngữ", vi: "Cứ suy nghĩ thêm qua đêm nay / Mai tính tiếp", note: "Khuyên tạm hoãn quyết định để cân nhắc kỹ hơn" },
    { pattern: /\b(give (me|us) a hand|lend (me|us) a hand)\b/i, phrase: "give a hand", tag: "Nhờ vả", vi: "Giúp tôi một tay với", note: "Cách nhờ giúp đỡ rất tự nhiên và lịch sự" },
    { pattern: /\b(do me a favor)\b/i, phrase: "do me a favor", tag: "Nhờ vả", vi: "Giúp tôi một việc được không", note: "Mở lời khi muốn nhờ ai việc gì quan trọng" },
    { pattern: /\b(let me know)\b/i, phrase: "let me know", tag: "Giao tiếp", vi: "Hãy báo cho tôi biết nhé", note: "Mẫu câu kết thúc trao đổi rất thông dụng" },
    { pattern: /\b(don't worry( about it)?)\b/i, phrase: "don't worry", tag: "Đời sống", vi: "Đừng lo lắng, không sao đâu", note: "Trấn an đối phương" },
    { pattern: /\b(have no idea|has no idea|had no idea)\b/i, phrase: "have no idea", tag: "Đời sống", vi: "Hoàn toàn không biết / Không có manh mối nào", note: "Nhấn mạnh sự không biết rõ hơn 'I don't know'" },
    { pattern: /\b(can't wait|couldn't wait)\b/i, phrase: "can't wait", tag: "Biểu cảm", vi: "Háo hức lắm rồi, không thể chờ thêm", note: "Bộc lộ sự phấn khởi trước một sự kiện sắp tới" },
    { pattern: /\b(feel free to)\b/i, phrase: "feel free to", tag: "Lịch sự", vi: "Cứ tự nhiên, đừng ngại", note: "Khuyến khích ai đó hành động thoải mái" },
    { pattern: /\b(keep in mind)\b/i, phrase: "keep in mind", tag: "Cụm từ", vi: "Hãy ghi nhớ điều này", note: "Nhắc nhở lưu ý một điểm quan trọng" },
    { pattern: /\b(fair enough)\b/i, phrase: "fair enough", tag: "Đồng ý", vi: "Hợp lý đấy / Tôi chấp nhận điều đó", note: "Bày tỏ sự đồng thuận với lập luận của đối phương" },
    { pattern: /\b(you got it)\b/i, phrase: "you got it", tag: "Phản xạ", vi: "Có ngay đây / Bạn hiểu đúng rồi đấy", note: "Đáp lại khi nhận lời giúp hoặc xác nhận đúng" },
    { pattern: /\b(it's about time|about time)\b/i, phrase: "it's about time", tag: "Thành ngữ", vi: "Đến lúc rồi đấy / Cuối cùng cũng xong", note: "Thốt lên khi một việc diễn ra sau thời gian dài chờ đợi" },
    { pattern: /\b(better late than never)\b/i, phrase: "better late than never", tag: "Tục ngữ", vi: "Muộn còn hơn không bao giờ", note: "Thành ngữ an ủi khi hoàn thành việc trễ hạn" },
    { pattern: /\b(break a leg)\b/i, phrase: "break a leg", tag: "Thành ngữ", vi: "Chúc may mắn nhé (trước buổi biểu diễn/thi)", note: "Lời chúc may mắn kinh điển trong tiếng Anh" },
    { pattern: /\b(on the same page)\b/i, phrase: "on the same page", tag: "Thành ngữ", vi: "Cùng chung cách hiểu / Đồng quan điểm", note: "Đảm bảo mọi người đều hiểu thống nhất một vấn đề" },
    { pattern: /\b(under the weather)\b/i, phrase: "under the weather", tag: "Thành ngữ", vi: "Hơi mệt trong người, cảm sốt nhẹ", note: "Diễn tả tình trạng sức khỏe không tốt một cách nhẹ nhàng" },
    { pattern: /\b(no offense|none taken)\b/i, phrase: "no offense", tag: "Giao tiếp", vi: "Không có ý xúc phạm đâu / Không sao đâu", note: "Phép lịch sự trước khi nói điều nhạy cảm" },
    { pattern: /\b(piece of cake)\b/i, phrase: "piece of cake", tag: "Thành ngữ", vi: "Dễ như ăn kẹo / Dễ như trở bàn tay", note: "Miêu tả một việc vô cùng dễ dàng" },
    { pattern: /\b(pull yourself together)\b/i, phrase: "pull yourself together", tag: "Khuyên nhủ", vi: "Hãy bình tĩnh lại, kiểm soát bản thân đi", note: "Khuyên ai đó đang hoảng loạn lấy lại bình tĩnh" },
    { pattern: /\b(wrap (your|my) head around)\b/i, phrase: "wrap head around", tag: "Thành ngữ", vi: "Hiểu được / Tiêu hóa được điều phức tạp", note: "Nói về việc mất thời gian mới hiểu thấu một chuyện" },
    { pattern: /\b(long story short)\b/i, phrase: "long story short", tag: "Tóm lược", vi: "Tóm lại là, nói ngắn gọn là", note: "Dùng để rút gọn câu chuyện dài thành kết luận" },
    { pattern: /\b(at the end of the day)\b/i, phrase: "at the end of the day", tag: "Quan điểm", vi: "Suy cho cùng, rốt cuộc thì", note: "Đưa ra kết luận cốt lõi sau mọi tranh luận" },
    { pattern: /\b(figure (it|this|that|things) out)\b/i, phrase: "figure out", tag: "Cụm từ", vi: "Tìm ra giải pháp, hiểu ra vấn đề", note: "Động từ ghép cực kỳ thông dụng trong đời sống" },
    { pattern: /\b(make up (your|my|his|her) mind)\b/i, phrase: "make up one's mind", tag: "Thành ngữ", vi: "Đưa ra quyết định dứt khoát", note: "Khuyên hoặc nói về việc chốt quyết định" },
    { pattern: /\b(never mind)\b/i, phrase: "never mind", tag: "Đời sống", vi: "Thôi bỏ đi, đừng bận tâm nữa", note: "Dùng khi không muốn người khác phải bận lòng" },
    { pattern: /\b(take your time)\b/i, phrase: "take your time", tag: "Lịch sự", vi: "Cứ từ từ, không cần vội đâu", note: "Lịch sự cho người khác thời gian hoàn thành việc" },
    { pattern: /\b(I'm on it|I will be on it)\b/i, phrase: "I'm on it", tag: "Phản xạ", vi: "Tôi đang giải quyết ngay đây", note: "Nhận việc và báo rằng mình đang bắt tay vào làm" },
    { pattern: /\b(suit yourself)\b/i, phrase: "suit yourself", tag: "Đời sống", vi: "Tùy ý bạn đấy, muốn sao cũng được", note: "Nói khi tôn trọng quyết định riêng của người khác" },
    { pattern: /\b(cross (your|my) fingers)\b/i, phrase: "cross fingers", tag: "Thành ngữ", vi: "Cầu mong may mắn", note: "Hành động đan chéo ngón tay để cầu mong điều tốt đẹp" },
    { pattern: /\b(safe and sound)\b/i, phrase: "safe and sound", tag: "Thành ngữ", vi: "Bình an vô sự, an toàn tuyệt đối", note: "Báo tin bình an sau chuyến đi hoặc tai nạn" },
    { pattern: /\b(speak of the devil)\b/i, phrase: "speak of the devil", tag: "Thành ngữ", vi: "Vừa nhắc Tào Tháo là Tào Tháo tới", note: "Nói khi người vừa được nhắc tên bất ngờ xuất hiện" },
    { pattern: /\b(cost an arm and a leg)\b/i, phrase: "cost an arm and a leg", tag: "Thành ngữ", vi: "Đắt cắt cổ, quá đắt đỏ", note: "Miêu tả thứ gì đó cực kỳ tốn kém" },
    { pattern: /\b(cut to the chase)\b/i, phrase: "cut to the chase", tag: "Thành ngữ", vi: "Đi thẳng vào vấn đề chính đi", note: "Yêu cầu người nói không vòng vo" },

    // Practical speech acts (suggestions, requests, opinions, reactions)
    { pattern: /\b(why don't (we|you)|how about|what about)\b/i, phrase: "why don't we / how about", tag: "Đề xuất", vi: "Hay là chúng ta... / Bạn nghĩ sao về...", note: "Mẫu câu đưa ra gợi ý, đề xuất nhẹ nhàng" },
    { pattern: /\b(would you mind|could you please)\b/i, phrase: "would you mind", tag: "Nhờ vả", vi: "Bạn có phiền lòng... / Xin bạn vui lòng...", note: "Lời nhờ vả trang trọng và lịch sự bậc nhất" },
    { pattern: /\b(what do you mean( by that)?)\b/i, phrase: "what do you mean", tag: "Làm rõ", vi: "Ý bạn là sao? Bạn muốn nói điều gì?", note: "Hỏi để hiểu sâu hơn khi có thắc mắc" },
    { pattern: /\b(as far as I (know|can tell|am concerned))\b/i, phrase: "as far as I know", tag: "Quan điểm", vi: "Theo như tôi biết, theo quan điểm của tôi", note: "Mở đầu bày tỏ nhận định cá nhân" },
    { pattern: /\b(I couldn't agree more|you can say that again)\b/i, phrase: "I couldn't agree more", tag: "Đồng ý", vi: "Tôi hoàn toàn đồng ý / Bạn nói quá đúng rồi", note: "Cách biểu đạt đồng tình 100%" },
    { pattern: /\b(are you (kidding|serious)|no way)\b/i, phrase: "are you kidding / no way", tag: "Biểu cảm", vi: "Bạn đùa à? Thật không thể tin nổi!", note: "Bộc lộ sự ngạc nhiên tột cùng trong hội thoại" },
    { pattern: /\b(what a (shame|relief|mess|pity))\b/i, phrase: "what a relief/shame", tag: "Cảm thán", vi: "Thật là nhẹ nhõm / Thật đáng tiếc", note: "Câu cảm thán biểu đạt cảm xúc tức thời" },
    { pattern: /\b(sounds (like a plan|good|great|awesome))\b/i, phrase: "sounds like a plan", tag: "Phản xạ", vi: "Nghe có vẻ hay đấy, cứ thống nhất vậy đi!", note: "Đồng thuận nhanh chóng với một kế hoạch" }
  ];

  /**
   * Helper to ensure NLP engine is available.
   */
  function getNlp() {
    if (nlpInstance) return nlpInstance;
    if (typeof nlp !== 'undefined') return nlp;
    if (typeof window !== 'undefined' && window.nlp) return window.nlp;
    if (typeof self !== 'undefined' && self.nlp) return self.nlp;
    if (typeof globalThis !== 'undefined' && globalThis.nlp) return globalThis.nlp;
    throw new Error('Compromise NLP library is not loaded. Please include lib/compromise.js');
  }

  /**
   * Helper to ensure CEFR dictionary is available.
   */
  function getCefrDict() {
    if (cefrDictInstance) return cefrDictInstance;
    if (typeof APP_CEFR_DICT !== 'undefined') return APP_CEFR_DICT;
    if (typeof window !== 'undefined' && window.APP_CEFR_DICT) return window.APP_CEFR_DICT;
    if (typeof self !== 'undefined' && self.APP_CEFR_DICT) return self.APP_CEFR_DICT;
    return null;
  }

  /**
   * Clean word string.
   */
  function cleanWord(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/^[^\w]+|[^\w]+$/g, '')
      .replace(/['’]s$/i, '')
      .trim();
  }

  /**
   * Extracts practical, high-value communicative sentences from subtitle sentences.
   */
  function extractCommunicativeSentences(sentences, options = {}) {
    if (!Array.isArray(sentences) || sentences.length === 0) return [];

    const videoTitle = options.videoTitle || '';
    const videoUrl = options.videoUrl || '';
    const results = [];
    const seenSentences = new Map();

    sentences.forEach((sObj) => {
      const rawText = (sObj.text || '').trim();
      // Clean noise: strip [Music], (Laughter), leading dashes, extra spaces
      const clean = rawText
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]+\)/g, '')
        .replace(/^[-\s:;"]+/, '')
        .replace(/["\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!clean) return;

      const words = clean.split(/\s+/);
      // Filter ideal conversational length: 3 to 22 words
      if (words.length < 3 || words.length > 22) return;

      // Match against communicative patterns
      let matchedPattern = null;
      for (const p of COMMUNICATIVE_PATTERNS) {
        if (p.pattern.test(clean)) {
          matchedPattern = p;
          break;
        }
      }

      // Also detect natural conversational speech questions/exclamations
      if (!matchedPattern) {
        if (/^(how|what|why|where|who)\s+(about|if|is|are|do|does|did|can|could|would)\b/i.test(clean) && clean.endsWith('?')) {
          matchedPattern = {
            phrase: clean.split(/\s+/).slice(0, 3).join(' '),
            tag: 'Hỏi & Làm rõ',
            vi: 'Câu hỏi giao tiếp thông dụng',
            note: 'Dùng để hỏi thăm, trao đổi hoặc làm rõ ý trong hội thoại'
          };
        } else if (/^(can|could|would|will)\s+(you|we|I)\b/i.test(clean) && clean.endsWith('?')) {
          matchedPattern = {
            phrase: clean.split(/\s+/).slice(0, 3).join(' '),
            tag: 'Lịch sự & Nhờ vả',
            vi: 'Mẫu câu đề xuất / nhờ vả lịch sự',
            note: 'Dùng để mở lời đề nghị hoặc nhờ ai giúp một cách nhã nhặn'
          };
        }
      }

      if (!matchedPattern) return;

      const normKey = clean.toLowerCase();
      if (seenSentences.has(normKey)) {
        const existing = seenSentences.get(normKey);
        existing.frequency = (existing.frequency || 1) + 1;
        return;
      }

      const item = {
        id: 'sent_' + Math.random().toString(36).substr(2, 7),
        word: clean,
        sentence: clean,
        cleanSentence: clean,
        highlightPhrase: matchedPattern.phrase,
        tag: matchedPattern.tag,
        vietnamese: matchedPattern.vi,
        translation: matchedPattern.vi,
        usageNote: matchedPattern.note,
        pos: 'sentences',
        posLabelVi: 'Câu giao tiếp',
        cefr: 'Giao tiếp',
        ipa: '',
        startTime: sObj.startTime || '00:00:00',
        startSec: sObj.startSec || 0,
        wordCount: words.length,
        frequency: 1,
        contexts: [{
          sentence: clean,
          text: clean,
          startTime: sObj.startTime,
          startSec: sObj.startSec,
          highlightWord: matchedPattern.phrase
        }],
        videoTitle: videoTitle,
        videoUrl: videoUrl,
        isCommunicative: true
      };

      seenSentences.set(normKey, item);
      results.push(item);
    });

    return results;
  }

  /**
   * Main analyzer: Analyzes subtitle cues and groups vocabulary by POS.
   * @param {Array<Object>} cues - Subtitle cues: [{ startSec, endSec, start, end, text, cleanText }]
   * @param {Object} [options] - Options: videoTitle, videoUrl, minFrequency, etc.
   */
  function analyzeSubtitles(cues, options = {}) {
    if (!Array.isArray(cues) || cues.length === 0) {
      return {
        summary: {
          totalWords: 0,
          uniqueWords: 0,
          nounCount: 0,
          verbCount: 0,
          adjCount: 0,
          advCount: 0,
          totalCues: 0
        },
        posGroups: {
          nouns: [],
          verbs: [],
          adjectives: [],
          adverbs: []
        },
        nouns: [],
        verbs: [],
        adjectives: [],
        adverbs: [],
        allWords: []
      };
    }

    const nlp = getNlp();
    const cefr = getCefrDict();
    const videoTitle = options.videoTitle || 'Movie / Video';
    const videoUrl = options.videoUrl || '';

    // Step 1: Preprocess cues into sentences with accurate timestamps
    // Subtitles are often broken across lines; we combine cues into sentences
    const sentences = [];
    let currentSentence = '';
    let currentStartSec = 0;
    let currentStartTime = '';

    cues.forEach((cue) => {
      const text = (cue.cleanText || cue.text || '').trim();
      if (!text) return;

      if (!currentSentence) {
        currentStartSec = cue.startSec;
        currentStartTime = cue.start || '00:00:00';
      }

      currentSentence += (currentSentence ? ' ' : '') + text;

      // When sentence ends with . ? ! or length exceeds limit
      if (/[.!?]$/.test(text) || currentSentence.length > 250) {
        sentences.push({
          text: currentSentence,
          startSec: currentStartSec,
          startTime: currentStartTime
        });
        currentSentence = '';
      }
    });

    if (currentSentence) {
      sentences.push({
        text: currentSentence,
        startSec: currentStartSec,
        startTime: currentStartTime
      });
    }

    // Step 2: Extract & Tag Words with Compromise NLP
    // Maps: lemma -> WordRecord
    const wordMap = new Map();
    let totalWordCount = 0;

    sentences.forEach((sentenceObj) => {
      const doc = nlp(sentenceObj.text);
      doc.compute('root');

      // Process all terms in this sentence
      const jsonDocs = doc.json();
      if (!Array.isArray(jsonDocs)) return;

      jsonDocs.forEach((docItem) => {
        if (!docItem.terms || !Array.isArray(docItem.terms)) return;

        const terms = docItem.terms;

        terms.forEach((term, termIdx) => {
          const rawText = term.text || '';
          const cleaned = cleanWord(rawText);
          if (!cleaned || cleaned.length <= 1) return;
          if (STOPWORDS.has(cleaned)) return;

          // Lemmatization: base form
          let root = (term.root || term.normal || cleaned).toLowerCase().trim();
          root = cleanWord(root);
          if (!root || root.length <= 1) root = cleaned;

          const tags = new Set(term.tags || []);

          // Dictionary lookup
          const dictInfo = cefr ? (cefr.lookup(root) || cefr.lookup(cleaned)) : null;

          // Pronouns and determiners must NEVER be classified as nouns or verbs
          if (PRONOUN_DETERMINER_BLACKLIST.has(cleaned) || PRONOUN_DETERMINER_BLACKLIST.has(root)) {
            return;
          }
          if (AUXILIARY_VERBS.has(cleaned) || AUXILIARY_VERBS.has(root)) {
            return;
          }

          // If word ends in -ly (and is not an adjective like friendly/lovely), it is an ADVERB
          const isLyAdverb = cleaned.endsWith('ly') && !['friendly', 'lonely', 'lovely', 'silly', 'ugly', 'deadly', 'lively', 'curly', 'daily', 'weekly', 'monthly', 'early'].includes(cleaned);

          let primaryPos = null;

          if (isLyAdverb || KNOWN_ADVERBS.has(cleaned) || KNOWN_ADVERBS.has(root)) {
            primaryPos = 'adverb';
            root = cleaned; // Keep surface adverb form (e.g. 'there', 'tonight', 'quickly', 'warmly')
          }

          // POS Context Disambiguation: Inspect surrounding syntactic tokens
          if (!primaryPos) {
            const prevTerm = termIdx > 0 ? terms[termIdx - 1] : null;
            const nextTerm = termIdx < terms.length - 1 ? terms[termIdx + 1] : null;
            const prevPrevTerm = termIdx > 1 ? terms[termIdx - 2] : null;

            const prevClean = prevTerm ? cleanWord(prevTerm.normal || prevTerm.text) : '';
            const nextClean = nextTerm ? cleanWord(nextTerm.normal || nextTerm.text) : '';
            const prevPrevClean = prevPrevTerm ? cleanWord(prevPrevTerm.normal || prevPrevTerm.text) : '';
            const prevTags = new Set(prevTerm?.tags || []);
            const nextTags = new Set(nextTerm?.tags || []);

            const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'who', 'someone', 'somebody', 'everyone', 'everybody', 'nobody']);
            const MODAL_OR_INF = new Set(['to', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did', 'gonna', 'wanna', 'better', 'please']);
            const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'each', 'every', 'some', 'any', 'no', 'many', 'much', 'several', 'few', 'both']);

            const isPrecededBySubject = SUBJECT_PRONOUNS.has(prevClean) || (['not', "n't", 'never', 'always', 'also', 'really'].includes(prevClean) && SUBJECT_PRONOUNS.has(prevPrevClean));
            const isPrecededByModal = MODAL_OR_INF.has(prevClean) || (['not', "n't"].includes(prevClean) && MODAL_OR_INF.has(prevPrevClean));
            const isImperativeStart = termIdx === 0 && (tags.has('Imperative') || tags.has('Infinitive'));

            // Strong Verb context: Preceded by Subject Pronoun, Modal/Auxiliary/To, or Imperative command
            const hasStrongVerbContext = tags.has('Verb') && !tags.has('Copula') && (isPrecededBySubject || isPrecededByModal || isImperativeStart);

            // Strong Noun context: Preceded by Determiner/Article, Possessive, or Preceding Adjective
            const isPrecededByDet = DETERMINERS.has(prevClean) || (prevTags.has('Adjective') && DETERMINERS.has(prevPrevClean));
            const hasStrongNounContext = (tags.has('Noun') && !tags.has('Pronoun')) && (isPrecededByDet || prevTags.has('Adjective') || prevTags.has('Preposition'));

            // Strong Adjective context: Directly modifies a following noun, or preceded by copula
            const hasStrongAdjContext = tags.has('Adjective') && (nextTags.has('Noun') || (prevTags.has('Copula') && !nextTags.has('Noun')));

            if (hasStrongVerbContext && !hasStrongNounContext) {
              primaryPos = 'verb';
            } else if (hasStrongNounContext && !hasStrongVerbContext) {
              primaryPos = 'noun';
            } else if (hasStrongAdjContext && !hasStrongNounContext && !hasStrongVerbContext) {
              primaryPos = 'adjective';
            } else if (dictInfo && dictInfo.pos) {
              // Dictionary-authoritative fallback when syntactic context is neutral or balanced
              if (dictInfo.pos === 'adv') primaryPos = 'adverb';
              else if (dictInfo.pos === 'v') primaryPos = 'verb';
              else if (dictInfo.pos === 'adj') primaryPos = 'adjective';
              else if (dictInfo.pos === 'n') primaryPos = 'noun';
            }
          }

          // NLP heuristics fallback if still not classified
          if (!primaryPos) {
            if (tags.has('Pronoun') || tags.has('Determiner') || tags.has('Preposition') || tags.has('Conjunction')) {
              return;
            }

            if (tags.has('Adverb') || tags.has('Negative')) {
              primaryPos = 'adverb';
            } else if (cleaned.endsWith('ly') && !['friendly', 'lonely', 'lovely', 'silly', 'ugly', 'deadly', 'lively'].includes(cleaned)) {
              primaryPos = 'adverb';
            } else if (tags.has('Verb') && !tags.has('Auxiliary') && !tags.has('Copula')) {
              primaryPos = 'verb';
            } else if (tags.has('Adjective')) {
              primaryPos = 'adjective';
            } else if (tags.has('Noun')) {
              if (PRONOUN_DETERMINER_BLACKLIST.has(cleaned) || KNOWN_ADVERBS.has(cleaned)) return;
              primaryPos = 'noun';
            }
          }

          if (!primaryPos) return;

          // For adverbs ending in 'ly', keep the adverb form (e.g. 'quickly' instead of 'quick')
          if (primaryPos === 'adverb' && cleaned.endsWith('ly') && cleaned.length > 3) {
            root = cleaned;
          }
          if (!root || root.length <= 1) root = cleaned;

          totalWordCount++;

          // Build or update WordRecord
          let record = wordMap.get(root);
          if (!record) {
            // Dictionary & CEFR lookup
            const dictLookup = cefr ? cefr.lookup(root) : null;
            const cefrLevel = dictLookup ? dictLookup.cefr : (cefr ? cefr.getLevel(root) : 'B1');
            const ipa = dictLookup ? dictLookup.ipa : '';
            const viTranslation = dictLookup ? dictLookup.vi : '';

            record = {
              word: root,
              pos: primaryPos, // 'noun' | 'verb' | 'adjective' | 'adverb'
              posCounts: { noun: 0, verb: 0, adjective: 0, adverb: 0 },
              posContexts: { noun: [], verb: [], adjective: [], adverb: [] },
              frequency: 0,
              cefr: cefrLevel,
              ipa: ipa,
              translation: viTranslation,
              inflections: new Map(), // surface form -> count
              contexts: [], // array of example sentences with timestamps
              firstSeenSec: sentenceObj.startSec,
              videoTitle: videoTitle,
              videoUrl: videoUrl
            };
            wordMap.set(root, record);
          }

          record.frequency++;
          if (record.posCounts && record.posCounts[primaryPos] !== undefined) {
            record.posCounts[primaryPos]++;
          }

          // Track inflected forms (e.g. running: 3, ran: 1)
          const currInflectionCount = record.inflections.get(cleaned) || 0;
          record.inflections.set(cleaned, currInflectionCount + 1);

          const contextObj = {
            text: sentenceObj.text,
            sentence: sentenceObj.text,
            startSec: sentenceObj.startSec,
            startTime: sentenceObj.startTime,
            highlightWord: cleaned,
            videoTitle: videoTitle,
            videoUrl: videoUrl
          };

          // Save context example specific to this POS
          if (record.posContexts && record.posContexts[primaryPos] && record.posContexts[primaryPos].length < 3) {
            const alreadyInPos = record.posContexts[primaryPos].some(c => c.sentence === sentenceObj.text);
            if (!alreadyInPos) {
              record.posContexts[primaryPos].push(contextObj);
            }
          }

          // Add movie context example if not already full (store up to 5 best examples)
          if (record.contexts.length < 5) {
            const alreadyHasSentence = record.contexts.some(c => c.sentence === sentenceObj.text);
            if (!alreadyHasSentence) {
              record.contexts.push(contextObj);
            }
          }
        });
      });
    });

    // Step 3: Format word records into organized arrays
    const allWords = Array.from(wordMap.values()).map((record) => {
      // Determine dominant POS based on real usage counts in this subtitle track
      let dominantPos = record.pos;
      let highestCount = 0;
      const counts = record.posCounts || { [record.pos]: record.frequency || 1 };

      ['verb', 'noun', 'adjective', 'adverb'].forEach((p) => {
        const c = counts[p] || 0;
        if (c > highestCount) {
          highestCount = c;
          dominantPos = p;
        }
      });

      const totalPosOccurrences = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      const posDistribution = Object.entries(counts)
        .filter(([_, cnt]) => cnt > 0)
        .map(([posKey, cnt]) => ({
          pos: posKey,
          posLabelVi: getPosLabelVi(posKey),
          count: cnt,
          percent: Math.round((cnt / totalPosOccurrences) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      // Prioritize context sentence matching the dominant POS
      let prioritizedContexts = [];
      if (record.posContexts && record.posContexts[dominantPos] && record.posContexts[dominantPos].length > 0) {
        prioritizedContexts = [...record.posContexts[dominantPos]];
      }
      (record.contexts || []).forEach((c) => {
        if (!prioritizedContexts.some(pc => pc.sentence === c.sentence)) {
          prioritizedContexts.push(c);
        }
      });

      // Format inflections array
      const inflectionList = Array.from(record.inflections.entries()).map(([form, count]) => {
        return count > 1 ? `${form} (${count}x)` : form;
      });

      return {
        word: record.word,
        pos: dominantPos,
        posLabelVi: getPosLabelVi(dominantPos),
        posCounts: counts,
        posDistribution: posDistribution,
        posContexts: record.posContexts || {},
        hasMultiPos: posDistribution.length > 1,
        frequency: record.frequency,
        cefr: record.cefr,
        ipa: record.ipa,
        translation: record.translation,
        vietnamese: record.translation,
        inflections: inflectionList,
        contexts: prioritizedContexts,
        firstSeenSec: record.firstSeenSec,
        videoTitle: record.videoTitle,
        videoUrl: record.videoUrl
      };
    });

    // Sort by frequency descending by default
    allWords.sort((a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word));

    // Split into 4 POS groups
    const nouns = allWords.filter(w => w.pos === 'noun');
    const verbs = allWords.filter(w => w.pos === 'verb');
    const adjectives = allWords.filter(w => w.pos === 'adjective');
    const adverbs = allWords.filter(w => w.pos === 'adverb');

    // Extract practical conversational & communicative sentences
    const communicativeSentences = extractCommunicativeSentences(sentences, { videoTitle, videoUrl });

    return {
      summary: {
        totalWords: totalWordCount,
        uniqueWords: allWords.length,
        nounCount: nouns.length,
        verbCount: verbs.length,
        adjCount: adjectives.length,
        advCount: adverbs.length,
        communicativeCount: communicativeSentences.length,
        totalCues: cues.length,
        videoTitle: videoTitle
      },
      posGroups: {
        nouns: nouns,
        verbs: verbs,
        adjectives: adjectives,
        adverbs: adverbs,
        sentences: communicativeSentences
      },
      categories: {
        noun: { count: nouns.length, words: nouns },
        verb: { count: verbs.length, words: verbs },
        adjective: { count: adjectives.length, words: adjectives },
        adverb: { count: adverbs.length, words: adverbs },
        sentences: { count: communicativeSentences.length, words: communicativeSentences }
      },
      totals: {
        totalWords: totalWordCount,
        uniqueWords: allWords.length,
        communicativeCount: communicativeSentences.length
      },
      nouns: nouns,
      verbs: verbs,
      adjectives: adjectives,
      adverbs: adverbs,
      communicativeSentences: communicativeSentences,
      allWords: allWords
    };
  }

  /**
   * Helper for Vietnamese POS labels.
   */
  function getPosLabelVi(pos) {
    switch (pos) {
      case 'noun': return 'Danh từ';
      case 'verb': return 'Động từ';
      case 'adjective': return 'Tính từ';
      case 'adverb': return 'Trạng từ';
      case 'sentences': return 'Câu giao tiếp';
      default: return 'Từ vựng';
    }
  }

  /**
   * Export vocabulary list to Anki format (.txt / .csv).
   * Fields: Word | POS | Phonetic | Vietnamese Translation | Context Sentence | Video Source
   */
  function exportToAnkiFormat(words) {
    if (!Array.isArray(words) || words.length === 0) return '';
    const lines = [];

    // Header comment for Anki import
    lines.push('#separator:Tab');
    lines.push('#html:true');
    lines.push('#tags:fx-english-extension subtitle-vocab');

    words.forEach((item) => {
      // Dedicated sentence card export
      if (item.isCommunicative || item.sentence) {
        const sentence = item.sentence || item.cleanSentence || '';
        const hl = item.highlightPhrase || '';
        const tag = item.tag || 'Giao tiếp';
        const trans = item.vietnamese || item.translation || '';
        const note = item.usageNote || '';
        const time = item.startTime ? `<small style="color:#f97316;">(${item.startTime})</small>` : '';

        let sentenceHtml = sentence;
        if (hl) {
          const escapedHl = String(hl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          sentenceHtml = sentence.replace(new RegExp(`\\b(${escapedHl})\\b`, 'gi'), '<b style="color:#6366f1;">$1</b>');
        }

        const frontCard = `<div style="font-size:20px;font-weight:bold;line-height:1.4;">${sentenceHtml}</div><div style="margin-top:8px;"><span style="font-size:12px;background:#6366f1;color:#fff;padding:2px 8px;border-radius:4px;">${tag}</span> ${time}</div>`;
        const backCard = `<div style="font-size:18px;font-weight:bold;color:#f97316;">${trans}</div><div style="font-size:13px;color:#cbd5e1;margin-top:8px;">Cụm từ cốt lõi: <b>${hl}</b></div><div style="font-size:12px;color:#94a3b8;margin-top:4px;font-style:italic;">${note}</div>`;

        const sanitizedFront = frontCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
        const sanitizedBack = backCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
        lines.push(`${sanitizedFront}\t${sanitizedBack}`);
        return;
      }

      const word = item.word || '';
      const pos = item.posLabelVi || item.pos || '';
      const ipa = item.ipa ? `[${item.ipa}]` : '';
      const trans = item.translation || '';

      const firstContext = (item.contexts && item.contexts[0]) ? item.contexts[0] : null;
      let sentenceHtml = '';
      if (firstContext) {
        const sentence = firstContext.sentence || '';
        const hl = firstContext.highlightWord || word;
        // Bold the target word in context sentence safely
        const escapedHl = String(hl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedHl})\\b`, 'gi');
        sentenceHtml = sentence.replace(regex, '<b>$1</b>');
        if (firstContext.startTime) {
          sentenceHtml += ` <small style="color:#f97316;">(${firstContext.startTime})</small>`;
        }
      }

      const backCard = `<div style="font-size:18px;font-weight:bold;color:#f97316;">${trans}</div><div style="font-size:13px;color:#888;">${pos} ${ipa}</div><div style="margin-top:8px;font-style:italic;">${sentenceHtml}</div>`;

      // Front: Word + IPA + POS badge
      const frontCard = `<div style="font-size:22px;font-weight:bold;">${word}</div><span style="font-size:12px;background:#333;color:#f8fafc;padding:2px 6px;border-radius:4px;">${pos}</span>`;

      // Sanitize tab and newline characters so Anki delimiter is not corrupted
      const sanitizedFront = frontCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
      const sanitizedBack = backCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');

      lines.push(`${sanitizedFront}\t${sanitizedBack}`);
    });

    return lines.join('\n');
  }

  /**
   * Export vocabulary list to CSV format compliant with Excel.
   */
  function exportToCsvFormat(words) {
    if (!Array.isArray(words) || words.length === 0) return '';
    const isSentences = Boolean(words[0] && (words[0].isCommunicative || words[0].sentence));

    if (isSentences) {
      const header = ['"Câu tiếng Anh"', '"Cụm từ then chốt"', '"Loại giao tiếp"', '"Nghĩa tiếng Việt"', '"Ứng dụng thực tế"', '"Mốc thời gian"', '"Nguồn phim/video"'];
      const lines = [header.join(',')];
      words.forEach((item) => {
        const row = [
          `"${(item.sentence || item.word || '').replace(/"/g, '""')}"`,
          `"${(item.highlightPhrase || '').replace(/"/g, '""')}"`,
          `"${(item.tag || '').replace(/"/g, '""')}"`,
          `"${(item.vietnamese || item.translation || '').replace(/"/g, '""')}"`,
          `"${(item.usageNote || '').replace(/"/g, '""')}"`,
          `"${(item.startTime || '').replace(/"/g, '""')}"`,
          `"${(item.videoTitle || '').replace(/"/g, '""')}"`
        ];
        lines.push(row.join(','));
      });
      return lines.join('\n');
    }

    const header = ['"Từ vựng"', '"Loại từ"', '"Phiên âm"', '"Cấp độ CEFR"', '"Tần suất"', '"Nghĩa tiếng Việt"', '"Câu ngữ cảnh phim"', '"Thời điểm (timestamp)"', '"Nguồn phim/video"'];
    const lines = [header.join(',')];

    words.forEach((w) => {
      const firstCtx = (w.contexts && w.contexts[0]) ? w.contexts[0] : { sentence: '', startTime: '' };
      const row = [
        `"${(w.word || '').replace(/"/g, '""')}"`,
        `"${(w.posLabelVi || w.pos || '').replace(/"/g, '""')}"`,
        `"${(w.ipa || '').replace(/"/g, '""')}"`,
        `"${(w.cefr || '').replace(/"/g, '""')}"`,
        w.frequency || 1,
        `"${(w.translation || '').replace(/"/g, '""')}"`,
        `"${(firstCtx.sentence || '').replace(/"/g, '""')}"`,
        `"${(firstCtx.startTime || '').replace(/"/g, '""')}"`,
        `"${(w.videoTitle || '').replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }

  return Object.freeze({
    analyzeSubtitles,
    getPosLabelVi,
    exportToAnkiFormat,
    exportToCsvFormat
  });
});
