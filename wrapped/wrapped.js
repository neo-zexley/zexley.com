/*
 * Group Chat Wrapped 2026 (BRAND_NAME below) — Zexley (assumed name of Bloom Commerce LLC)
 * Not affiliated with WhatsApp, Meta, or Spotify.
 * UNPUBLISHED PROTOTYPE. Everything runs in the browser. This file makes NO network
 * requests: no fetch, no XHR, no beacons, no analytics, no external fonts.
 * The page's Content-Security-Policy (connect-src 'none') also blocks them.
 * Stats are computed by code. Awards are for fun.
 */
(function (root) {
  'use strict';

  // ===================== PAYMENT PLACEHOLDER =====================
  // PAYMENT_LINK: put the Stripe Payment Link ($4.99 one-time) here ONLY after Chris
  // approves launch and creates it. While it is the placeholder, the unlock button
  // just shows "Payment not connected in this prototype".
  var PAYMENT_LINK = 'https://buy.stripe.com/00w28r5CjdzT3V88t0gbm02';
  // PROTOTYPE_PREVIEW: lets a reviewer see the locked slides. MUST be false at launch.
  var PROTOTYPE_PREVIEW = false;
  var PRICE = '$4.99';
  var FREE_SLIDES = 4;
  var TARGET_YEAR = 2026;
  // BRAND_NAME: the one place the product name lives. Used for the page title, headings,
  // slide 1, the share image and the download filename.
  var BRAND_NAME = 'Group Chat Wrapped 2026';
  // Unlock return (static site, no server; see NOTES.md "Unlock-return flow"):
  // before leaving for the Payment Link we save ONLY the computed stats (never chat text)
  // in this browser's localStorage. Stripe's after-payment redirect must be set to
  //   https://zexley.com/wrapped/?unlocked=1
  // This is an HONOR SYSTEM: anyone can type that URL. Nothing is verified with Stripe.
  var STORE_KEY = 'zexley-recap-v1';
  var PENDING_TTL_MS = 2 * 3600000;   // saved stats wait at most 2 hours for a return from checkout
  var PAID_TTL_MS = 24 * 3600000;     // after a paid return, kept 24 hours (or until "Forget")
  // ===============================================================

  // ---------- Parsing ----------
  var INVISIBLE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  var ODD_SPACES = /[\u202f\u00a0\u2009\u2007]/g;
  var DATE = '(\\d{1,4})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{1,4})';
  var TIME = '(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?\\s*([AaPp]\\.?\\s?[Mm]\\.?)?';
  var HEADER_IOS = new RegExp('^\\[' + DATE + ',?\\s+' + TIME + '\\]\\s?(.*)$');
  var HEADER_ANDROID = new RegExp('^' + DATE + ',?\\s+' + TIME + '\\s*[-\\u2013]\\s(.*)$');

  var MEDIA_RE = /^(<media omitted>|(image|video|audio|sticker|gif|document|contact card|photo|voice message) omitted|<attached: .+>|.+\.(jpe?g|png|webp|gif|opus|mp4|mp3|m4a|pdf|vcf) \(file attached\)(\n[\s\S]*)?|null)$/i;
  var STICKER_RE = /sticker omitted|STICKER-|\.webp \(file attached\)|<attached: .*\.webp>/i;
  var DELETED_RE = /^(this message was deleted|you deleted this message|this message was deleted by an admin)\.?$/i;
  var SYSTEM_RE = /end-to-end encrypted|^(.+ )?(created (this )?group|created group|added |removed |left$|joined using this group's invite link|joined from the community|changed the subject|changed this group's icon|changed the group description|changed their phone number|changed the group settings|deleted this group's icon|is now an admin|changed to .+|turned (on|off) disappearing messages|pinned a message|missed (voice|video) call)/i;
  var EDITED_RE = /\s*<this message was edited>\s*$/i;

  function clean(s) { return s.replace(INVISIBLE, '').replace(ODD_SPACES, ' '); }

  function matchHeader(line) {
    var m = HEADER_IOS.exec(line);
    if (m) return m;
    return HEADER_ANDROID.exec(line);
  }

  function inferDateOrder(raws) {
    if (!raws.length) return 'mdy';
    var i, ymd = false, aBig = false, bBig = false;
    for (i = 0; i < raws.length; i++) {
      if (raws[i][0].length === 4) ymd = true;
      if (+raws[i][0] > 12) aBig = true;
      if (+raws[i][1] > 12) bBig = true;
    }
    if (ymd) return 'ymd';
    if (aBig && !bBig) return 'dmy';
    if (bBig && !aBig) return 'mdy';
    // Ambiguous: pick the order that makes time run forward most often.
    function backs(order) {
      var prev = -Infinity, n = 0;
      for (var j = 0; j < raws.length; j++) {
        var r = raws[j], y = +r[2], mo = order === 'mdy' ? +r[0] : +r[1], d = order === 'mdy' ? +r[1] : +r[0];
        var v = y * 10000 + mo * 100 + d;
        if (v < prev) n++;
        prev = v;
      }
      return n;
    }
    return backs('dmy') < backs('mdy') ? 'dmy' : 'mdy';
  }

  function parseChat(text) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    var rawLines = text.split('\n');
    var entries = [], cur = null, i;
    for (i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i];
      var line = clean(raw).replace(/^\s+/, '');
      var m = matchHeader(line);
      if (m) {
        cur = { d: [m[1], m[2], m[3]], h: +m[4], mi: +m[5], s: +(m[6] || 0), ap: m[7] || '', body: m[8], lrm: /:\s?\u200e/.test(raw) };
        entries.push(cur);
      } else if (cur) {
        cur.body += '\n' + clean(raw);
      } // lines before the first header are ignored
    }
    var order = inferDateOrder(entries.map(function (e) { return e.d; }));
    var msgs = [];
    var groupName = null;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i], y, mo, d;
      if (order === 'ymd') { y = +e.d[0]; mo = +e.d[1]; d = +e.d[2]; }
      else if (order === 'dmy') { d = +e.d[0]; mo = +e.d[1]; y = +e.d[2]; }
      else { mo = +e.d[0]; d = +e.d[1]; y = +e.d[2]; }
      if (y < 100) y += 2000;
      var h = e.h, ap = e.ap.toLowerCase().replace(/[^ap]/g, '');
      if (ap === 'p' && h < 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23) continue;
      var t = Date.UTC(y, mo - 1, d, h, e.mi, e.s);
      var body = e.body, sender = null, txt = body;
      var ci = body.indexOf(': ');
      if (ci > 0 && ci <= 80) { sender = body.slice(0, ci).replace(/^~\s*/, '').trim(); txt = body.slice(ci + 2); }
      txt = txt.replace(EDITED_RE, '').replace(/\s+$/, '');
      var trimmed = txt.trim();
      var type = 'text';
      if (!sender) type = 'system';
      else if (DELETED_RE.test(trimmed)) type = 'deleted';
      else if (MEDIA_RE.test(trimmed)) type = STICKER_RE.test(trimmed) ? 'sticker' : 'media';
      // iOS marks system notices (in any language) with a leading LRM; real typed messages don't have one.
      else if (/end-to-end encrypted/i.test(trimmed) || e.lrm || (!sender && SYSTEM_RE.test(trimmed))) type = 'system';
      if (type === 'system') {
        var gm = /(?:created group|changed the subject (?:from .+ )?to) [“"](.+)[”"]/.exec(trimmed);
        if (gm) groupName = gm[1];
        if (sender && /end-to-end encrypted/i.test(trimmed)) groupName = groupName || sender;
      }
      msgs.push({ t: t, y: y, mo: mo, d: d, h: h, mi: e.mi, sender: type === 'system' ? null : sender, text: trimmed, type: type });
    }
    msgs.sort(function (a, b) { return a.t - b.t; });
    return { messages: msgs, dateOrder: order, groupName: groupName };
  }

  // ---------- Stats ----------
  var STOP = ('a about above after again against all also am an and any are as at be because been before being below between both but by can cant could did do does doing dont down during each few for from further get got had has have having he her here hers herself him himself his how i if im in into is isnt it its itself ive just let lets like me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that thats the their theirs them themselves then there these they this those through to too under until up very was wasnt we were what when where which while who whom why will with would you your yours yourself yourselves youre ill well yes yeah yep nope one two will thats theres gonna wanna also really still oh okay ok kk see know think going want need make go come back time today tomorrow tonight day good much many even thing things way said say tell sure maybe right new www http https com didnt doesnt wont cant thanks thank lol haha hahaha lmao omw hey hello hi');
  var STOPSET = {};
  STOP.split(' ').forEach(function (w) { STOPSET[w] = 1; });
  var EMOJI_RE;
  try { EMOJI_RE = new RegExp('(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}{2})(?:\\uFE0F|\\p{Emoji_Modifier}|\\u200D(?:\\p{Extended_Pictographic})\\uFE0F?)*', 'gu'); }
  catch (err) { EMOJI_RE = /[\u2600-\u27bf]|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83e[\udd00-\uddff]/g; }
  var LAUGH_RE = /\b(?:a?(?:ha){2,}h?|(?:he){2,}|lo+l+|lmf?ao+|rofl)\b|😂|🤣|😆|😹/gi;
  var OK_RE = /^(k+|kk+|ok+|okay|okie|okey|oki)[.!]?$/i;
  var HEART_RE = /❤|🥰|😍|😘|💕|💖|💗|💛|💙|💚|💜|🤗|\blove\b|\blove you\b/gi;
  var DAYNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Normalize emoji so "❤" and "❤️" count together; always display the emoji-style form.
  function emojiKey(e) { e = e.replace(/\uFE0F/g, ''); return Array.from(e).length === 1 && /^[\u2190-\u2bff\u3030\u303d\u3297\u3299\u00a9\u00ae]$/.test(e) ? e + '\uFE0F' : e.replace(/(\u200D)([\u2640\u2642\u2695\u2696\u2708\u2764])(?!\uFE0F)/g, '$1$2\uFE0F'); }
  function median(a) { if (!a.length) return Infinity; var s = a.slice().sort(function (x, y) { return x - y; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function topOf(map) { var best = null, bv = -1; for (var k in map) if (map[k] > bv) { bv = map[k]; best = k; } return best === null ? null : { key: best, count: bv }; }
  function topN(map, n) { return Object.keys(map).map(function (k) { return { key: k, count: map[k] }; }).sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); }).slice(0, n); }
  function fmtDate(t) { var d = new Date(t); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  function fmtHour(h) { var ap = h < 12 ? 'AM' : 'PM'; return (h % 12 || 12) + ' ' + ap; }
  function fmtGap(ms) { var s = Math.round(ms / 1000); if (s < 60) return s + ' sec'; var m = s / 60; if (m < 60) return (Math.round(m * 10) / 10) + ' min'; return (Math.round(m / 6) / 10) + ' hr'; }

  function computeStats(parsed, opts) {
    opts = opts || {};
    var year = opts.year || TARGET_YEAR;
    var all = parsed.messages.filter(function (m) { return m.type !== 'system'; });
    var inYear = all.filter(function (m) { return m.y === year; });
    var usedYear = inYear.length > 0;
    var msgs = usedYear ? inYear : all;
    var S = { year: year, usedYear: usedYear, total: msgs.length, totalAll: all.length, groupName: parsed.groupName, dateOrder: parsed.dateOrder };
    if (!msgs.length) { S.empty = true; return S; }
    S.first = msgs[0].t; S.last = msgs[msgs.length - 1].t;
    var people = {}, dayCount = {}, hourCount = new Array(24).fill(0), wdCount = new Array(7).fill(0), emojis = {}, words = {};
    var nameWords = {};
    msgs.forEach(function (m) { m.sender.toLowerCase().split(/[^\p{L}\p{N}']+/u).forEach(function (w) { if (w) nameWords[w] = 1; }); });
    function P(name) {
      return people[name] || (people[name] = { name: name, count: 0, words: 0, chars: 0, emojis: {}, emojiCount: 0, media: 0, sticker: 0, deleted: 0, laughs: 0, ok: 0, night: 0, early: 0, starts: 0, gaps: [], longest: null, questions: 0, exclaims: 0, hearts: 0 });
    }
    var prev = null;
    var SIX_H = 6 * 3600000, TWELVE_H = 12 * 3600000;
    msgs.forEach(function (m) {
      var p = P(m.sender);
      p.count++;
      var dk = Math.floor(m.t / 86400000);
      dayCount[dk] = (dayCount[dk] || 0) + 1;
      hourCount[m.h]++;
      wdCount[new Date(m.t).getUTCDay()]++;
      if (m.h >= 0 && m.h < 4) p.night++;
      if (m.h >= 5 && m.h < 8) p.early++;
      if (!prev || m.t - prev.t >= SIX_H) p.starts++;
      if (prev && prev.sender !== m.sender && m.t - prev.t <= TWELVE_H) p.gaps.push(m.t - prev.t);
      prev = m;
      if (m.type === 'media') { p.media++; return; }
      if (m.type === 'sticker') { p.sticker++; return; }
      if (m.type === 'deleted') { p.deleted++; return; }
      var tx = m.text;
      p.chars += tx.length;
      if (!p.longest || tx.length > p.longest.text.length) p.longest = { text: tx, t: m.t };
      if (OK_RE.test(tx.trim())) p.ok++;
      if (tx.indexOf('?') >= 0) p.questions++;
      if (/!/.test(tx)) p.exclaims++;
      var lm = tx.match(LAUGH_RE); if (lm) p.laughs += lm.length;
      var hm = tx.match(HEART_RE); if (hm) p.hearts += hm.length;
      var em = tx.match(EMOJI_RE);
      if (em) em.forEach(function (e) { e = emojiKey(e); p.emojis[e] = (p.emojis[e] || 0) + 1; emojis[e] = (emojis[e] || 0) + 1; p.emojiCount++; });
      var toks = tx.replace(/https?:\/\/\S+/g, ' ').toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
      p.words += toks.length;
      toks.forEach(function (w) {
        w = w.replace(/^'+|'+$/g, '').replace(/'/g, '');
        if (w.length < 3 || /^\d+$/.test(w) || STOPSET[w] || nameWords[w] || /^(a?(ha)+h?|(he)+|lo+l+|lmf?ao+|k+|ok+)$/.test(w)) return;
        words[w] = (words[w] || 0) + 1;
      });
    });
    var list = Object.keys(people).map(function (k) { var p = people[k]; p.share = p.count / msgs.length; p.medianGap = p.gaps.length >= 5 ? median(p.gaps) : Infinity; p.topEmoji = topOf(p.emojis); p.avgLen = (p.count - p.media - p.sticker - p.deleted) > 0 ? p.chars / (p.count - p.media - p.sticker - p.deleted) : 0; return p; })
      .sort(function (a, b) { return b.count - a.count; });
    S.people = list;
    S.topTalker = list[0];
    var bd = topOf(dayCount); S.busiestDay = { t: +bd.key * 86400000, count: bd.count };
    var bh = 0; hourCount.forEach(function (c, h) { if (c > hourCount[bh]) bh = h; }); S.busiestHour = { hour: bh, count: hourCount[bh] };
    var bw = 0; wdCount.forEach(function (c, i) { if (c > wdCount[bw]) bw = i; }); S.busiestWeekday = { day: DAYNAMES[bw], count: wdCount[bw] };
    var days = Object.keys(dayCount).map(Number).sort(function (a, b) { return a - b; });
    S.activeDays = days.length;
    var best = { len: 0 }, run = 1, start = days[0];
    for (var i = 0; i < days.length; i++) {
      if (i > 0 && days[i] === days[i - 1] + 1) run++; else { run = 1; start = days[i]; }
      if (run > best.len) best = { len: run, start: start * 86400000, end: days[i] * 86400000 };
    }
    S.streak = best;
    S.span = Math.max(1, Math.round((S.last - S.first) / 86400000) + 1);
    S.perDay = msgs.length / S.span;
    S.topEmojis = topN(emojis, 5);
    S.topWords = topN(words, 5);
    S.laughs = list.reduce(function (s, p) { return s + p.laughs; }, 0);
    S.media = list.reduce(function (s, p) { return s + p.media + p.sticker; }, 0);
    S.awards = assignAwards(list);
    return S;
  }

  // ---------- Awards (kind, never about appearance or identity) ----------
  var AWARDS = [
    { id: 'keeper', emoji: '🔥', title: 'Keeper of the Flame', metric: function (p) { return p.count; }, min: 1, line: function (p) { return p.count.toLocaleString('en-US') + ' messages kept this chat warm all year.'; } },
    { id: 'owl', emoji: '🦉', title: 'Night Owl', metric: function (p) { return p.night; }, min: 3, line: function (p) { return p.night + ' messages between midnight and 4 AM. Sweet dreams eventually.'; } },
    { id: 'bird', emoji: '🐦', title: 'Early Bird', metric: function (p) { return p.early; }, min: 3, line: function (p) { return p.early + ' messages between 5 and 8 AM. The chat\'s sunrise.'; } },
    { id: 'speedy', emoji: '⚡', title: 'Speedy Replier', metric: function (p) { return isFinite(p.medianGap) ? -p.medianGap : -Infinity; }, min: -Infinity, low: true, line: function (p) { return 'Typical reply in ' + fmtGap(p.medianGap) + '. Always there.'; } },
    { id: 'starter', emoji: '🎬', title: 'Conversation Starter', metric: function (p) { return p.starts; }, min: 2, line: function (p) { return 'Broke the silence ' + p.starts + ' times after 6+ quiet hours.'; } },
    { id: 'ok', emoji: '👌', title: 'Master of Few Words', metric: function (p) { return p.ok; }, min: 3, line: function (p) { return p.ok + ' perfectly efficient "k"s and "ok"s.'; } },
    { id: 'media', emoji: '📸', title: 'Family Photographer', metric: function (p) { return p.media; }, min: 3, line: function (p) { return p.media + ' photos, videos and files shared.'; } },
    { id: 'sticker', emoji: '🎨', title: 'Sticker Sorcerer', metric: function (p) { return p.sticker; }, min: 2, line: function (p) { return p.sticker + ' stickers deployed with precision.'; } },
    { id: 'novel', emoji: '📜', title: 'Novelist in Residence', metric: function (p) { return p.longest ? p.longest.text.length : 0; }, min: 80, line: function (p) { return 'Longest message of the year: ' + p.longest.text.length + ' characters.'; } },
    { id: 'laugh', emoji: '😂', title: 'Chief Laugh Officer', metric: function (p) { return p.laughs; }, min: 3, line: function (p) { return p.laughs + ' laughs (haha, lol, 😂) shared.'; } },
    { id: 'heart', emoji: '❤️', title: 'Warmest Heart', metric: function (p) { return p.hearts; }, min: 3, line: function (p) { return p.hearts + ' hearts and "love you"s sent.'; } },
    { id: 'emoji', emoji: '✨', title: 'Emoji Artist', metric: function (p) { return p.emojiCount; }, min: 5, line: function (p) { return p.emojiCount + ' emojis, favorite: ' + (p.topEmoji ? p.topEmoji.key : '') + '.'; } },
    { id: 'deleted', emoji: '🫣', title: 'Second Thoughts Award', metric: function (p) { return p.deleted; }, min: 2, line: function (p) { return p.deleted + ' messages lovingly un-sent. We\'ll never know.'; } },
    { id: 'question', emoji: '❓', title: 'Question Master', metric: function (p) { return p.questions; }, min: 3, line: function (p) { return p.questions + ' questions asked. Curiosity keeps a family close.'; } },
    { id: 'hype', emoji: '📣', title: 'Hype Squad Captain', metric: function (p) { return p.exclaims; }, min: 3, line: function (p) { return p.exclaims + ' messages with an exclamation point!'; } }
  ];

  function assignAwards(people) {
    var wins = {}, out = [];
    AWARDS.forEach(function (a) {
      var cands = people.map(function (p) { return { p: p, v: a.metric(p) }; })
        .filter(function (c) { return isFinite(c.v) && c.v >= a.min && (a.low || c.v > 0); })
        .sort(function (x, y) { return y.v - x.v; });
      if (!cands.length) return;
      var top = cands[0].v;
      var eligible = a.low ? cands.filter(function (c) { return -c.v <= -top * 3; }) : cands.filter(function (c) { return c.v >= top * 0.5; });
      eligible.sort(function (x, y) { return (wins[x.p.name] || 0) - (wins[y.p.name] || 0) || y.v - x.v; });
      var w = eligible[0];
      wins[w.p.name] = (wins[w.p.name] || 0) + 1;
      out.push({ id: a.id, emoji: a.emoji, title: a.title, winner: w.p.name, line: a.line(w.p) });
    });
    // Keep at most 12: drop later awards held by people who already won something else.
    for (var i = out.length - 1; i >= 0 && out.length > 12; i--) {
      if (wins[out[i].winner] > 1) { wins[out[i].winner]--; out.splice(i, 1); }
    }
    return out.slice(0, 12);
  }

  // ---------- ZIP (reads _chat.txt with the browser's own DecompressionStream) ----------
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function readZipChat(buf) {
    var b = new Uint8Array(buf), i, eocd = -1;
    for (i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('This does not look like a zip file.'));
    var n = u16(b, eocd + 10), off = u32(b, eocd + 16), entries = [];
    for (i = 0; i < n && u32(b, off) === 0x02014b50; i++) {
      var nameLen = u16(b, off + 28), extraLen = u16(b, off + 30), comLen = u16(b, off + 32);
      var name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nameLen));
      entries.push({ name: name, method: u16(b, off + 10), csize: u32(b, off + 20), local: u32(b, off + 42) });
      off += 46 + nameLen + extraLen + comLen;
    }
    var e = entries.filter(function (x) { return /(^|\/)_chat\.txt$/i.test(x.name); })[0] || entries.filter(function (x) { return /\.txt$/i.test(x.name) && !/^__MACOSX/.test(x.name); })[0];
    if (!e) return Promise.reject(new Error('No _chat.txt found inside the zip.'));
    var lo = e.local;
    if (u32(b, lo) !== 0x04034b50) return Promise.reject(new Error('Zip entry is damaged.'));
    var start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    var data = b.subarray(start, start + e.csize);
    if (e.method === 0) return Promise.resolve(new TextDecoder().decode(data));
    if (e.method !== 8) return Promise.reject(new Error('Unsupported zip compression.'));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Your browser cannot unzip here. Unzip the file and drop the _chat.txt instead.'));
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new TextDecoder().decode(ab); });
  }

  // ---------- Unlock-return storage (computed stats only, never chat text) ----------
  function slugify(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recap'; }
  function shareFilename() { return slugify(BRAND_NAME) + '.png'; }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }
  // Whitelist of what may be stored on the device. Deliberately leaves out per-person
  // working data (longest message text, reply gaps, emoji maps) so no message text is kept.
  function toStoredStats(S) {
    var person = function (p) { return { name: p.name, count: p.count, share: p.share, topEmoji: p.topEmoji ? { key: p.topEmoji.key, count: p.topEmoji.count } : null }; };
    var o = pick(S, ['year', 'usedYear', 'total', 'totalAll', 'groupName', 'first', 'last', 'activeDays', 'span', 'perDay', 'laughs', 'media']);
    o.people = (S.people || []).map(person);
    o.topTalker = S.topTalker ? person(S.topTalker) : null;
    o.busiestDay = pick(S.busiestDay, ['t', 'count']);
    o.busiestHour = pick(S.busiestHour, ['hour', 'count']);
    o.busiestWeekday = pick(S.busiestWeekday, ['day', 'count']);
    o.streak = pick(S.streak, ['len', 'start', 'end']);
    o.topEmojis = (S.topEmojis || []).map(function (e) { return { key: e.key, count: e.count }; });
    o.topWords = (S.topWords || []).map(function (e) { return { key: e.key, count: e.count }; });
    o.awards = (S.awards || []).map(function (a) { return pick(a, ['id', 'emoji', 'title', 'winner', 'line']); });
    return o;
  }
  function randomRef() {
    var b = new Uint8Array(12), c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return 'r' + Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  // storage = localStorage (or a test double with getItem/setItem/removeItem). All calls are
  // wrapped: private modes and disabled storage just make the flow fall back gracefully.
  function saveRecord(storage, S, opts) {
    opts = opts || {}; var now = opts.now || Date.now();
    var rec = { v: 1, ref: opts.ref || randomRef(), savedAt: now, expiresAt: now + (opts.paid ? PAID_TTL_MS : PENDING_TTL_MS), paid: !!opts.paid, stats: S ? toStoredStats(S) : null };
    try { storage.setItem(STORE_KEY, JSON.stringify(rec)); return rec; } catch (e) { return null; }
  }
  function loadRecord(storage, now) {
    now = now || Date.now(); var raw = null;
    try { raw = storage.getItem(STORE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    var rec = null; try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    if (!rec || rec.v !== 1 || typeof rec.expiresAt !== 'number' || rec.expiresAt <= now) { forgetRecord(storage); return null; }
    return rec;
  }
  function forgetRecord(storage) { try { storage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } }
  // Reads ?unlocked=1 (the official Stripe after-payment redirect). Honor system.
  // Also accepts the older ?paid=1&session_id=cs_... shape if a link is mis-set.
  // Rejects unlocked!=1, a missing flag, and an unsubstituted {CHECKOUT_SESSION_ID}.
  function parseReturn(search) {
    var q = {}; String(search || '').replace(/^\?/, '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); var k = i < 0 ? kv : kv.slice(0, i); var v = i < 0 ? '' : kv.slice(i + 1); try { q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* ignore */ } });
    if (q.unlocked === '1') return { paid: true };
    if (q.unlocked !== undefined) return { paid: false };
    if (q.paid !== '1') return null;
    var sid = q.session_id || '';
    return { paid: /^cs_(test|live)_[A-Za-z0-9_]{6,200}$/.test(sid), sessionId: sid };
  }
  // Turns the saved record after a paid return: unlocked, kept PAID_TTL_MS from now.
  function markPaid(storage, rec, now) {
    now = now || Date.now();
    rec.paid = true; rec.expiresAt = now + PAID_TTL_MS; rec.paidAt = now;
    try { storage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
    return rec;
  }
  function paymentUrl(ref) { return PAYMENT_LINK + (PAYMENT_LINK.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(ref); }

  var api = { parseChat: parseChat, computeStats: computeStats, assignAwards: assignAwards, readZipChat: readZipChat, inferDateOrder: inferDateOrder, AWARDS: AWARDS, fmtDate: fmtDate, fmtHour: fmtHour, PAYMENT_LINK: PAYMENT_LINK, PROTOTYPE_PREVIEW: PROTOTYPE_PREVIEW, BRAND_NAME: BRAND_NAME, STORE_KEY: STORE_KEY, PENDING_TTL_MS: PENDING_TTL_MS, PAID_TTL_MS: PAID_TTL_MS, slugify: slugify, shareFilename: shareFilename, toStoredStats: toStoredStats, saveRecord: saveRecord, loadRecord: loadRecord, forgetRecord: forgetRecord, markPaid: markPaid, parseReturn: parseReturn, paymentUrl: paymentUrl };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.Wrapped = api;

  // ===================== Browser UI =====================
  var doc = root.document;
  var state = { stats: null, slides: [], idx: 0, unlocked: false, paidMarker: false };
  function $(s) { return doc.querySelector(s); }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nf(n) { return Math.round(n).toLocaleString('en-US'); }
  function firstName(n) { return n; }

  function setStatus(msg, isErr) { var s = $('#status'); s.textContent = msg; s.className = 'status' + (isErr ? ' err' : ''); }

  function handleText(text, label) {
    var parsed = parseChat(text);
    if (!parsed.groupName && label) {
      var m = /WhatsApp Chat (?:with |- )(.+?)(?:\.txt|\.zip)?$/i.exec(label);
      if (m) parsed.groupName = m[1];
    }
    var S = computeStats(parsed);
    if (S.empty) { setStatus('We could not find any WhatsApp messages in that file. Make sure it is a WhatsApp "Export chat" file (.txt or .zip).', true); return; }
    state.stats = S;
    state.unlocked = state.paidMarker;
    showDeck(S);
  }

  function showDeck(S) {
    buildSlides(S);
    $('#intro').hidden = true;
    $('#deck').hidden = false;
    show(0);
    $('#deck').scrollIntoView({ block: 'start' });
    setStatus('');
  }

  function handleFile(file) {
    if (!file) return;
    setStatus('Reading on your device…');
    var isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
    var reader = new FileReader();
    reader.onerror = function () { setStatus('Could not read that file.', true); };
    reader.onload = function () {
      if (isZip) {
        readZipChat(reader.result).then(function (t) { handleText(t, file.name); }, function (err) { setStatus(err.message, true); });
      } else {
        handleText(new TextDecoder().decode(reader.result), file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function slide(kind, title) { var s = el('section', 'slide slide-' + kind); s.setAttribute('aria-roledescription', 'slide'); var inner = el('div', 'slide-inner'); s.appendChild(inner); if (title) inner.appendChild(el('p', 'slide-kicker', title)); return { node: s, inner: inner }; }
  function big(parent, num, label) { var d = el('div', 'big'); d.appendChild(el('div', 'big-num', num)); if (label) d.appendChild(el('div', 'big-label', label)); parent.appendChild(d); }

  function buildSlides(S) {
    var name = S.groupName || 'Your group chat';
    var slides = [];
    var yr = S.usedYear ? String(S.year) : 'all time';

    var s1 = slide('intro', BRAND_NAME);
    s1.inner.appendChild(el('h2', 'slide-title', name));
    big(s1.inner, nf(S.total), 'messages in ' + yr);
    s1.inner.appendChild(el('p', 'slide-sub', S.people.length + ' people · ' + S.activeDays + ' active days'));
    if (!S.usedYear) s1.inner.appendChild(el('p', 'slide-note', 'No ' + S.year + ' messages found, so this covers everything: ' + fmtDate(S.first) + ' to ' + fmtDate(S.last) + '.'));
    else if (S.totalAll > S.total) s1.inner.appendChild(el('p', 'slide-note', 'Counting ' + S.year + ' only (' + nf(S.totalAll - S.total) + ' older messages left out).'));
    slides.push(s1);

    var s2 = slide('busy', 'When you talked');
    big(s2.inner, fmtDate(S.busiestDay.t), 'busiest day · ' + nf(S.busiestDay.count) + ' messages');
    big(s2.inner, fmtHour(S.busiestHour.hour), 'busiest hour');
    big(s2.inner, S.busiestWeekday.day, 'busiest weekday');
    s2.inner.appendChild(el('p', 'slide-sub', 'About ' + (Math.round(S.perDay * 10) / 10) + ' messages a day'));
    slides.push(s2);

    var s3 = slide('talk', 'Who talked most');
    s3.inner.appendChild(el('h2', 'slide-title', S.topTalker.name));
    s3.inner.appendChild(el('p', 'slide-sub', nf(S.topTalker.count) + ' messages · ' + Math.round(S.topTalker.share * 100) + '% of the chat'));
    var bars = el('ul', 'bars');
    S.people.slice(0, 8).forEach(function (p) {
      var li = el('li'); var lab = el('span', 'bar-label', p.name); var track = el('span', 'bar-track'); var fill = el('span', 'bar-fill');
      fill.style.width = Math.max(2, Math.round(p.share / S.topTalker.share * 100)) + '%';
      track.appendChild(fill); li.appendChild(lab); li.appendChild(track); li.appendChild(el('span', 'bar-val', Math.round(p.share * 100) + '%')); bars.appendChild(li);
    });
    if (S.people.length > 8) bars.appendChild(el('li', 'bar-more', '+ ' + (S.people.length - 8) + ' more'));
    s3.inner.appendChild(bars);
    slides.push(s3);

    var s4 = slide('streak', 'Longest streak');
    big(s4.inner, S.streak.len + ' days', 'in a row with at least one message');
    s4.inner.appendChild(el('p', 'slide-sub', fmtDate(S.streak.start) + ' → ' + fmtDate(S.streak.end)));
    slides.push(s4);

    var s5 = slide('emoji', 'Emoji of the year');
    if (S.topEmojis.length) {
      big(s5.inner, S.topEmojis[0].key, 'used ' + nf(S.topEmojis[0].count) + ' times');
      var ul = el('ul', 'mini');
      S.people.slice(0, 8).forEach(function (p) { if (p.topEmoji) ul.appendChild(el('li', null, p.name + ': ' + p.topEmoji.key)); });
      s5.inner.appendChild(ul);
    } else s5.inner.appendChild(el('p', 'slide-sub', 'A purely emoji-free year. Impressive restraint.'));
    slides.push(s5);

    var s6 = slide('word', 'Word of the year');
    if (S.topWords.length) {
      big(s6.inner, '“' + S.topWords[0].key + '”', 'said ' + nf(S.topWords[0].count) + ' times');
      s6.inner.appendChild(el('p', 'slide-sub', 'Runners-up: ' + S.topWords.slice(1).map(function (w) { return w.key; }).join(', ')));
    } else s6.inner.appendChild(el('p', 'slide-sub', 'Not enough words to pick one.'));
    slides.push(s6);

    var s7 = slide('laugh', 'Laugh-o-meter');
    big(s7.inner, nf(S.laughs), 'laughs (haha, lol, 😂, 🤣)');
    big(s7.inner, nf(S.media), 'photos, videos and stickers');
    slides.push(s7);

    for (var i = 0; i < S.awards.length; i += 4) {
      var sa = slide('awards', 'The awards' + (S.awards.length > 4 ? ' (' + (i / 4 + 1) + '/' + Math.ceil(S.awards.length / 4) + ')' : ''));
      var ula = el('ul', 'awards');
      S.awards.slice(i, i + 4).forEach(function (a) {
        var li = el('li'); li.appendChild(el('span', 'aw-emoji', a.emoji));
        var tx = el('div'); tx.appendChild(el('strong', null, a.title)); tx.appendChild(el('span', 'aw-win', a.winner)); tx.appendChild(el('span', 'aw-line', a.line));
        li.appendChild(tx); ula.appendChild(li);
      });
      sa.inner.appendChild(ula);
      slides.push(sa);
    }

    var ss = slide('summary', 'Your ' + yr + ' in one slide');
    ss.inner.appendChild(el('h2', 'slide-title', name));
    var grid = el('dl', 'sum');
    [['Messages', nf(S.total)], ['Top talker', S.topTalker.name], ['Busiest day', fmtDate(S.busiestDay.t)], ['Streak', S.streak.len + ' days'], ['Emoji', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word', S.topWords[0] ? S.topWords[0].key : '—']].forEach(function (r) { grid.appendChild(el('dt', null, r[0])); grid.appendChild(el('dd', null, r[1])); });
    ss.inner.appendChild(grid);
    var ul2 = el('ul', 'sum-awards');
    S.awards.slice(0, 6).forEach(function (a) { ul2.appendChild(el('li', null, a.emoji + ' ' + a.title + ': ' + a.winner)); });
    ss.inner.appendChild(ul2);
    ss.inner.appendChild(el('p', 'slide-foot', 'made at zexley.com · stats computed by code, awards for fun · not affiliated with WhatsApp, Meta, or Spotify'));
    slides.push(ss);

    state.slides = slides;
    var track = $('#slides'); track.textContent = '';
    slides.forEach(function (s, k) {
      s.node.id = 'slide-' + (k + 1);
      s.node.setAttribute('aria-label', 'Slide ' + (k + 1) + ' of ' + slides.length);
      if (k >= FREE_SLIDES) {
        s.node.classList.add('locked');
        var lock = el('div', 'lock');
        lock.appendChild(el('p', 'lock-title', '🔒 ' + (slides.length - FREE_SLIDES) + ' more slides, including all ' + S.awards.length + ' awards'));
        var b = el('button', 'btn unlock-btn', 'Unlock everything · ' + PRICE + ' one-time');
        b.type = 'button'; b.addEventListener('click', onUnlock);
        lock.appendChild(b);
        var note = el('p', 'lock-note');
        note.appendChild(doc.createTextNode('If the unlock doesn’t work or you’re unhappy, email neo@zexley.com within 14 days of purchase and we’ll refund the $4.99. You don’t need to send us your chat. By paying, you agree to the '));
        var ta = el('a', null, 'Terms');
        ta.href = '../terms.html';
        note.appendChild(ta);
        note.appendChild(document.createTextNode('.'));
        lock.appendChild(note);
        s.node.appendChild(lock);
      }
      track.appendChild(s.node);
    });
    applyLock();
    var dots = $('#dots'); dots.textContent = '';
    slides.forEach(function (_, k) { var d = el('button', 'dot'); d.type = 'button'; d.setAttribute('aria-label', 'Go to slide ' + (k + 1)); d.addEventListener('click', function () { show(k); }); dots.appendChild(d); });
  }

  function applyLock() {
    state.slides.forEach(function (s, k) {
      if (k < FREE_SLIDES) return;
      s.node.classList.toggle('locked', !state.unlocked);
      s.inner.setAttribute('aria-hidden', state.unlocked ? 'false' : 'true');
    });
  }

  function show(k) {
    var n = state.slides.length; if (!n) return;
    state.idx = Math.max(0, Math.min(n - 1, k));
    state.slides.forEach(function (s, i) { s.node.hidden = i !== state.idx; });
    var dots = doc.querySelectorAll('#dots .dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === state.idx);
    $('#counter').textContent = (state.idx + 1) + ' / ' + n;
    $('#prev').disabled = state.idx === 0; $('#next').disabled = state.idx === n - 1;
  }

  function store() { try { return root.localStorage; } catch (e) { return null; } }

  function onUnlock() {
    var note = $('#paynote');
    if (PAYMENT_LINK.indexOf('PLACEHOLDER') >= 0) {
      note.hidden = false;
      note.querySelector('.pay-msg').textContent = 'Payment not connected in this prototype. Nothing was charged.';
      $('#preview-unlock').hidden = !PROTOTYPE_PREVIEW;
      $('#simulate-return').hidden = !PROTOTYPE_PREVIEW;
      return;
    }
    // At launch (after Chris approves): save the computed stats (never the chat) on this
    // device, then go to the Stripe Payment Link in this tab. Stripe redirects back to
    // ?unlocked=1 and init() restores the deck unlocked.
    var rec = store() && saveRecord(store(), state.stats);
    if (rec) { root.location.assign(paymentUrl(rec.ref)); return; }
    // Storage blocked (some private modes): keep this tab's deck and pay in a new tab.
    root.open(PAYMENT_LINK, '_blank', 'noopener');
    note.hidden = false;
    note.querySelector('.pay-msg').textContent = 'Checkout opened in a new tab. Your browser blocks on-device storage, so keep this tab open and come back to it after paying.';
  }

  // PROTOTYPE ONLY: does exactly what a real checkout return would do, without Stripe.
  function simulateReturn() {
    var rec = store() && saveRecord(store(), state.stats);
    if (!rec) { setStatus('This browser blocks on-device storage, so the return cannot be simulated.', true); return; }
    root.location.assign(root.location.pathname + '?unlocked=1');
  }

  function fmtClock(t) { var d = new Date(t); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  function forgetNow() {
    var s = store(); if (s) forgetRecord(s);
    state.paidMarker = false;
    reset();
    $('#saved').hidden = true;
    setStatus('Forgotten. Nothing from your recap is stored on this device.');
  }

  function showSaved(rec) {
    var box = $('#saved'); box.hidden = false;
    box.querySelector('.saved-msg').textContent = rec.stats
      ? (rec.paid ? 'Your unlocked recap' : 'Your recap') + (rec.stats.groupName ? ' for “' + rec.stats.groupName + '”' : '') + ' is saved on this device until ' + fmtClock(rec.expiresAt) + '. Only the stats are saved, never your messages.'
      : 'Your unlock is remembered on this device until ' + fmtClock(rec.expiresAt) + '. Load your chat and it opens fully unlocked. No chat data is saved.';
    scheduleExpiry(rec);
    $('#saved-open').hidden = !rec.stats;
  }

  // Clear the saved record at its expiry even if this tab stays open.
  var expiryTimer = null;
  function scheduleExpiry(rec) {
    if (expiryTimer) clearTimeout(expiryTimer);
    var ms = rec.expiresAt - Date.now();
    if (ms > 0 && ms < 2147483647) expiryTimer = setTimeout(function () { var s = store(); if (s) loadRecord(s); }, ms + 1000);
  }

  function restore(rec) {
    scheduleExpiry(rec);
    state.stats = rec.stats; state.unlocked = !!rec.paid;
    showDeck(rec.stats);
  }

  function handleReturn() {
    var s = store(), ret = parseReturn(root.location.search);
    if (ret) {
      // Drop ?unlocked=1 (and any leftover query) from the address bar so it is not bookmarked or shared.
      try { root.history.replaceState(null, '', root.location.pathname + root.location.hash); } catch (e) { /* file:// may refuse */ }
      if (!ret.paid) { setStatus('That payment link looks incomplete, so nothing was unlocked. If you paid, email neo@zexley.com.', true); }
      else {
        var rec = s && loadRecord(s);
        if (rec) { markPaid(s, rec); if (rec.stats) { $('#deck-msg').hidden = false; $('#deck-msg').textContent = 'Thanks! Your full recap is unlocked. It is kept on this device until ' + fmtClock(rec.expiresAt) + ', or press “Forget my recap now”.'; restore(rec); return; } }
        // Paid, but the saved stats are gone (expired, other browser, storage blocked).
        var marker = s && saveRecord(s, null, { paid: true }); if (marker) scheduleExpiry(marker);
        state.paidMarker = true;
        setStatus('Thanks for paying! Your saved recap is no longer on this device. Load your chat again and it will open fully unlocked.');
        return;
      }
    }
    var saved = s && loadRecord(s);
    if (saved) { state.paidMarker = !!saved.paid; showSaved(saved); }
  }

  // ---------- Share image (1080x1920 PNG, drawn on the device) ----------
  function fitText(ctx, text, maxW) { if (ctx.measureText(text).width <= maxW) return text; while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }
  function drawShare() {
    var S = state.stats, c = doc.createElement('canvas'); c.width = 1080; c.height = 1920;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, '#12352a'); g.addColorStop(0.55, '#1a1814'); g.addColorStop(1, '#6e2410');
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    x.fillStyle = 'rgba(217,164,65,0.25)';
    for (var i = 0; i < 70; i++) { var px = (i * 397) % 1080, py = (i * 733) % 1920; x.beginPath(); x.arc(px, py, 2 + (i % 4), 0, Math.PI * 2); x.fill(); }
    var serif = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif', sans = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'center'; x.fillStyle = '#d9a441'; x.font = '600 40px ' + sans;
    x.fillText(fitText(x, BRAND_NAME.toUpperCase(), 1000).split('').join(String.fromCharCode(8202)), 540, 170);
    x.fillStyle = '#fffaf2'; x.font = '700 84px ' + serif; x.fillText(fitText(x, S.groupName || 'Our group chat', 960), 540, 290);
    x.font = '700 200px ' + serif; x.fillStyle = '#fffaf2'; x.fillText(nf(S.total), 540, 530);
    x.font = '400 44px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText('messages' + (S.usedYear ? ' in ' + S.year : ' (all time)'), 540, 600);
    var rows = [['Top talker', S.topTalker.name], ['Busiest day', fmtDate(S.busiestDay.t)], ['Longest streak', S.streak.len + ' days'], ['Emoji of the year', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word of the year', S.topWords[0] ? S.topWords[0].key : '—']];
    var y = 720;
    rows.forEach(function (r) { x.textAlign = 'left'; x.font = '400 40px ' + sans; x.fillStyle = '#d9a441'; x.fillText(r[0], 110, y); x.textAlign = 'right'; x.font = '700 46px ' + sans; x.fillStyle = '#fffaf2'; x.fillText(fitText(x, r[1], 520), 970, y); y += 90; });
    y += 20; x.strokeStyle = 'rgba(217,164,65,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(110, y); x.lineTo(970, y); x.stroke(); y += 80;
    x.textAlign = 'center';
    if (state.unlocked) {
      x.font = '700 50px ' + serif; x.fillStyle = '#d9a441'; x.fillText('The awards', 540, y); y += 80;
      S.awards.slice(0, 6).forEach(function (a) { x.font = '400 40px ' + sans; x.fillStyle = '#fffaf2'; x.fillText(fitText(x, a.emoji + ' ' + a.title + ': ' + a.winner, 900), 540, y); y += 72; });
    } else {
      x.font = '700 56px ' + serif; x.fillStyle = '#d9a441'; x.fillText(S.awards.length + ' group awards inside 🏆', 540, y + 40);
      x.font = '400 40px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText('Who is the Night Owl? The Speedy Replier?', 540, y + 130);
    }
    x.font = '400 34px ' + sans; x.fillStyle = '#e8dcc6'; x.textAlign = 'center';
    x.fillText('made at zexley.com · stats computed by code, awards for fun', 540, 1820);
    x.font = '400 26px ' + sans; x.fillStyle = '#b8ab92';
    x.fillText('Not affiliated with WhatsApp, Meta, or Spotify', 540, 1872);
    return c;
  }
  function downloadShare() {
    var c = drawShare();
    c.toBlob(function (blob) {
      var url = URL.createObjectURL(blob), a = doc.createElement('a');
      a.href = url; a.download = shareFilename();
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, 'image/png');
  }
  api.drawShare = drawShare;

  function reset() { state = { stats: null, slides: [], idx: 0, unlocked: false, paidMarker: state.paidMarker }; $('#deck-msg').hidden = true; $('#slides').textContent = ''; $('#deck').hidden = true; $('#intro').hidden = false; $('#paynote').hidden = true; $('#file').value = ''; setStatus(''); }

  function applyBrand() {
    doc.title = BRAND_NAME + ' — Zexley';
    var n = doc.querySelectorAll('[data-brand]');
    for (var i = 0; i < n.length; i++) n[i].textContent = BRAND_NAME;
  }

  function init() {
    applyBrand();
    var drop = $('#drop'), file = $('#file');
    file.addEventListener('change', function () { handleFile(file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; handleFile(f); });
    $('#sample').addEventListener('click', function () { handleText($('#sample-chat').textContent, 'WhatsApp Chat - The Puddleworths 🎄 (sample).txt'); });
    $('#prev').addEventListener('click', function () { show(state.idx - 1); });
    $('#next').addEventListener('click', function () { show(state.idx + 1); });
    doc.addEventListener('keydown', function (e) { if ($('#deck').hidden) return; if (e.key === 'ArrowRight') show(state.idx + 1); if (e.key === 'ArrowLeft') show(state.idx - 1); });
    $('#share').addEventListener('click', downloadShare);
    $('#restart').addEventListener('click', reset);
    $('#preview-unlock').addEventListener('click', function () { state.unlocked = true; applyLock(); $('#paynote').hidden = true; });
    $('#paynote-close').addEventListener('click', function () { $('#paynote').hidden = true; });
    $('#simulate-return').addEventListener('click', simulateReturn);
    $('#forget').addEventListener('click', forgetNow);
    $('#saved-forget').addEventListener('click', forgetNow);
    $('#saved-open').addEventListener('click', function () { var s = store(), rec = s && loadRecord(s); $('#saved').hidden = true; if (rec && rec.stats) restore(rec); else setStatus('That saved recap has expired and was cleared.'); });
    handleReturn();
    var touchX = null;
    $('#slides').addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    $('#slides').addEventListener('touchend', function (e) { if (touchX == null) return; var dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) show(state.idx + (dx < 0 ? 1 : -1)); touchX = null; });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
