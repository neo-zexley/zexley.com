/*
 * Group Chat Wrapped 2026 (BRAND_NAME below) — Zexley (assumed name of Bloom Commerce LLC)
 * Not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, or Spotify.
 * Reads WhatsApp "Export chat" text files, Telegram Desktop "Machine-readable JSON" exports,
 * and (v5 draft) Instagram / Facebook Messenger chats from Meta's "Download your information" JSON export.
 * v4 (published): share image includes a "Make yours" call-to-action and an on-device QR code.
 * v5 (UNPUBLISHED draft): Instagram + Messenger JSON, non-English WhatsApp exports (de/es/pt/fr/it/nl).
 * Everything runs in the browser. This file makes NO network
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
  // v5: ",?\s+(?:à\s+)?" also accepts French Android exports ("22/11/2026 à 14:05 - ...").
  var SEP = ',?\\s+(?:\u00e0\\s+)?';
  var HEADER_IOS = new RegExp('^\\[' + DATE + SEP + TIME + '\\]\\s?(.*)$');
  var HEADER_ANDROID = new RegExp('^' + DATE + SEP + TIME + '\\s*[-\\u2013]\\s(.*)$');

  var MEDIA_RE = /^(<media omitted>|(image|video|audio|sticker|gif|document|contact card|photo|voice message) omitted|<attached: .+>|.+\.(jpe?g|png|webp|gif|opus|mp4|mp3|m4a|pdf|vcf) \(file attached\)(\n[\s\S]*)?|null)$/i;
  // v5: non-English media placeholders. Each must be the WHOLE message, so a wrong guess can only
  // fail to match; it can never swallow a real message. See CHANGES.md for which ones are verified.
  // Android "<...>" forms: de, es, pt (BR + older wording), fr, it, nl.
  var MEDIA_L10N_RE = /^(<medien ausgeschlossen>|<multimedia omitido>|<m\u00eddia oculta>|<arquivo de m\u00eddia oculto>|<m\u00e9dias omis>|<media omessi>|<media weggelaten>|(bild|video|audio|sticker|gif|dokument) weggelassen|(imagen|sticker|gif|documento) omitid[ao]|(video|v\u00eddeo|audio) omitido)$/i;
  // Any language: "<Anhang: 00000012-PHOTO-2026-11-22.jpg>" (iOS with media) and
  // "IMG-20261122-WA0001.jpg (Datei angeh\u00e4ngt)" (Android with media).
  var MEDIA_FILE_RE = /^(<[^<>:\n]{2,24}: [^<>\n]+\.(jpe?g|png|webp|gif|opus|mp4|mp3|m4a|pdf|vcf|3gp|aac|heic|mov)>|\S+\.(jpe?g|png|webp|gif|opus|mp4|mp3|m4a|pdf|vcf|3gp|aac|heic|mov) \([^()\n]{3,40}\)(\n[\s\S]*)?)$/i;
  var STICKER_RE = /sticker omitted|sticker weggelassen|sticker omitido|STICKER-|\.webp \(|<[^<>]+\.webp>/i;
  var DELETED_RE = /^(this message was deleted|you deleted this message|this message was deleted by an admin)\.?$/i;
  // v5: deleted-message notices in de, es, pt, fr, it, nl (whole message only).
  var DELETED_L10N_RE = /^(diese nachricht wurde gel\u00f6scht|du hast diese nachricht gel\u00f6scht|se elimin\u00f3 este mensaje|eliminaste este mensaje|mensagem apagada|esta mensagem foi apagada|voc\u00ea apagou esta mensagem|ce message a \u00e9t\u00e9 supprim\u00e9|vous avez supprim\u00e9 ce message|questo messaggio \u00e8 stato eliminato|hai eliminato questo messaggio|dit bericht is verwijderd|je hebt dit bericht verwijderd)\.?$/i;
  // v5: the "messages and calls are end-to-end encrypted" notice. Localized notices always also say "WhatsApp".
  var ENCRYPT_RE = /end-to-end encrypted/i;
  var ENCRYPT_L10N_RE = /end-to-end|ende-zu-ende|de extremo a extremo|de ponta a ponta|de bout en bout/i;
  var GROUP_WORD_RE = /grupp|grupo|groupe|groep|betreff|asunto|assunto|sujet|oggetto|onderwerp/i;
  var QUOTED_RE = /[\u201e\u201c"\u00ab\u2039]\s*([^\u201e\u201c\u201d"\u00ab\u00bb\u2039\u203a\n]{1,80}?)\s*[\u201c\u201d"\u00bb\u203a]/g;
  function isEncryptNotice(t) { return ENCRYPT_RE.test(t) || (ENCRYPT_L10N_RE.test(t) && /whatsapp/i.test(t)); }
  var SYSTEM_RE = /end-to-end encrypted|^(.+ )?(created (this )?group|created group|added |removed |left$|joined using this group's invite link|joined from the community|changed the subject|changed this group's icon|changed the group description|changed their phone number|changed the group settings|deleted this group's icon|is now an admin|changed to .+|turned (on|off) disappearing messages|pinned a message|missed (voice|video) call)/i;
  var EDITED_RE = /\s*<(this message was edited|diese nachricht wurde bearbeitet|se edit\u00f3 este mensaje\.?|mensagem editada|ce message a \u00e9t\u00e9 modifi\u00e9|questo messaggio \u00e8 stato modificato|dit bericht is bewerkt)>\s*$/i;
  // v5: an Android notice like  Anna hat den Betreff von \u201eTrip: 2025\u201c ...  has an opening quote that is
  // not closed before the colon. Real display names practically never do, in any language.
  function hasOpenQuote(s) {
    var n = function (re) { return (s.match(re) || []).length; };
    if (n(/"/g) % 2 === 1) return true;
    if (n(/\u201e/g)) return n(/\u201e/g) > n(/\u201c/g);                       // German \u201e...\u201c
    return n(/[\u201c\u00ab\u2039]/g) > n(/[\u201d\u00bb\u203a]/g);             // \u201c...\u201d, \u00ab...\u00bb, \u2039...\u203a
  }

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
      // Android system notices have no "Name: " prefix. A colon inside the
      // notice (e.g. Ann changed the subject from "Trip: 2025" to "Fam")
      // was being read as a fake member. Undo that when the extracted
      // "sender" itself looks like a system line.
      if (sender && ((SYSTEM_RE.test(body) && SYSTEM_RE.test(sender)) || hasOpenQuote(sender))) {
        sender = null;
        txt = body;
      }
      txt = txt.replace(EDITED_RE, '').replace(/\s+$/, '');
      var trimmed = txt.trim();
      var type = 'text';
      if (!sender) type = 'system';
      else if (isEncryptNotice(trimmed)) type = 'system';
      else if (DELETED_RE.test(trimmed) || DELETED_L10N_RE.test(trimmed)) type = 'deleted';
      else if (MEDIA_RE.test(trimmed) || MEDIA_L10N_RE.test(trimmed) || MEDIA_FILE_RE.test(trimmed)) type = STICKER_RE.test(trimmed) ? 'sticker' : 'media';
      // iOS marks system notices (in any language) with a leading LRM; real typed messages don't have one.
      else if (e.lrm || (!sender && SYSTEM_RE.test(trimmed))) type = 'system';
      if (type === 'system') {
        var gm = /(?:created group|changed the (?:subject|group name) (?:from .+ )?to) [“"](.+)[”"]/.exec(trimmed);
        if (gm) groupName = gm[1];
        else if (GROUP_WORD_RE.test(trimmed)) {
          // v5, other languages: take the last quoted name in a "created group" / "changed subject" notice.
          var qm, last = null; QUOTED_RE.lastIndex = 0;
          while ((qm = QUOTED_RE.exec(trimmed))) last = qm[1];
          if (last) groupName = last;
        }
        if (sender && isEncryptNotice(trimmed)) groupName = groupName || sender;
      }
      msgs.push({ t: t, y: y, mo: mo, d: d, h: h, mi: e.mi, sender: type === 'system' ? null : sender, text: trimmed, type: type });
    }
    msgs.sort(function (a, b) { return a.t - b.t; });
    return { messages: msgs, dateOrder: order, groupName: groupName, format: 'whatsapp' };
  }

  // ---------- Telegram (Telegram Desktop "Export chat history", format "Machine-readable JSON") ----------
  // result.json: { name, type, id, messages: [{ id, type: 'message'|'service', date: '2026-01-05T14:03:11',
  //   date_unixtime, from, from_id, text: string | [string | {type, text}], media_type?, photo?, file?,
  //   sticker_emoji?, ... }] }. Each message is mapped onto the same shape parseChat() returns,
  // so every stat and award works unchanged. Service messages (joins, pins, title changes, calls) are skipped.
  function friendly(msg) { var e = new Error(msg); e.friendly = true; return e; }
  var TG_DATE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
  var TG_MEDIA_KEYS = ['photo', 'file', 'location_information', 'contact_information', 'poll', 'game_title', 'invoice_information'];
  function flattenTgText(t) {
    if (t == null) return '';
    if (typeof t === 'string') return t;
    if (Array.isArray(t)) return t.map(function (p) { return typeof p === 'string' ? p : (p && typeof p.text === 'string' ? p.text : ''); }).join('');
    if (typeof t === 'object' && typeof t.text === 'string') return t.text;
    return '';
  }
  function parseTelegram(data) {
    if (typeof data === 'string') {
      try { data = JSON.parse(data.replace(/^\ufeff/, '')); }
      catch (err) { throw friendly('That file looks like JSON, but it could not be read. It may be cut off or damaged. Export the chat from Telegram Desktop again (format: "Machine-readable JSON") and drop the result.json.'); }
    }
    if (!data || typeof data !== 'object') throw friendly('That JSON file is not a Telegram chat export, an Instagram chat, or a Messenger chat.');
    if (!Array.isArray(data.messages)) {
      if (data.chats || data.personal_information) throw friendly('That looks like a full Telegram account export. Export just one chat instead: open the chat in Telegram Desktop, choose "Export chat history", and pick "Machine-readable JSON".');
      throw friendly('That JSON file is not a Telegram chat export (no "messages" list). In Telegram Desktop, open the chat, choose "Export chat history", and pick "Machine-readable JSON". For Instagram or Messenger, drop the .zip from "Download your information" (JSON format) or a message_1.json.');
    }
    var msgs = [];
    data.messages.forEach(function (m) {
      if (!m || typeof m !== 'object' || m.type !== 'message') return; // skip service messages and anything unknown
      var dm = TG_DATE.exec(String(m.date || '')), y, mo, d, h, mi, sec;
      if (dm) { y = +dm[1]; mo = +dm[2]; d = +dm[3]; h = +dm[4]; mi = +dm[5]; sec = +(dm[6] || 0); }
      else if (isFinite(+m.date_unixtime) && +m.date_unixtime > 0) {
        // Fallback only: unix time is UTC, while "date" is the exporting computer's local time.
        var dt = new Date(+m.date_unixtime * 1000);
        y = dt.getUTCFullYear(); mo = dt.getUTCMonth() + 1; d = dt.getUTCDate(); h = dt.getUTCHours(); mi = dt.getUTCMinutes(); sec = dt.getUTCSeconds();
      } else return;
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return;
      var sender = m.from != null && String(m.from).trim() ? clean(String(m.from)).trim() : (m.from_id ? 'Deleted Account' : null);
      if (!sender) return;
      var text = clean(flattenTgText(m.text)).replace(/\s+$/, '').trim();
      var type = 'text';
      if (m.media_type === 'sticker' || (m.sticker_emoji && !m.photo)) type = 'sticker';
      else if (m.media_type || TG_MEDIA_KEYS.some(function (k) { return m[k] != null; })) type = 'media';
      msgs.push({ t: Date.UTC(y, mo - 1, d, h, mi, sec), y: y, mo: mo, d: d, h: h, mi: mi, sender: sender, text: text, type: type });
    });
    msgs.sort(function (a, b) { return a.t - b.t; });
    var name = typeof data.name === 'string' && data.name.trim() ? clean(data.name).trim() : null;
    return { messages: msgs, dateOrder: 'ymd', groupName: name, format: 'telegram' };
  }

  // ---------- Instagram / Facebook Messenger (Meta "Download your information", format JSON) ----------
  // messages/inbox/<thread>/message_1.json (+ message_2.json ... for long chats):
  //   { participants: [{ name }], messages: [{ sender_name, timestamp_ms, content?, photos?, videos?, gifs?,
  //     audio_files?, files?, sticker?, share?, reactions?, is_unsent?, call_duration?, type? }], title, thread_path }
  // Messages are listed newest first. Meta writes text as UTF-8 bytes escaped one by one ("\u00f0\u009f\u0098\u0082"
  // instead of "😂"), so every string is turned back into real UTF-8 before use.
  // Also accepted (best effort, see CHANGES.md): the camelCase shape { participants: ["Name"], threadName,
  //   messages: [{ senderName, timestamp, text, media, isUnsent, type }] }.
  var META_MEDIA_KEYS = ['photos', 'videos', 'gifs', 'audio_files', 'files'];
  // English-only notices Meta writes as ordinary messages. Only used when the message has no media.
  var META_SYSTEM_RE = /^(.{1,80}? )?(named the group|changed the group (photo|name)|set (the|your|his|her|their) (own )?nickname|set the nickname|cleared the nickname|set the emoji to|changed the (chat )?theme|added .{1,80} to the group|removed .{1,80} from the group|left the group|started (a|an) (video|audio|voice) (call|chat)|joined the (video|audio|voice) (call|chat)|the (video|audio) (call|chat) ended|you are now connected on messenger|you can now (message|call) each other)|^(reacted .{1,16} to your message|liked a message)\s*$/i;
  var META_ATTACH_RE = /^(.{1,80} )?sent an attachment\.?$|^(.{1,80} )?sent a (photo|video|voice message|gif|sticker)\.?$/i;
  function fixMojibake(s) {
    if (typeof s !== 'string' || !/[\u0080-\u00ff]/.test(s) || /[^\u0000-\u00ff]/.test(s)) return s;
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return s; } // real latin-1 text: keep
  }
  function fixDeep(v) {
    if (typeof v === 'string') return fixMojibake(v);
    if (Array.isArray(v)) return v.map(fixDeep);
    if (v && typeof v === 'object') { var o = {}; for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = fixDeep(v[k]); return o; }
    return v;
  }
  function isMetaJson(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.messages)) return false;
    var probe = d.messages.slice(0, 20).concat(d.messages.slice(-5));
    if (probe.some(function (m) { return m && typeof m === 'object' && ('sender_name' in m || 'timestamp_ms' in m || ('senderName' in m && 'timestamp' in m)); })) return true;
    // an empty thread still has participants: [{ name }] and no Telegram-style "type"/"id"
    return Array.isArray(d.participants) && !('id' in d) && !('type' in d);
  }
  function metaParts(input) {
    var parts = Array.isArray(input) ? input : [input];
    return parts.map(function (p) {
      if (typeof p === 'string') {
        try { p = JSON.parse(p.replace(/^\ufeff/, '')); }
        catch (e) { throw friendly('That file looks like JSON, but it could not be read. It may be cut off or damaged. Download your Instagram or Messenger information again in JSON format and drop the .zip (or a message_1.json).'); }
      }
      if (!isMetaJson(p)) throw friendly('That JSON file is not an Instagram or Messenger chat. Drop the .zip from "Download your information" (JSON format), or a message_1.json from inside messages/inbox/<chat name>/.');
      return fixDeep(p);
    });
  }
  // opts.utcOffsetMin (tests only): fixed offset instead of this device's time zone.
  function localParts(ms, opts) {
    var d;
    if (opts && typeof opts.utcOffsetMin === 'number') { d = new Date(ms + opts.utcOffsetMin * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; }
    d = new Date(ms); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
  }
  function nonEmpty(a) { return Array.isArray(a) ? a.length > 0 : !!a; }
  function parseMeta(input, opts) {
    var parts = metaParts(input), seen = {}, msgs = [], title = null;
    parts.forEach(function (data) {
      if (!title) { var tt = typeof data.title === 'string' ? data.title : (typeof data.threadName === 'string' ? data.threadName : ''); if (clean(tt).trim()) title = clean(tt).trim(); }
      data.messages.forEach(function (m) {
        if (!m || typeof m !== 'object') return;
        var ms = +(m.timestamp_ms != null ? m.timestamp_ms : m.timestamp);
        if (!isFinite(ms) || ms <= 0) return;
        if (ms < 1e11) ms *= 1000; // camelCase exports may use seconds
        var sender = m.sender_name != null ? m.sender_name : m.senderName;
        sender = sender != null ? clean(String(sender)).trim() : '';
        if (!sender) return;
        var text = m.content != null ? m.content : m.text;
        text = typeof text === 'string' ? clean(text).replace(/\s+$/, '').trim() : '';
        var media = META_MEDIA_KEYS.some(function (k) { return nonEmpty(m[k]); }) || nonEmpty(m.media);
        var key = sender + '\u0001' + ms + '\u0001' + text + '\u0001' + META_MEDIA_KEYS.map(function (k) { return Array.isArray(m[k]) ? m[k].length : 0; }).join(',') + (m.sticker ? 's' : '');
        if (seen[key]) return; // the same message in two parts / two uploads
        seen[key] = 1;
        var type = 'text';
        if (m.is_unsent === true || m.isUnsent === true) type = 'deleted';
        else if (/^(.{1,80} )?unsent a message\.?$/i.test(text)) type = 'deleted';
        else if (m.call_duration != null || /^(call|subscribe|unsubscribe)$/i.test(String(m.type || ''))) type = 'system';
        else if (m.sticker) type = 'sticker';
        else if (media) type = 'media';
        else if (!text) { if (m.share) type = 'media'; else return; }
        else if (META_SYSTEM_RE.test(text)) type = 'system';
        else if (META_ATTACH_RE.test(text)) type = 'media';
        var p = localParts(ms, opts);
        msgs.push({ t: Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s), y: p.y, mo: p.mo, d: p.d, h: p.h, mi: p.mi, sender: type === 'system' ? null : sender, text: type === 'text' ? text : (type === 'system' ? text : ''), type: type });
      });
    });
    msgs.sort(function (a, b) { return a.t - b.t; });
    return { messages: msgs, dateOrder: 'ymd', groupName: title, format: 'meta' };
  }
  // Groups message_N.json files from a Meta zip by chat folder. Returns [{ folder, title, count, parts }],
  // biggest chat first. Each part is the parsed (not yet mojibake-fixed) JSON object.
  function metaThreads(files) {
    var by = {};
    files.forEach(function (f) {
      var folder = f.name.replace(/\/?[^\/]*$/, '');
      (by[folder] = by[folder] || []).push(f);
    });
    return Object.keys(by).map(function (folder) {
      var parts = by[folder].sort(function (a, b) { return (+(/(\d+)\.json$/i.exec(a.name) || [0, 0])[1]) - (+(/(\d+)\.json$/i.exec(b.name) || [0, 0])[1]); }).map(function (f) { return f.data; });
      var t = parts.map(function (p) { return p.title || p.threadName; }).filter(function (x) { return typeof x === 'string' && x.trim(); })[0];
      return { folder: folder, title: t ? clean(fixMojibake(t)).trim() : folder.split('/').pop(), count: parts.reduce(function (n, p) { return n + p.messages.length; }, 0), parts: parts };
    }).sort(function (a, b) { return b.count - a.count || (a.title < b.title ? -1 : 1); });
  }

  // Picks the parser by content, not by file name: Meta-shaped JSON (sender_name / timestamp_ms) = Instagram or
  // Messenger, any other JSON = Telegram (its parser explains what is wrong), else WhatsApp text.
  function sniffJson(text) {
    var body = String(text || '').replace(/^[\ufeff\s]+/, ''), c = body.charAt(0);
    if (c !== '{' && c !== '[') return null;
    var data; try { data = JSON.parse(body); } catch (e) { return c === '{' ? { format: 'telegram', data: null } : null; }
    return { format: isMetaJson(data) ? 'meta' : 'telegram', data: data };
  }
  function detectFormat(text) {
    var body = String(text || '').replace(/^[\ufeff\s]+/, ''), head = body.slice(0, 200);
    // "[" can start a JSON array or an iOS WhatsApp line like "[12/24/25, 9:14 PM] ..."; only real JSON counts.
    var j = sniffJson(body);
    if (j) return j.format;
    if (head.charAt(0) === '[') return 'whatsapp';
    if (/^<(!doctype html|html)/i.test(head)) return 'html';
    return 'whatsapp';
  }
  function parseAny(text, opts) {
    var j = sniffJson(text);
    if (j && j.format === 'meta') return parseMeta(j.data, opts);
    if (j) return parseTelegram(j.data === null ? String(text) : j.data);
    if (detectFormat(text) === 'html') throw friendly('That looks like a web page, such as Telegram\'s HTML export. Export the chat again in Telegram Desktop and choose the format "Machine-readable JSON", then drop the result.json. (For Instagram or Messenger, request your information in JSON format, not HTML.)');
    return parseChat(text);
  }

  // ---------- Stats ----------
  var STOP = ('a about above after again against all also am an and any are as at be because been before being below between both but by can cant could did do does doing dont down during each few for from further get got had has have having he her here hers herself him himself his how i if im in into is isnt it its itself ive just let lets like me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that thats the their theirs them themselves then there these they this those through to too under until up very was wasnt we were what when where which while who whom why will with would you your yours yourself yourselves youre ill well yes yeah yep nope one two will thats theres gonna wanna also really still oh okay ok kk see know think going want need make go come back time today tomorrow tonight day good much many even thing things way said say tell sure maybe right new www http https com didnt doesnt wont cant thanks thank lol haha hahaha lmao omw hey hello hi');
  // v5: the most common short words in German, Spanish, Portuguese, French, Italian and Dutch, so
  // "Top words" for non-English chats are not just "und" / "que" / "les". Words that are also
  // common English words (hat, war, bin, son, pain...) are deliberately left out.
  var STOP_L10N = ('und der das ist ich nicht mit sie ein eine einen auf f\u00fcr den dem des auch sich wir ihr mir dich mich dir noch wie wenn dann schon nur mal haben bist sind wird kann doch hab ja nein aber oder' +
    ' que los las del por una con para como pero m\u00e1s mas muy esto esta este eso ese hay tengo tiene estoy est\u00e1 s\u00ed qu\u00e9 c\u00f3mo bueno pues porque cuando donde tambi\u00e9n nos les yo t\u00fa vos' +
    ' n\u00e3o nao uma mais muito isso essa esse tem dos das pra voc\u00ea vc ele ela tamb\u00e9m quando onde est\u00e1 tava' +
    ' les des est pas une qui dans pour avec sur mais tout tous vous nous elle ils sont cest moi toi oui non bien tr\u00e8s aussi \u00e7a' +
    ' che non per sono anche pi\u00f9 piu tutto questo questa della delle degli sei hai cosa ci\u00f2' +
    ' het een van dat niet ook maar met voor zijn jij wij als nog wel heb hebt naar').split(' ');
  var STOPSET = {};
  STOP.split(' ').concat(STOP_L10N).forEach(function (w) { STOPSET[w] = 1; });
  var EMOJI_RE;
  try { EMOJI_RE = new RegExp('(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}{2})(?:\\uFE0F|\\p{Emoji_Modifier}|\\u200D(?:\\p{Extended_Pictographic})\\uFE0F?)*', 'gu'); }
  catch (err) { EMOJI_RE = /[\u2600-\u27bf]|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83e[\udd00-\uddff]/g; }
  var LAUGH_RE = /\b(?:a?(?:ha){2,}h?|(?:he){2,}|lo+l+|lmf?ao+|rofl|(?:ja){2,}j?|mdr)\b|😂|🤣|😆|😹/gi; // v5: + "jajaja" (es), "mdr" (fr)
  var OK_RE = /^(k+|kk+|ok+|okay|okie|okey|oki)[.!]?$/i;
  var LINK_RE = /(?:\bhttps?:\/\/|\bwww\.)\S+/i; // counted only; links are never shown or stored
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
  // v3: "1 person", "1 active day", "1 day" (live said "1 people" / "1 days" for tiny chats).
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
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
      return people[name] || (people[name] = { name: name, count: 0, words: 0, chars: 0, emojis: {}, emojiCount: 0, media: 0, sticker: 0, deleted: 0, laughs: 0, ok: 0, night: 0, early: 0, starts: 0, gaps: [], longest: null, questions: 0, exclaims: 0, hearts: 0,
        links: 0, weekend: 0, lunch: 0, closes: 0, days: {} }); // v3: links, weekend, lunch, closes, days
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
      if (m.h >= 12 && m.h < 14) p.lunch++;
      var wd = new Date(m.t).getUTCDay(); if (wd === 0 || wd === 6) p.weekend++;
      p.days[dk] = 1;
      if (!prev || m.t - prev.t >= SIX_H) p.starts++;
      if (prev && m.t - prev.t >= SIX_H) P(prev.sender).closes++; // prev sent the last message before 6+ quiet hours
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
      if (LINK_RE.test(tx)) p.links++;
      var lm = tx.match(LAUGH_RE); if (lm) p.laughs += lm.length;
      var hm = tx.match(HEART_RE); if (hm) p.hearts += hm.length;
      var em = tx.match(EMOJI_RE);
      if (em) em.forEach(function (e) { e = emojiKey(e); p.emojis[e] = (p.emojis[e] || 0) + 1; emojis[e] = (emojis[e] || 0) + 1; p.emojiCount++; });
      var toks = tx.replace(/(?:\bhttps?:\/\/|\bwww\.)\S+/gi, ' ').toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
      p.words += toks.length;
      toks.forEach(function (w) {
        w = w.replace(/^'+|'+$/g, '').replace(/'/g, '');
        if (w.length < 3 || /^\d+$/.test(w) || STOPSET[w] || nameWords[w] || /^(a?(ha)+h?|(he)+|lo+l+|lmf?ao+|k+|ok+|(ja)+j?|mdr)$/.test(w)) return;
        words[w] = (words[w] || 0) + 1;
      });
    });
    var list = Object.keys(people).map(function (k) { var p = people[k]; p.share = p.count / msgs.length; p.medianGap = p.gaps.length >= 5 ? median(p.gaps) : Infinity; p.topEmoji = topOf(p.emojis); p.typed = p.count - p.media - p.sticker - p.deleted; p.avgLen = p.typed > 0 ? p.chars / p.typed : 0; p.dayCount = Object.keys(p.days).length; delete p.days; return p; })
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
    // v3 (Nov 21, 2026): six new awards marked "// v3", interleaved so they survive the MAX_AWARDS cap.
    // New awards use counts only: no message text, links or exact times are shown or stored.
    { id: 'keeper', emoji: '🔥', title: 'Keeper of the Flame', metric: function (p) { return p.count; }, min: 1, line: function (p) { return p.count.toLocaleString('en-US') + ' messages kept this chat warm all year.'; } },
    { id: 'owl', emoji: '🦉', title: 'Night Owl', metric: function (p) { return p.night; }, min: 3, line: function (p) { return p.night + ' messages between midnight and 4 AM. Sweet dreams eventually.'; } },
    { id: 'bird', emoji: '🐦', title: 'Early Bird', metric: function (p) { return p.early; }, min: 3, line: function (p) { return p.early + ' messages between 5 and 8 AM. The chat\'s sunrise.'; } },
    { id: 'weekend', emoji: '🎉', title: 'Weekend Warrior', metric: function (p) { return p.weekend; }, min: 5, line: function (p) { return p.weekend + ' messages on Saturdays and Sundays. Weekends are for the chat.'; } }, // v3
    { id: 'speedy', emoji: '⚡', title: 'Speedy Replier', metric: function (p) { return isFinite(p.medianGap) ? -p.medianGap : -Infinity; }, min: -Infinity, low: true, line: function (p) { return 'Typical reply in ' + fmtGap(p.medianGap) + '. Always there.'; } },
    { id: 'starter', emoji: '🎬', title: 'Conversation Starter', metric: function (p) { return p.starts; }, min: 2, line: function (p) { return 'Broke the silence ' + p.starts + ' times after 6+ quiet hours.'; } },
    { id: 'closer', emoji: '🌙', title: 'Lights Out Award', metric: function (p) { return p.closes; }, min: 2, line: function (p) { return 'Sent the last message before a quiet spell ' + p.closes + ' times. Goodnight, chat.'; } }, // v3
    { id: 'ok', emoji: '👌', title: 'Master of Few Words', metric: function (p) { return p.ok; }, min: 3, line: function (p) { return p.ok + ' perfectly efficient "k"s and "ok"s.'; } },
    { id: 'media', emoji: '📸', title: 'Family Photographer', metric: function (p) { return p.media; }, min: 3, line: function (p) { return p.media + ' photos, videos and files shared.'; } },
    { id: 'links', emoji: '🔗', title: 'Link Librarian', metric: function (p) { return p.links; }, min: 2, line: function (p) { return p.links + ' links shared. The group\'s personal librarian.'; } }, // v3
    { id: 'sticker', emoji: '🎨', title: 'Sticker Sorcerer', metric: function (p) { return p.sticker; }, min: 2, line: function (p) { return p.sticker + ' stickers deployed with precision.'; } },
    { id: 'novel', emoji: '📜', title: 'Novelist in Residence', metric: function (p) { return p.longest ? p.longest.text.length : 0; }, min: 80, line: function (p) { return 'Longest message of the year: ' + p.longest.text.length + ' characters.'; } },
    { id: 'essay', emoji: '✍️', title: 'Essay Writer', metric: function (p) { return p.typed >= 5 ? Math.round(p.avgLen) : 0; }, min: 30, line: function (p) { return 'Typed messages averaged ' + Math.round(p.avgLen) + ' characters. Every word counted.'; } }, // v3
    { id: 'laugh', emoji: '😂', title: 'Chief Laugh Officer', metric: function (p) { return p.laughs; }, min: 3, line: function (p) { return p.laughs + ' laughs (haha, lol, 😂) shared.'; } },
    { id: 'lunch', emoji: '🥪', title: 'Lunch Break Legend', metric: function (p) { return p.lunch; }, min: 3, line: function (p) { return p.lunch + ' messages between noon and 2 PM. Chatting over lunch.'; } }, // v3
    { id: 'heart', emoji: '❤️', title: 'Warmest Heart', metric: function (p) { return p.hearts; }, min: 3, line: function (p) { return p.hearts + ' hearts and "love you"s sent.'; } },
    { id: 'emoji', emoji: '✨', title: 'Emoji Artist', metric: function (p) { return p.emojiCount; }, min: 5, line: function (p) { return p.emojiCount + ' emojis, favorite: ' + (p.topEmoji ? p.topEmoji.key : '') + '.'; } },
    { id: 'deleted', emoji: '🫣', title: 'Second Thoughts Award', metric: function (p) { return p.deleted; }, min: 2, line: function (p) { return p.deleted + ' messages lovingly un-sent. We\'ll never know.'; } },
    { id: 'question', emoji: '❓', title: 'Question Master', metric: function (p) { return p.questions; }, min: 3, line: function (p) { return p.questions + ' questions asked. Curiosity keeps a family close.'; } },
    { id: 'hype', emoji: '📣', title: 'Hype Squad Captain', metric: function (p) { return p.exclaims; }, min: 3, line: function (p) { return p.exclaims + ' messages with an exclamation point!'; } },
    { id: 'regular', emoji: '📅', title: 'Always Around', metric: function (p) { return p.dayCount; }, min: 3, line: function (p) { return 'Showed up on ' + p.dayCount + ' different days.'; } } // v3
  ];
  var MAX_AWARDS = 16; // v3: was 12 (3 slides of 4); now up to 4 award slides

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
    // Keep at most MAX_AWARDS: drop later awards held by people who already won something else.
    for (var i = out.length - 1; i >= 0 && out.length > MAX_AWARDS; i--) {
      if (wins[out[i].winner] > 1) { wins[out[i].winner]--; out.splice(i, 1); }
    }
    return out.slice(0, MAX_AWARDS);
  }

  // v3 share image: the top n awards to feature. Skips "Keeper of the Flame" (the image already
  // shows the top talker) and prefers different winners so more people see their name.
  function featuredAwards(awards, n) {
    n = n || 3;
    var pool = (awards || []).filter(function (a) { return a.id !== 'keeper'; }), out = [], seen = {};
    pool.forEach(function (a) { if (out.length < n && !seen[a.winner]) { out.push(a); seen[a.winner] = 1; } });
    pool.forEach(function (a) { if (out.length < n && out.indexOf(a) < 0) out.push(a); });
    if (out.length < n) (awards || []).forEach(function (a) { if (out.length < n && out.indexOf(a) < 0) out.push(a); });
    return out;
  }

  // ---------- ZIP (reads _chat.txt with the browser's own DecompressionStream) ----------
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  // v5: the zip reading is split into zipIndex (central directory) + zipText (one entry) so a Meta export
  // with message_1.json, message_2.json ... (possibly for many chats) can be read with the same code.
  function zipIndex(buf) {
    var b = new Uint8Array(buf), i, eocd = -1;
    for (i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This does not look like a zip file.');
    var n = u16(b, eocd + 10), off = u32(b, eocd + 16), entries = [];
    for (i = 0; i < n && u32(b, off) === 0x02014b50; i++) {
      var nameLen = u16(b, off + 28), extraLen = u16(b, off + 30), comLen = u16(b, off + 32);
      var name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nameLen));
      entries.push({ name: name, method: u16(b, off + 10), csize: u32(b, off + 20), local: u32(b, off + 42) });
      off += 46 + nameLen + extraLen + comLen;
    }
    var real = entries.filter(function (x) { return !/(^|\/)__MACOSX\//.test(x.name) && !/(^|\/)\._/.test(x.name); });
    return { b: b, entries: real };
  }
  function zipText(b, e) {
    var lo = e.local;
    if (u32(b, lo) !== 0x04034b50) return Promise.reject(new Error('Zip entry is damaged.'));
    var start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    var data = b.subarray(start, start + e.csize);
    if (e.method === 0) return Promise.resolve(new TextDecoder().decode(data));
    if (e.method !== 8) return Promise.reject(new Error('Unsupported zip compression.'));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Your browser cannot unzip here. Unzip the file and drop the _chat.txt (WhatsApp), result.json (Telegram) or message_1.json (Instagram / Messenger) instead.'));
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new TextDecoder().decode(ab); });
  }
  var ZIP_NONE = 'No WhatsApp _chat.txt or Telegram result.json found inside the zip, and no Instagram / Messenger message_1.json either.';
  var META_FILE_RE = /(^|\/)message_\d+\.json$/i;
  function pickZipEntry(real) {
    return real.filter(function (x) { return /(^|\/)_chat\.txt$/i.test(x.name); })[0]
      || real.filter(function (x) { return /(^|\/)result\.json$/i.test(x.name); }).sort(function (a, b) { return a.name.length - b.name.length; })[0];
  }
  // Kept for the WhatsApp / Telegram path (and old tests): resolves to the chat text.
  function readZipChat(buf) {
    var z; try { z = zipIndex(buf); } catch (err) { return Promise.reject(err); }
    var e = pickZipEntry(z.entries) || z.entries.filter(function (x) { return /\.txt$/i.test(x.name); })[0];
    if (!e) return Promise.reject(new Error(ZIP_NONE));
    return zipText(z.b, e);
  }
  // v5: resolves to { text } (WhatsApp / Telegram) or { threads: metaThreads(...) } (Instagram / Messenger).
  function readZipImport(buf) {
    var z; try { z = zipIndex(buf); } catch (err) { return Promise.reject(err); }
    var e = pickZipEntry(z.entries);
    if (e) return zipText(z.b, e).then(function (t) { return { text: t }; });
    var metas = z.entries.filter(function (x) { return META_FILE_RE.test(x.name); });
    if (metas.length) {
      return Promise.all(metas.map(function (x) {
        return zipText(z.b, x).then(function (t) { var d = null; try { d = JSON.parse(t.replace(/^\ufeff/, '')); } catch (err) { d = null; } return { name: x.name, data: d }; });
      })).then(function (files) {
        var ok = files.filter(function (f) { return isMetaJson(f.data); });
        if (!ok.length) throw new Error('The message_N.json files in this zip could not be read. Download your information again in JSON format (not HTML).');
        return { threads: metaThreads(ok) };
      });
    }
    var txt = z.entries.filter(function (x) { return /\.txt$/i.test(x.name); })[0];
    if (txt) return zipText(z.b, txt).then(function (t) { return { text: t }; });
    if (z.entries.some(function (x) { return /(^|\/)message_\d+\.html$/i.test(x.name); })) return Promise.reject(new Error('This Instagram / Messenger download is in HTML format. Request your information again and choose JSON as the format.'));
    return Promise.reject(new Error(ZIP_NONE));
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

  // ---------- QR code (v4): tiny on-device encoder, written for Zexley ----------
  // Original code (no third-party code vendored): byte mode, error correction level M,
  // versions 1-10 (up to 213 bytes), all 8 masks scored with the standard penalty rules.
  // Follows ISO/IEC 18004. Used only to draw the "Make yours" code on the share image.
  // Makes no network requests.
  var QR_URL = 'https://zexley.com/wrapped/?ref=share';
  var QR_M = { // version: [EC codewords per block, blocks in group 1, data cw each, blocks in group 2, data cw each]
    1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0],
    6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44]
  };
  var QR_ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  var GF_EXP = [], GF_LOG = [];
  (function () { var v = 1; for (var i = 0; i < 255; i++) { GF_EXP[i] = v; GF_LOG[v] = i; v <<= 1; if (v & 256) v ^= 0x11d; } for (i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]; })();
  function gfMul(a, b) { return a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0; }
  function rsDivisor(deg) { // coefficients high to low, leading 1 omitted
    var r = []; for (var i = 0; i < deg; i++) r.push(0); r[deg - 1] = 1; var root = 1;
    for (i = 0; i < deg; i++) { for (var j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); for (var i = 0; i < div.length; i++) r[i] ^= gfMul(div[i], f); });
    return r;
  }
  function utf8Bytes(s) { var out = [], e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i)); return out; }
  // Returns { size, version, mask, modules: [[bool]] } (modules[y][x], true = dark).
  function qrEncode(text, forceMask) {
    var bytes = utf8Bytes(text), ver = 0, t;
    for (var v = 1; v <= 10; v++) { t = QR_M[v]; var cap = t[1] * t[2] + t[3] * t[4]; if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap * 8) { ver = v; break; } }
    if (!ver) throw new Error('QR text too long');
    t = QR_M[ver]; var dataCw = t[1] * t[2] + t[3] * t[4], size = ver * 4 + 17;
    // 1. data bits
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, dataCw * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    var cw = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
    for (var pad = 0xec; cw.length < dataCw; pad ^= 0xec ^ 0x11) cw.push(pad);
    // 2. blocks + Reed-Solomon, interleaved
    var blocks = [], ecs = [], div = rsDivisor(t[0]), k = 0;
    for (i = 0; i < t[1] + t[3]; i++) { var len = i < t[1] ? t[2] : t[4]; var blk = cw.slice(k, k + len); k += len; blocks.push(blk); ecs.push(rsRemainder(blk, div)); }
    var all = [], maxLen = Math.max(t[2], t[4]);
    for (i = 0; i < maxLen; i++) blocks.forEach(function (bk) { if (i < bk.length) all.push(bk[i]); });
    for (i = 0; i < t[0]; i++) ecs.forEach(function (e) { all.push(e[i]); });
    // 3. function patterns
    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push([]); fn.push([]); for (j = 0; j < size; j++) { m[i].push(false); fn[i].push(false); } }
    function setF(x, y, dark) { m[y][x] = !!dark; fn[y][x] = true; }
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4); } }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var al = QR_ALIGN[ver];
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function drawFormat(mask) {
      var data = (0 << 3) | mask, rem = data; // level M = 00
      for (var n = 0; n < 10; n++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((data << 10) | rem) ^ 0x5412, bit = function (q) { return (f >>> q) & 1; };
      for (n = 0; n <= 5; n++) setF(8, n, bit(n));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (n = 9; n < 15; n++) setF(14 - n, 8, bit(n));
      for (n = 0; n < 8; n++) setF(size - 1 - n, 8, bit(n));
      for (n = 8; n < 15; n++) setF(8, size - 15 + n, bit(n));
      setF(8, size - 8, true); // dark module
    }
    drawFormat(0); // reserve
    if (ver >= 7) {
      var r = ver; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      var vb = (ver << 12) | r;
      for (i = 0; i < 18; i++) { var on = (vb >>> i) & 1, a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, on); setF(c, a, on); }
    }
    // 4. data placement (zigzag)
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < all.length * 8) { m[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    // 5. mask choice
    function maskBit(k2, x2, y2) {
      switch (k2) { case 0: return (x2 + y2) % 2 === 0; case 1: return y2 % 2 === 0; case 2: return x2 % 3 === 0; case 3: return (x2 + y2) % 3 === 0;
        case 4: return (Math.floor(x2 / 3) + Math.floor(y2 / 2)) % 2 === 0; case 5: return x2 * y2 % 2 + x2 * y2 % 3 === 0;
        case 6: return (x2 * y2 % 2 + x2 * y2 % 3) % 2 === 0; default: return ((x2 + y2) % 2 + x2 * y2 % 3) % 2 === 0; }
    }
    function applyMask(k2) { for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) if (!fn[yy][xx] && maskBit(k2, xx, yy)) m[yy][xx] = !m[yy][xx]; }
    function penalty() {
      var p = 0, dark = 0, yy, xx;
      function lineScore(get) { // rules 1 and 3 along one line
        var s = 0, run = 1, seq = [];
        for (var q = 0; q < size; q++) { var cur = get(q); seq.push(cur ? 1 : 0); if (q > 0) { if (cur === get(q - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
        var str = seq.join(''), pats = ['10111010000', '00001011101'];
        var padded = '0000' + str + '0000';
        pats.forEach(function (pt) { var idx = padded.indexOf(pt); while (idx >= 0) { s += 40; idx = padded.indexOf(pt, idx + 1); } });
        return s;
      }
      for (yy = 0; yy < size; yy++) p += lineScore(function (q) { return m[yy][q]; });
      for (xx = 0; xx < size; xx++) p += lineScore(function (q) { return m[q][xx]; });
      for (yy = 0; yy < size - 1; yy++) for (xx = 0; xx < size - 1; xx++) { var cc = m[yy][xx]; if (cc === m[yy][xx + 1] && cc === m[yy + 1][xx] && cc === m[yy + 1][xx + 1]) p += 3; }
      for (yy = 0; yy < size; yy++) for (xx = 0; xx < size; xx++) if (m[yy][xx]) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = forceMask, bestP = Infinity;
    if (best == null) for (k = 0; k < 8; k++) { applyMask(k); drawFormat(k); var pp = penalty(); if (pp < bestP) { bestP = pp; best = k; } applyMask(k); }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, mask: best, modules: m };
  }
  // Draws the code with a 4-module light quiet zone. Returns the side length in px.
  function drawQR(ctx, qr, left, top, moduleSize, dark, light) {
    var q = 4, side = (qr.size + 2 * q) * moduleSize;
    ctx.fillStyle = light; ctx.fillRect(left, top, side, side);
    ctx.fillStyle = dark;
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.modules[y][x]) ctx.fillRect(left + (x + q) * moduleSize, top + (y + q) * moduleSize, moduleSize, moduleSize);
    return side;
  }

  // ---------- Share sheet (v4): navigator.share with the PNG, else the normal download ----------
  var SHARE_CTA = 'Make yours \u2192 zexley.com/wrapped';
  function dataUrlBytes(url) { var bin = atob(String(url).split(',')[1] || ''), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  // Built synchronously from a data: URL so the share call stays inside the tap (Safari needs that).
  function shareFile(dataUrl, name) { return new File([dataUrlBytes(dataUrl)], name || shareFilename(), { type: 'image/png' }); }
  function canShareFiles(nav, file) { try { return !!(nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })); } catch (e) { return false; } }
  // Resolves 'shared', 'cancelled' (user closed the sheet) or 'downloaded' (fallback ran).
  function shareImage(nav, file, fallback) {
    if (!canShareFiles(nav, file)) { fallback(); return Promise.resolve('downloaded'); }
    var p; try { p = nav.share({ files: [file], title: BRAND_NAME }); } catch (e) { fallback(); return Promise.resolve('downloaded'); }
    return Promise.resolve(p).then(function () { return 'shared'; }, function (err) { if (err && err.name === 'AbortError') return 'cancelled'; fallback(); return 'downloaded'; });
  }

  var api = { parseChat: parseChat, parseTelegram: parseTelegram, flattenTgText: flattenTgText, detectFormat: detectFormat, parseAny: parseAny, computeStats: computeStats, assignAwards: assignAwards, readZipChat: readZipChat, readZipImport: readZipImport, parseMeta: parseMeta, fixMojibake: fixMojibake, isMetaJson: isMetaJson, metaThreads: metaThreads, inferDateOrder: inferDateOrder, AWARDS: AWARDS, MAX_AWARDS: MAX_AWARDS, plural: plural, featuredAwards: featuredAwards, fmtDate: fmtDate, fmtHour: fmtHour, PAYMENT_LINK: PAYMENT_LINK, PROTOTYPE_PREVIEW: PROTOTYPE_PREVIEW, BRAND_NAME: BRAND_NAME, STORE_KEY: STORE_KEY, PENDING_TTL_MS: PENDING_TTL_MS, PAID_TTL_MS: PAID_TTL_MS, slugify: slugify, shareFilename: shareFilename, toStoredStats: toStoredStats, saveRecord: saveRecord, loadRecord: loadRecord, forgetRecord: forgetRecord, markPaid: markPaid, parseReturn: parseReturn, paymentUrl: paymentUrl, qrEncode: qrEncode, drawQR: drawQR, QR_URL: QR_URL, shareFile: shareFile, canShareFiles: canShareFiles, shareImage: shareImage, SHARE_CTA: SHARE_CTA };
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

  // v5: localized WhatsApp file names ("WhatsApp Chat mit X.txt", "Chat de WhatsApp con X.txt", ...). Best effort.
  var WA_LABEL_RE = /(?:WhatsApp Chat (?:with |- |mit )|Chat de WhatsApp con |Conversa do WhatsApp com |Discussion WhatsApp avec |Chat WhatsApp con |WhatsApp-chat met )(.+?)(?:\.txt|\.zip)?$/i;
  function handleText(text, label) {
    var parsed;
    try { parsed = parseAny(text); }
    catch (err) { setStatus(err && err.friendly ? err.message : 'Could not read that file.', true); return; }
    handleParsed(parsed, label);
  }
  function handleParsed(parsed, label) {
    if (!parsed.groupName && label && parsed.format === 'whatsapp') {
      var m = WA_LABEL_RE.exec(label);
      if (m) parsed.groupName = m[1];
    }
    var S = computeStats(parsed);
    if (S.empty) { setStatus((parsed.format === 'telegram' ? 'We could not find any messages in that Telegram export. Make sure it is a group or chat export from Telegram Desktop in the "Machine-readable JSON" format.' : parsed.format === 'meta' ? 'We could not find any messages in that Instagram or Messenger chat. Make sure your download includes Messages and covers the dates you want.' : 'We could not find any chat messages in that file. Make sure it is a WhatsApp "Export chat" file (.txt or .zip), a Telegram Desktop JSON export (result.json), or an Instagram / Messenger JSON download (.zip or message_1.json).'), true); return; }
    $('#picker').hidden = true;
    state.stats = S;
    state.unlocked = state.paidMarker;
    showDeck(S);
  }
  // v5: a Meta download can hold many chats. Let the person pick one (titles are shown only here, on the device).
  var PICKER_MAX = 40;
  function showPicker(threads) {
    var box = $('#picker'), list = $('#picker-list');
    list.textContent = '';
    threads.slice(0, PICKER_MAX).forEach(function (th) {
      var b = el('button', 'btn btn-ghost picker-item');
      b.type = 'button';
      b.appendChild(el('span', 'picker-title', th.title));
      b.appendChild(el('span', 'picker-count', th.count === 1 ? '1 message' : Math.round(th.count).toLocaleString('en-US') + ' messages'));
      b.addEventListener('click', function () { openThread(th); });
      list.appendChild(b);
    });
    $('#picker-more').hidden = threads.length <= PICKER_MAX;
    $('#picker-more').textContent = threads.length > PICKER_MAX ? 'Showing the ' + PICKER_MAX + ' biggest of ' + threads.length + ' chats.' : '';
    box.hidden = false;
    setStatus('');
    box.scrollIntoView({ block: 'start' });
  }
  function openThread(th) {
    var parsed;
    try { parsed = parseMeta(th.parts); }
    catch (err) { setStatus(err && err.friendly ? err.message : 'Could not read that chat.', true); return; }
    handleParsed(parsed, th.title);
  }
  function handleImport(r, label) {
    if (r.text != null) return handleText(r.text, label);
    if (r.threads.length === 1) return openThread(r.threads[0]);
    showPicker(r.threads);
  }

  function showDeck(S) {
    buildSlides(S);
    $('#intro').hidden = true;
    $('#deck').hidden = false;
    show(0);
    $('#deck').scrollIntoView({ block: 'start' });
    setStatus('');
  }

  function readBuf(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onerror = function () { rej(new Error('Could not read that file.')); }; r.onload = function () { res(r.result); }; r.readAsArrayBuffer(file); });
  }
  function isZipBuf(buf, file) {
    var b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    return (b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) || /\.zip$/i.test(file.name) || /zip/i.test(file.type || ''); // "PK\3\4" = zip, whatever the name
  }
  function handleFile(file) {
    if (!file) return;
    setStatus('Reading on your device…');
    $('#picker').hidden = true;
    readBuf(file).then(function (buf) {
      if (isZipBuf(buf, file)) return readZipImport(buf).then(function (r) { handleImport(r, file.name); });
      handleText(new TextDecoder().decode(buf), file.name);
    }).catch(function (err) { setStatus(err && err.message ? err.message : 'Could not read that file.', true); });
  }
  // v5: several files at once, e.g. message_1.json + message_2.json of one Instagram / Messenger chat.
  function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (files.length <= 1) return handleFile(files[0]);
    setStatus('Reading on your device…');
    Promise.all(files.map(function (f) { return readBuf(f).then(function (b) { return { f: f, b: b }; }); })).then(function (all) {
      if (all.some(function (x) { return isZipBuf(x.b, x.f); })) return handleFile(all.filter(function (x) { return isZipBuf(x.b, x.f); })[0].f);
      var texts = all.map(function (x) { return new TextDecoder().decode(x.b); });
      var sn = texts.map(sniffJson);
      if (sn.every(function (j) { return j && j.format === 'meta'; })) {
        var th = metaThreads(sn.map(function (j, i) { return { name: files[i].name, data: j.data }; }).map(function (x) { x.name = 'upload/' + x.name.replace(/^.*\//, ''); return x; }));
        return openThread(th[0]);
      }
      setStatus('Please drop one chat file at a time (or, for Instagram / Messenger, the message_N.json files of one chat).', true);
    }).catch(function (err) { setStatus(err && err.message ? err.message : 'Could not read those files.', true); });
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
    s1.inner.appendChild(el('p', 'slide-sub', plural(S.people.length, 'person', 'people') + ' · ' + plural(S.activeDays, 'active day')));
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
    big(s4.inner, plural(S.streak.len, 'day'), 'in a row with at least one message');
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
    [['Messages', nf(S.total)], ['Top talker', S.topTalker.name], ['Busiest day', fmtDate(S.busiestDay.t)], ['Streak', plural(S.streak.len, 'day')], ['Emoji', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word', S.topWords[0] ? S.topWords[0].key : '—']].forEach(function (r) { grid.appendChild(el('dt', null, r[0])); grid.appendChild(el('dd', null, r[1])); });
    ss.inner.appendChild(grid);
    var ul2 = el('ul', 'sum-awards');
    S.awards.slice(0, 6).forEach(function (a) { ul2.appendChild(el('li', null, a.emoji + ' ' + a.title + ': ' + a.winner)); });
    ss.inner.appendChild(ul2);
    ss.inner.appendChild(el('p', 'slide-foot', 'made at zexley.com · stats computed by code, awards for fun · not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, or Spotify'));
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
    x.fillText(fitText(x, BRAND_NAME.toUpperCase(), 1000).split('').join(String.fromCharCode(8202)), 540, 140);
    x.fillStyle = '#fffaf2'; x.font = '700 84px ' + serif; x.fillText(fitText(x, S.groupName || 'Our group chat', 960), 540, 250);
    x.font = '700 200px ' + serif; x.fillStyle = '#fffaf2'; x.fillText(nf(S.total), 540, 470);
    x.font = '400 44px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText('messages' + (S.usedYear ? ' in ' + S.year : ' (all time)'), 540, 535);
    var rows = [['Top talker', S.topTalker.name], ['Busiest day', fmtDate(S.busiestDay.t)], ['Longest streak', plural(S.streak.len, 'day')], ['Emoji of the year', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word of the year', S.topWords[0] ? S.topWords[0].key : '—']];
    var y = 630; // v4: whole layout moved up to make room for the "Make yours" band + QR
    rows.forEach(function (r) { x.textAlign = 'left'; x.font = '400 40px ' + sans; x.fillStyle = '#d9a441'; x.fillText(r[0], 110, y); x.textAlign = 'right'; x.font = '700 46px ' + sans; x.fillStyle = '#fffaf2'; x.fillText(fitText(x, r[1], 520), 970, y); y += 72; });
    y += 4; x.strokeStyle = 'rgba(217,164,65,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(110, y); x.lineTo(970, y); x.stroke(); y += 64;
    x.textAlign = 'center';
    // v3: top 3 awards as cards (winner names only after unlock; locked shows a teaser with "?").
    var feat = featuredAwards(S.awards, 3);
    function card(top, a, locked) {
      var L = 110, W = 860, H = 144, R = 26;
      x.beginPath(); x.moveTo(L + R, top); x.lineTo(L + W - R, top); x.quadraticCurveTo(L + W, top, L + W, top + R); x.lineTo(L + W, top + H - R); x.quadraticCurveTo(L + W, top + H, L + W - R, top + H);
      x.lineTo(L + R, top + H); x.quadraticCurveTo(L, top + H, L, top + H - R); x.lineTo(L, top + R); x.quadraticCurveTo(L, top, L + R, top); x.closePath();
      x.fillStyle = 'rgba(255,250,242,0.08)'; x.fill(); x.strokeStyle = 'rgba(217,164,65,0.45)'; x.lineWidth = 2; x.stroke();
      x.textAlign = 'center'; x.font = '72px ' + sans; x.fillStyle = '#fffaf2'; x.fillText(a.emoji, L + 80, top + 96);
      x.textAlign = 'left'; x.font = '600 36px ' + sans; x.fillStyle = '#d9a441'; x.fillText(fitText(x, a.title, W - 200), L + 165, top + 48);
      x.font = '700 48px ' + serif; x.fillStyle = '#fffaf2'; x.fillText(fitText(x, locked ? '? ? ?' : a.winner, W - 200), L + 165, top + 100);
      var sub = locked ? 'Who won? Unlock the full recap to find out.' : (/^(.+?[.!?])(\s|$)/.exec(a.line) || [a.line, a.line])[1]; // first sentence only
      x.font = '400 28px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText(fitText(x, sub, W - 200), L + 165, top + 130);
      x.textAlign = 'center';
    }
    if (feat.length) {
      x.font = '700 50px ' + serif; x.fillStyle = '#d9a441';
      x.fillText(state.unlocked ? 'Top awards' + (S.awards.length > feat.length ? ' (' + feat.length + ' of ' + S.awards.length + ')' : '') : S.awards.length + ' group awards inside 🏆', 540, y);
      y += 30;
      feat.forEach(function (a) { card(y, a, !state.unlocked); y += 156; });
    } else {
      x.font = '700 56px ' + serif; x.fillStyle = '#d9a441'; x.fillText('A quiet, cozy year 🏆', 540, y + 40);
    }
    // v4 share loop: "Make yours" call-to-action + a QR code for QR_URL, drawn on the device.
    var qr = qrEncode(QR_URL), mod = 6, qside = (qr.size + 8) * mod, qx = 970 - qside, qy = 1560; // 37 x 6 = 222 px incl. quiet zone
    x.fillStyle = 'rgba(255,250,242,0.08)'; x.fillRect(110, qy - 8, 860, qside + 16);
    drawQR(x, qr, qx, qy, mod, '#1a1814', '#fffaf2');
    x.textAlign = 'left'; x.font = '700 60px ' + serif; x.fillStyle = '#d9a441';
    x.fillText('Make yours \u2192', 140, qy + 76);
    x.font = '700 50px ' + sans; x.fillStyle = '#fffaf2'; x.fillText('zexley.com/wrapped', 140, qy + 146);
    x.font = '400 26px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText(fitText(x, 'Scan or type it · your chat stays on your phone', qx - 170), 140, qy + 192);
    x.font = '400 28px ' + sans; x.fillStyle = '#e8dcc6'; x.textAlign = 'center';
    x.fillText('made at zexley.com/wrapped · stats computed by code, awards for fun', 540, 1838);
    x.font = '400 26px ' + sans; x.fillStyle = '#b8ab92';
    x.fillText('AI-assisted product by Zexley · no AI reads your chat', 540, 1872);
    var naf = 'Not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, or Spotify', nfs = 26;
    while (nfs > 18 && x.measureText(naf).width > 1000) { nfs--; x.font = '400 ' + nfs + 'px ' + sans; } // v5: longer list, keep it on the canvas
    x.fillText(naf, 540, 1904);
    return c;
  }
  function saveBlob(blob) {
    var url = URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = shareFilename();
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadShare() { drawShare().toBlob(saveBlob, 'image/png'); }
  // v4: "Share image" opens the phone's share sheet with the PNG; falls back to the download.
  function nativeShare() {
    var file;
    try { file = shareFile(drawShare().toDataURL('image/png'), shareFilename()); } catch (e) { downloadShare(); return Promise.resolve('downloaded'); }
    return shareImage(root.navigator, file, function () { saveBlob(file); }).then(function (r) { api.lastShareResult = r; return r; });
  }
  function setupShareButton() {
    var b = $('#share-native'); if (!b) return;
    var probe = null; try { probe = new File([new Uint8Array([137, 80, 78, 71])], 'probe.png', { type: 'image/png' }); } catch (e) { probe = null; }
    b.hidden = !(probe && canShareFiles(root.navigator, probe));
    b.addEventListener('click', nativeShare);
  }
  api.drawShare = drawShare; api.nativeShare = nativeShare;

  function reset() { state = { stats: null, slides: [], idx: 0, unlocked: false, paidMarker: state.paidMarker }; $('#deck-msg').hidden = true; $('#slides').textContent = ''; $('#deck').hidden = true; $('#intro').hidden = false; $('#paynote').hidden = true; $('#file').value = ''; $('#picker').hidden = true; setStatus(''); }

  function applyBrand() {
    doc.title = BRAND_NAME + ' — Zexley';
    var n = doc.querySelectorAll('[data-brand]');
    for (var i = 0; i < n.length; i++) n[i].textContent = BRAND_NAME;
  }

  function init() {
    applyBrand();
    var drop = $('#drop'), file = $('#file');
    file.addEventListener('change', function () { handleFiles(file.files); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });
    $('#sample').addEventListener('click', function () { handleText($('#sample-chat').textContent, 'WhatsApp Chat - The Puddleworths 🎄 (sample).txt'); });
    $('#prev').addEventListener('click', function () { show(state.idx - 1); });
    $('#next').addEventListener('click', function () { show(state.idx + 1); });
    doc.addEventListener('keydown', function (e) { if ($('#deck').hidden) return; if (e.key === 'ArrowRight') show(state.idx + 1); if (e.key === 'ArrowLeft') show(state.idx - 1); });
    $('#share').addEventListener('click', downloadShare);
    setupShareButton();
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
