/*
 * Group Chat Wrapped 2026 (BRAND_NAME below) — Zexley (assumed name of Bloom Commerce LLC)
 * Not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, Discord, or Spotify.
 * Reads WhatsApp "Export chat" text files, Telegram Desktop "Machine-readable JSON" exports,
 * and (v5 draft) Instagram / Facebook Messenger chats from Meta's "Download your information" JSON export.
 * v4 (published): share image includes a "Make yours" call-to-action and an on-device QR code.
 * v5 (published): Instagram + Messenger JSON, non-English WhatsApp exports (de/es/pt/fr/it/nl).
 * v6: Discord official data package (only YOUR OWN messages -> a personal recap). Zips are read in pieces.
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
  // v7 (Nov 23, 2026): "Two of Us", the 1-on-1 recap for chats where exactly two people sent messages.
  // PAIR_PAYMENT_LINK: the $2.99 Stripe Payment Link. Its after-payment redirect must be
  //   https://zexley.com/wrapped/?unlocked=1&plan=pair
  // While it is a placeholder, the 1-on-1 unlock button shows "Payment not connected".
  var PAIR_PAYMENT_LINK = 'https://buy.stripe.com/4gM7sL0hZdzTfDQ38Ggbm03';
  var PAIR_PRICE = '$2.99';
  var PAIR_BRAND = 'Two of Us Wrapped 2026';
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

  // ---------- Discord (v6) ----------
  // 1) Discord's official data package (User Settings > Data & Privacy > Request your data, with Messages selected).
  //    A zip with Messages/ (older packages: messages/; the folder name may also be localized), one folder per
  //    channel: c<channel id>/ (some newer packages drop the "c") holding channel.json
  //    { id, type, name?, guild?: { id, name }, recipients?: [user ids] } and messages.json
  //    [{ ID, Timestamp, Contents, Attachments }] (newer) or messages.csv with the same four columns (older),
  //    plus Messages/index.json { "<channel id>": "<label>" }.
  //    The package holds ONLY THE REQUESTING PERSON'S OWN MESSAGES, never anyone else's, so it makes a personal
  //    recap (parsed.selfOnly), not a group one. Only these message files are opened. Account/ (email, IP,
  //    payment details), Activity/, Servers/ and everything else in the package are never decompressed or read.
  // 2) Also accepted, silently: a channel JSON shaped
  //    { guild, channel, messages: [{ id, type, timestamp, content, author: { name, nickname, isBot }, ... }] }.
  //    That shape includes every member's messages, so it makes a normal group recap. Not advertised.
  var DISCORD_EPOCH = 1420070400000;
  var DC_MSG_FILE_RE = /^(.*\/)?c?(\d{5,22})\/messages\.(json|csv)$/i;
  var DC_SELF = 'You';
  // A Discord ID ("snowflake") carries its creation time in UTC: (id >> 22) + 2015-01-01.
  // Dividing a rounded JS number by 2^22 is still exact to the millisecond or so.
  function snowflakeMs(id) {
    var s = String(id == null ? '' : id).trim();
    if (!/^\d{15,20}$/.test(s)) return NaN;
    var ms = Math.floor(Number(s) / 4194304) + DISCORD_EPOCH;
    return ms > DISCORD_EPOCH && ms < 4102444800000 ? ms : NaN;
  }
  // "2026-03-14 18:05:09", "2026-03-14 18:05:09.123000+00:00", "2026-03-14T18:05:09Z". No offset = UTC.
  var DC_TS_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
  function discordTsMs(ts) {
    var m = DC_TS_RE.exec(String(ts == null ? '' : ts).trim()); if (!m) return NaN;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    if (m[7] && m[7].toUpperCase() !== 'Z') { var z = m[7].replace(':', ''), sg = z.charAt(0) === '-' ? -1 : 1; t -= sg * (+z.slice(1, 3) * 60 + +z.slice(3, 5)) * 60000; }
    return t;
  }
  // The message ID is exact, so it wins; Timestamp is the fallback.
  function discordRowMs(r) { var ms = snowflakeMs(r.ID != null ? r.ID : r.id); return isFinite(ms) ? ms : discordTsMs(r.Timestamp != null ? r.Timestamp : r.timestamp); }
  // Custom emoji <:name:id> count as emoji ":name:"; mentions <@id>, <@&role>, @everyone, @here are counted, not read
  // as words; channel links <#id>, timestamps <t:...> and slash-command links are dropped.
  function discordText(raw) {
    var cemoji = [], mentions = 0, t = clean(String(raw == null ? '' : raw));
    t = t.replace(/<a?:([A-Za-z0-9_~]{1,64}):\d{5,22}>/g, function (_, n) { cemoji.push(':' + n + ':'); return ' '; });
    t = t.replace(/<@[!&]?\d{5,22}>/g, function () { mentions++; return ' '; });
    t = t.replace(/(^|\s)@(everyone|here)\b/g, function (_, sp) { mentions++; return sp + ' '; });
    t = t.replace(/<#\d{5,22}>|<t:-?\d{1,13}(?::[tTdDfFR])?>|<\/[\w -]{1,64}:\d{5,22}>/g, ' ');
    t = t.replace(/[ \t]{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
    return { text: t, cemoji: cemoji, mentions: mentions };
  }
  // Small RFC 4180 reader for the older messages.csv (quoted fields, "" escapes, line breaks inside quotes).
  function parseCsv(text) {
    var rows = [], row = [], f = '', q = false, s = String(text || '').replace(/^\ufeff/, ''), c;
    for (var i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (q) { if (c === '"') { if (s.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s.charAt(i + 1) === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  var DC_CSV_HEAD_RE = /^\ufeff?\s*"?ID"?\s*,\s*"?Timestamp"?\s*,\s*"?Contents"?/i;
  function discordCsvRows(text) {
    var rows = parseCsv(text); if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).filter(function (r) { return r.length > 1 || (r[0] && r[0].trim()); }).map(function (r) { var o = {}; head.forEach(function (h, k) { o[h] = r[k] != null ? r[k] : ''; }); return o; });
  }
  function isDiscordRows(d) {
    return Array.isArray(d) && (d.length === 0 || d.slice(0, 20).some(function (r) { return r && typeof r === 'object' && 'ID' in r && 'Timestamp' in r; }));
  }
  function isDiscordChannelJson(d) {
    return !!d && typeof d === 'object' && !Array.isArray(d) && 'id' in d && 'type' in d && !('messages' in d) && (!!d.guild || Array.isArray(d.recipients) || 'name' in d);
  }
  function isDiscordIndexJson(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    var k = Object.keys(d);
    return k.length > 0 && k.every(function (x) { return /^\d{5,22}$/.test(x) && (d[x] === null || typeof d[x] === 'string'); });
  }
  function isDceJson(d) {
    return !!d && typeof d === 'object' && !Array.isArray(d) && !!d.channel && typeof d.channel === 'object' && !!d.guild && Array.isArray(d.messages) &&
      (d.messages.length === 0 || d.messages.slice(0, 20).some(function (m) { return m && typeof m === 'object' && m.author && typeof m.author === 'object' && 'timestamp' in m; }));
  }
  function discordKind(ch, raw) {
    var t = ch ? ch.type : null, ts = String(t == null ? '' : t).toUpperCase();
    if (t === 1 || ts === 'DM') return 'dm';
    if (t === 3 || ts === 'GROUP_DM') return 'group';
    if (ch && (ch.guild || /^(GUILD|PUBLIC_THREAD|PRIVATE_THREAD|ANNOUNCEMENT)/.test(ts) || [0, 2, 5, 10, 11, 12, 13, 15, 16].indexOf(t) >= 0)) return 'server';
    if (ch && Array.isArray(ch.recipients)) return ch.recipients.length > 2 ? 'group' : 'dm';
    if (/^direct message with /i.test(raw || '')) return 'dm';
    return 'unknown';
  }
  // Label for one channel. DM labels come from index.json ("Direct Message with ...") and are shown only on this
  // device; the share image never names a DM (see shareChannel).
  function discordChannelInfo(id, ch, index) {
    var raw = index && typeof index[id] === 'string' ? clean(index[id]).trim() : '';
    if (/^(none|null|unknown channel)$/i.test(raw)) raw = '';
    var kind = discordKind(ch, raw);
    var name = ch && typeof ch.name === 'string' ? clean(ch.name).trim() : '';
    var guild = ch && ch.guild && typeof ch.guild === 'object' ? ch.guild : null;
    var gname = guild && typeof guild.name === 'string' ? clean(guild.name).trim() : '';
    var label;
    if (kind === 'server') label = name ? '#' + name + (gname ? ' · ' + gname : '') : (raw || 'A server channel');
    else if (kind === 'group') label = name || raw || 'A group DM';
    else if (kind === 'dm') label = raw ? raw.replace(/^direct message with /i, 'DM with ') : 'A direct message';
    else label = raw || name || 'A Discord channel';
    return { id: String(id), label: label, kind: kind, guildKey: guild && guild.id != null ? String(guild.id) : (gname || null) };
  }
  function parseDiscordRows(rows, chId, opts) {
    var out = [];
    (rows || []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var ms = discordRowMs(r); if (!isFinite(ms)) return;
      var c = discordText(r.Contents != null ? r.Contents : r.contents);
      var a = r.Attachments != null ? r.Attachments : r.attachments;
      var att = typeof a === 'string' ? a.split(/\s+/).filter(Boolean).length : (Array.isArray(a) ? a.length : 0);
      var type = (c.text || c.cemoji.length || c.mentions) ? 'text' : (att ? 'media' : 'blank'); // blank: sticker, embed or poll only
      var p = localParts(ms, opts);
      out.push({ t: Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s), y: p.y, mo: p.mo, d: p.d, h: p.h, mi: p.mi, sender: DC_SELF, text: type === 'text' ? c.text : '', type: type,
        att: type === 'text' ? att : 0, cemoji: c.cemoji, mentions: c.mentions, ch: String(chId) });
    });
    return out;
  }
  function discordRowsFromText(text) {
    var body = String(text || '').replace(/^[\ufeff\s]+/, '');
    if (DC_CSV_HEAD_RE.test(body)) return discordCsvRows(body);
    var d; try { d = JSON.parse(body); } catch (e) { throw friendly('That Discord messages file could not be read. It may be cut off or damaged. Drop the whole data package .zip instead.'); }
    if (!isDiscordRows(d)) throw friendly('That is not a Discord messages.json file.');
    return d;
  }
  // One channel: { id, label, kind, guildKey, count, msgs }.
  function discordChannel(id, rows, ch, index, opts) {
    var info = discordChannelInfo(id, ch, index);
    info.msgs = parseDiscordRows(rows, info.id, opts);
    info.count = info.msgs.length;
    return info;
  }
  // The parsed shape every stat uses. pickId = one channel id, or null for all of them.
  function discordParsed(channels, pickId) {
    var use = pickId == null ? channels : channels.filter(function (c) { return c.id === String(pickId); });
    var msgs = [], info = {};
    use.forEach(function (c) { info[c.id] = { label: c.label, kind: c.kind, guildKey: c.guildKey }; msgs = msgs.concat(c.msgs); });
    msgs.sort(function (a, b) { return a.t - b.t; });
    var title = pickId == null || !use.length ? (channels.length === 1 ? (channels[0].kind === 'unknown' ? 'Your Discord messages' : channels[0].label) : 'Your year on Discord') : use[0].label;
    return { messages: msgs, dateOrder: 'ymd', groupName: title, format: 'discord', selfOnly: true, channels: info };
  }
  // For tests and single files: rows array, messages.json / messages.csv text, or { rows | text, channel, index, id }.
  function parseDiscord(input, opts) {
    var o = input && typeof input === 'object' && !Array.isArray(input) ? input : { rows: input };
    var rows = o.rows != null ? (typeof o.rows === 'string' ? discordRowsFromText(o.rows) : o.rows) : discordRowsFromText(o.text);
    var id = o.id != null ? String(o.id) : (o.channel && o.channel.id != null ? String(o.channel.id) : 'upload');
    return discordParsed([discordChannel(id, rows, o.channel || null, o.index || null, opts)], null);
  }
  function parseJsonLoose(t) { try { return JSON.parse(String(t).replace(/^\ufeff/, '')); } catch (e) { return null; } }
  // Reads only Messages/<channel>/{channel.json, messages.json|csv} and Messages/index.json, one channel at a time.
  function readDiscordZip(z, opts) {
    opts = opts || {};
    var byLower = {}, dirs = {}, order = [];
    z.entries.forEach(function (e) { byLower[e.name.toLowerCase()] = e; });
    z.entries.forEach(function (e) {
      var m = DC_MSG_FILE_RE.exec(e.name); if (!m) return;
      var dir = e.name.replace(/[^\/]*$/, ''), key = dir.toLowerCase(), fmt = m[3].toLowerCase();
      if (!dirs[key]) { dirs[key] = { dir: dir, id: m[2], entry: e, fmt: fmt }; order.push(key); }
      else if (fmt === 'json' && dirs[key].fmt === 'csv') { dirs[key].entry = e; dirs[key].fmt = 'json'; } // newer file wins
    });
    var indexes = {}, channels = [], skipped = 0, done = 0;
    function indexFor(dir) {
      var parent = dir.replace(/[^\/]*\/$/, '').toLowerCase();
      if (indexes[parent] !== undefined) return Promise.resolve(indexes[parent]);
      var ie = byLower[parent + 'index.json'];
      if (!ie) { indexes[parent] = null; return Promise.resolve(null); }
      return zipText(z.src, ie).then(function (t) { var d = parseJsonLoose(t); indexes[parent] = isDiscordIndexJson(d) ? d : null; return indexes[parent]; }, function () { indexes[parent] = null; return null; });
    }
    var chain = Promise.resolve();
    order.forEach(function (key) {
      chain = chain.then(function () {
        var d = dirs[key], ce = byLower[key + 'channel.json'];
        return Promise.all([indexFor(d.dir), ce ? zipText(z.src, ce).then(parseJsonLoose, function () { return null; }) : null, zipText(z.src, d.entry)]).then(function (r) {
          var rows; try { rows = d.fmt === 'csv' ? discordCsvRows(r[2]) : discordRowsFromText(r[2]); } catch (e) { skipped++; return; }
          var c = discordChannel(d.id, rows, r[1] && typeof r[1] === 'object' ? r[1] : null, r[0], opts);
          if (c.count) channels.push(c);
        }, function () { skipped++; }).then(function () { done++; if (opts.onProgress) opts.onProgress(done, order.length); });
      });
    });
    return chain.then(function () {
      if (!channels.length) throw new Error(skipped ? 'The Discord message files in this zip could not be read. Download your data package again.' : 'This Discord data package has no messages from you in it.');
      channels.sort(function (a, b) { return b.count - a.count || (a.label < b.label ? -1 : 1); });
      return { channels: channels, skipped: skipped };
    });
  }
  // Channel JSON with guild/channel/messages (best effort, not advertised): ordinary and reply messages only; joins, pins, calls,
  // renames and thread notices are skipped, and so are bots. Times are shown in this device's time zone.
  function parseDce(data, opts) {
    if (typeof data === 'string') { data = parseJsonLoose(data); if (!isDceJson(data)) throw friendly('That JSON file isn’t in a format we can read.'); }
    var msgs = [];
    data.messages.forEach(function (m) {
      if (!m || typeof m !== 'object' || !m.author || typeof m.author !== 'object' || m.author.isBot) return;
      if (!/^(default|reply|0|19)$/i.test(String(m.type == null ? 'Default' : m.type))) return;
      var ms = Date.parse(String(m.timestamp || '')); if (!isFinite(ms)) ms = snowflakeMs(m.id); if (!isFinite(ms)) return;
      var sender = clean(String(m.author.nickname || m.author.name || '')).trim(); if (!sender) return;
      var c = discordText(m.content), att = Array.isArray(m.attachments) ? m.attachments.length : 0;
      var type = (c.text || c.cemoji.length || c.mentions) ? 'text' : (Array.isArray(m.stickers) && m.stickers.length) ? 'sticker' : (att || (Array.isArray(m.embeds) && m.embeds.length)) ? 'media' : null;
      if (!type) return;
      var p = localParts(ms, opts);
      msgs.push({ t: Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s), y: p.y, mo: p.mo, d: p.d, h: p.h, mi: p.mi, sender: sender, text: type === 'text' ? c.text : '', type: type, att: type === 'text' ? att : 0, cemoji: c.cemoji, mentions: c.mentions });
    });
    msgs.sort(function (a, b) { return a.t - b.t; });
    var ch = data.channel, g = data.guild || {}, nm = typeof ch.name === 'string' ? clean(ch.name).trim() : '';
    var isDm = /^(direct|group)/i.test(String(ch.type || '')) || g.name === 'Direct Messages';
    return { messages: msgs, dateOrder: 'ymd', groupName: nm ? (isDm ? nm : '#' + nm) : null, format: 'dce' };
  }

  // Picks the parser by content, not by file name: Meta-shaped JSON (sender_name / timestamp_ms) = Instagram or
  // Messenger, any other JSON = Telegram (its parser explains what is wrong), else WhatsApp text.
  // v6: a JSON array of { ID, Timestamp, Contents } (or a CSV with that header) = Discord data package messages;
  // { guild, channel, messages[{ author, timestamp }] } = a channel JSON of that shape; Discord's channel.json / index.json alone
  // get a clear error. Telegram's result.json has neither shape, so its detection is unchanged.
  function sniffJson(text) {
    var body = String(text || '').replace(/^[\ufeff\s]+/, ''), c = body.charAt(0);
    if (c !== '{' && c !== '[') return null;
    var data; try { data = JSON.parse(body); } catch (e) { return c === '{' ? { format: 'telegram', data: null } : null; }
    if (isDiscordRows(data)) return { format: 'discord', data: data };
    if (isDceJson(data)) return { format: 'dce', data: data };
    if (isMetaJson(data)) return { format: 'meta', data: data };
    if (isDiscordChannelJson(data) || isDiscordIndexJson(data)) return { format: 'discord-meta', data: data };
    return { format: 'telegram', data: data };
  }
  function detectFormat(text) {
    var body = String(text || '').replace(/^[\ufeff\s]+/, ''), head = body.slice(0, 200);
    // "[" can start a JSON array or an iOS WhatsApp line like "[12/24/25, 9:14 PM] ..."; only real JSON counts.
    var j = sniffJson(body);
    if (j) return j.format;
    if (DC_CSV_HEAD_RE.test(head)) return 'discord';
    if (head.charAt(0) === '[') return 'whatsapp';
    if (/^<(!doctype html|html)/i.test(head)) return 'html';
    return 'whatsapp';
  }
  var DC_META_ERR = 'That is a Discord channel.json or index.json. It only names the channel. Drop the messages.json (or messages.csv) from the same folder, or better, the whole data package .zip.';
  function parseAny(text, opts) {
    var j = sniffJson(text);
    if (j && j.format === 'discord') return parseDiscord({ rows: j.data }, opts);
    if (j && j.format === 'dce') return parseDce(j.data, opts);
    if (j && j.format === 'discord-meta') throw friendly(DC_META_ERR);
    if (j && j.format === 'meta') return parseMeta(j.data, opts);
    if (j) return parseTelegram(j.data === null ? String(text) : j.data);
    var f = detectFormat(text);
    if (f === 'discord') return parseDiscord({ text: text }, opts);
    if (f === 'html') throw friendly('That looks like a web page, such as Telegram\'s HTML export. Export the chat again in Telegram Desktop and choose the format "Machine-readable JSON", then drop the result.json. (For Instagram or Messenger, request your information in JSON format, not HTML.)');
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
  var GN_RE = /\b(?:good ?night|nighty? ?night|night night|sweet dreams|sleep well|gn)\b/i; // v7, English only
  var GM_RE = /\b(?:good ?morning|morning!|gm)\b/i; // v7, English only
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
        links: 0, weekend: 0, lunch: 0, closes: 0, days: {}, // v3: links, weekend, lunch, closes, days
        blank: 0, attText: 0, mentions: 0, bursts: 0, // v6 (Discord): no-text messages, text + attachment, @-mentions, quick follow-ups
        gnight: 0, gmorn: 0 }); // v7 (Two of Us): good night / good morning messages (English only; counted, text never kept)
    }
    var chCount = {}; // v6: messages per Discord channel (personal recap)
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
      if (prev && prev.sender === m.sender && m.t - prev.t <= 60000) p.bursts++; // v6
      if (m.ch != null) chCount[m.ch] = (chCount[m.ch] || 0) + 1; // v6
      prev = m;
      if (m.type === 'media') { p.media++; return; }
      if (m.type === 'sticker') { p.sticker++; return; }
      if (m.type === 'deleted') { p.deleted++; return; }
      if (m.type === 'blank') { p.blank++; return; } // v6: Discord message with no text or attachment (sticker, embed, poll)
      if (m.att) p.attText++;
      if (m.mentions) p.mentions += m.mentions;
      if (m.cemoji) m.cemoji.forEach(function (e) { p.emojis[e] = (p.emojis[e] || 0) + 1; emojis[e] = (emojis[e] || 0) + 1; p.emojiCount++; });
      var tx = m.text;
      p.chars += tx.length;
      if (!p.longest || tx.length > p.longest.text.length) p.longest = { text: tx, t: m.t };
      if (OK_RE.test(tx.trim())) p.ok++;
      if (tx.indexOf('?') >= 0) p.questions++;
      if (/!/.test(tx)) p.exclaims++;
      if (LINK_RE.test(tx)) p.links++;
      var lm = tx.match(LAUGH_RE); if (lm) p.laughs += lm.length;
      var hm = tx.match(HEART_RE); if (hm) p.hearts += hm.length;
      if (GN_RE.test(tx)) p.gnight++; // v7
      if (GM_RE.test(tx)) p.gmorn++;  // v7
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
    var list = Object.keys(people).map(function (k) { var p = people[k]; p.share = p.count / msgs.length; p.medianGap = p.gaps.length >= 5 ? median(p.gaps) : Infinity; p.topEmoji = topOf(p.emojis); p.typed = p.count - p.media - p.sticker - p.deleted - p.blank; p.avgLen = p.typed > 0 ? p.chars / p.typed : 0; p.dayCount = Object.keys(p.days).length; delete p.days; return p; })
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
    if (parsed.selfOnly) selfStats(S, list[0], chCount, parsed.channels || {}, msgs.length);
    else S.awards = assignAwards(list);
    if (!parsed.selfOnly && list.length === 2) { S.pair = pairStats(list); pairWording(S.awards); } // v7: exactly two people sent messages
    return S;
  }
  // v7: the extra numbers for a 1-on-1 ("Two of Us") recap. Counts and one typical reply time each; no text.
  // Typical reply = the median gap before a reply from this person, counting only replies within 12 hours,
  // and only when there are at least 5 of them (otherwise null).
  function pairStats(list) {
    var a = list[0], b = list[1];
    function two(f) { return [f(a), f(b)]; }
    var starts = two(function (p) { return p.starts; });
    return {
      names: two(function (p) { return p.name; }),
      counts: two(function (p) { return p.count; }),
      starts: starts,
      startTotal: starts[0] + starts[1],
      reply: two(function (p) { return isFinite(p.medianGap) ? Math.round(p.medianGap) : null; }),
      hearts: two(function (p) { return p.hearts; }),
      laughs: two(function (p) { return p.laughs; }),
      questions: two(function (p) { return p.questions; }),
      goodnights: a.gnight + b.gnight,
      goodmornings: a.gmorn + b.gmorn
    };
  }
  // v7: same awards and numbers, worded for two people instead of a family or group.
  var PAIR_WORDS = [["Family Photographer", "Chief Photographer"], ["The group\'s personal librarian.", "Your personal librarian."], ["The group's personal librarian.", "Your personal librarian."], ["Curiosity keeps a family close.", "Curiosity keeps you two close."], ["The chat's sunrise.", "The morning person."]];
  function pairWording(awards) {
    (awards || []).forEach(function (a) { PAIR_WORDS.forEach(function (w) { a.title = a.title.split(w[0]).join(w[1]); a.line = a.line.split(w[0]).join(w[1]); }); });
  }
  function firstTexter(P) {
    if (!P || !P.startTotal) return '—';
    if (P.starts[0] === P.starts[1]) return 'A perfect tie';
    return P.names[P.starts[0] > P.starts[1] ? 0 : 1];
  }
  function isPair(S) { return !!(S && S.pair && !S.selfOnly); }
  // Which unlock a recap needs: 'pair' ($2.99) for a 1-on-1 recap, otherwise 'group' ($4.99).
  function planFor(S) { return isPair(S) ? 'pair' : 'group'; }
  // A group unlock covers any recap; a 1-on-1 unlock covers only 1-on-1 recaps. Older records have no plan (= group).
  function covers(plan, S) { return plan !== 'pair' || isPair(S); }
  function priceFor(S) { return isPair(S) ? PAIR_PRICE : PRICE; }
  function linkFor(S) { return isPair(S) ? PAIR_PAYMENT_LINK : PAYMENT_LINK; }
  function brandFor(S) { return isPair(S) ? PAIR_BRAND : BRAND_NAME; }

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

  // ---------- v6: personal recap (Discord data package = only your own messages) ----------
  // Badges about the person's own habits. Counts only; no message text, links or exact times are shown or stored.
  // A DM is never named in a badge line (the share image can show the first sentence of a line).
  // "4 server channels in 2 servers and 3 DMs" (a group DM counts as a DM here).
  function placesText(S) {
    var srv = S.srvCount || 0, other = (S.channelCount || 0) - srv - (S.dmCount || 0), parts = [];
    if (srv) parts.push(plural(srv, 'server channel') + (S.serverCount ? ' in ' + plural(S.serverCount, 'server') : ''));
    if (S.dmCount) parts.push(plural(S.dmCount, 'DM'));
    if (other > 0) parts.push(parts.length ? plural(other, 'other channel') : plural(other, 'channel'));
    return parts.join(parts.length > 2 ? ', ' : ' and ') || plural(S.channelCount || 0, 'channel');
  }
  function nfx(n) { return Math.round(n).toLocaleString('en-US'); }
  function placeName(c) { return !c ? 'one place' : c.kind === 'dm' ? 'one DM' : c.kind === 'group' ? 'one group DM' : c.kind === 'server' ? c.label : 'one channel'; }
  var SELF_AWARDS = [
    { id: 'owl', emoji: '🦉', title: 'Night Owl', metric: function (p) { return p.night; }, min: 3, short: function (p) { return nfx(p.night) + ' after midnight'; }, line: function (p) { return nfx(p.night) + ' of your messages went out between midnight and 4 AM. Sweet dreams eventually.'; } },
    { id: 'bird', emoji: '🐦', title: 'Early Bird', metric: function (p) { return p.early; }, min: 3, short: function (p) { return nfx(p.early) + ' before 8 AM'; }, line: function (p) { return nfx(p.early) + ' messages between 5 and 8 AM. Up with the sun.'; } },
    { id: 'hopper', emoji: '🧭', title: 'Server Hopper', metric: function (p, S) { return S.channelCount; }, min: 3, short: function (p, S) { return plural(S.channelCount, 'channel'); }, line: function (p, S) { return 'You posted in ' + placesText(S) + '. Everywhere at once.'; } },
    { id: 'weekend', emoji: '🎉', title: 'Weekend Warrior', metric: function (p) { return p.weekend; }, min: 5, short: function (p) { return nfx(p.weekend) + ' on weekends'; }, line: function (p) { return nfx(p.weekend) + ' messages on Saturdays and Sundays. Weekends well spent.'; } },
    { id: 'links', emoji: '🔗', title: 'Link Librarian', metric: function (p) { return p.links; }, min: 2, short: function (p) { return nfx(p.links) + ' links'; }, line: function (p) { return nfx(p.links) + ' links shared. Everyone\'s personal librarian.'; } },
    { id: 'home', emoji: '🏠', title: 'Home Base', metric: function (p, S) { var c = S.topChannels[0]; return S.channelCount >= 2 && c ? Math.round(c.share * 100) : 0; }, min: 40, short: function (p, S) { return Math.round(S.topChannels[0].share * 100) + '% in one place'; }, line: function (p, S) { return Math.round(S.topChannels[0].share * 100) + '% of your messages went to ' + placeName(S.topChannels[0]) + '. Home sweet home.'; } },
    { id: 'novel', emoji: '📜', title: 'Novelist in Residence', metric: function (p) { return p.longest ? p.longest.text.length : 0; }, min: 80, short: function (p) { return nfx(p.longest.text.length) + ' characters'; }, line: function (p) { return 'Your longest message of the year: ' + nfx(p.longest.text.length) + ' characters.'; } },
    { id: 'laugh', emoji: '😂', title: 'Chief Laugh Officer', metric: function (p) { return p.laughs; }, min: 3, short: function (p) { return nfx(p.laughs) + ' laughs'; }, line: function (p) { return nfx(p.laughs) + ' laughs (haha, lol, 😂) sent.'; } },
    { id: 'dm', emoji: '💌', title: 'DM Devotee', metric: function (p, S) { return S.total && S.dmMsgs / S.total >= 0.3 ? S.dmMsgs : 0; }, min: 10, short: function (p, S) { return nfx(S.dmMsgs) + ' in DMs'; }, line: function (p, S) { return nfx(S.dmMsgs) + ' of your messages were in DMs and group DMs. A true friend.'; } },
    { id: 'emoji', emoji: '✨', title: 'Emoji Artist', metric: function (p) { return p.emojiCount; }, min: 5, short: function (p) { return nfx(p.emojiCount) + ' emoji'; }, line: function (p) { return nfx(p.emojiCount) + ' emoji, favorite: ' + (p.topEmoji ? p.topEmoji.key : '') + '.'; } },
    { id: 'question', emoji: '❓', title: 'Question Master', metric: function (p) { return p.questions; }, min: 3, short: function (p) { return nfx(p.questions) + ' questions'; }, line: function (p) { return nfx(p.questions) + ' questions asked. Curiosity counts.'; } },
    { id: 'hype', emoji: '📣', title: 'Hype Squad Captain', metric: function (p) { return p.exclaims; }, min: 3, short: function (p) { return nfx(p.exclaims) + ' exclamations'; }, line: function (p) { return nfx(p.exclaims) + ' messages with an exclamation point!'; } },
    { id: 'media', emoji: '📎', title: 'Attachment Ace', metric: function (p) { return p.media + p.attText; }, min: 3, short: function (p) { return nfx(p.media + p.attText) + ' with attachments'; }, line: function (p) { return nfx(p.media + p.attText) + ' messages with photos, files or other attachments.'; } },
    { id: 'ok', emoji: '👌', title: 'Master of Few Words', metric: function (p) { return p.ok; }, min: 3, short: function (p) { return nfx(p.ok) + ' "ok"s'; }, line: function (p) { return nfx(p.ok) + ' perfectly efficient "k"s and "ok"s.'; } },
    { id: 'roll', emoji: '⚡', title: 'On a Roll', metric: function (p) { return p.bursts; }, min: 10, short: function (p) { return nfx(p.bursts) + ' rapid follow-ups'; }, line: function (p) { return nfx(p.bursts) + ' messages sent within a minute of your previous one. On a roll.'; } },
    { id: 'essay', emoji: '✍️', title: 'Essay Writer', metric: function (p) { return p.typed >= 5 ? Math.round(p.avgLen) : 0; }, min: 30, short: function (p) { return Math.round(p.avgLen) + ' characters on average'; }, line: function (p) { return 'Your typed messages averaged ' + Math.round(p.avgLen) + ' characters. Every word counted.'; } },
    { id: 'lunch', emoji: '🥪', title: 'Lunch Break Legend', metric: function (p) { return p.lunch; }, min: 3, short: function (p) { return nfx(p.lunch) + ' over lunch'; }, line: function (p) { return nfx(p.lunch) + ' messages between noon and 2 PM. Chatting over lunch.'; } },
    { id: 'heart', emoji: '❤️', title: 'Warmest Heart', metric: function (p) { return p.hearts; }, min: 3, short: function (p) { return nfx(p.hearts) + ' hearts'; }, line: function (p) { return nfx(p.hearts) + ' hearts and "love you"s sent.'; } },
    { id: 'shout', emoji: '🙌', title: 'Shout-out Giver', metric: function (p) { return p.mentions; }, min: 3, short: function (p) { return nfx(p.mentions) + ' @-mentions'; }, line: function (p) { return 'You @-mentioned people or roles ' + nfx(p.mentions) + ' times. Always looping people in.'; } },
    { id: 'regular', emoji: '📅', title: 'Always Around', metric: function (p) { return p.dayCount; }, min: 3, short: function (p) { return plural(p.dayCount, 'day'); }, line: function (p) { return 'You showed up on ' + p.dayCount + ' different days.'; } }
  ];
  function assignSelfAwards(p, S) {
    var out = [];
    SELF_AWARDS.forEach(function (a) {
      var v = a.metric(p, S);
      if (!isFinite(v) || v <= 0 || v < a.min) return;
      out.push({ id: a.id, emoji: a.emoji, title: a.title, winner: DC_SELF, short: a.short(p, S), line: a.line(p, S) });
    });
    return out.slice(0, MAX_AWARDS);
  }
  function selfStats(S, p, chCount, info, total) {
    S.selfOnly = true;
    S.topChannels = topN(chCount, 8).map(function (c) { var i = info[c.key] || {}; return { label: i.label || 'A Discord channel', kind: i.kind || 'unknown', count: c.count, share: c.count / total }; });
    var guilds = {}; S.dmMsgs = 0; S.dmCount = 0; S.srvCount = 0;
    Object.keys(chCount).forEach(function (k) { var i = info[k] || {}; if (i.kind === 'server') { S.srvCount++; if (i.guildKey) guilds[i.guildKey] = 1; } if (i.kind === 'dm' || i.kind === 'group') { S.dmMsgs += chCount[k]; S.dmCount++; } });
    S.channelCount = Object.keys(chCount).length;
    S.serverCount = Object.keys(guilds).length;
    S.links = p.links; S.mentions = p.mentions; S.attachments = p.media + p.attText;
    S.awards = assignSelfAwards(p, S);
  }

  // ---------- ZIP (reads _chat.txt with the browser's own DecompressionStream) ----------
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  // v5: the zip reading is split into zipIndex (central directory) + zipText (one entry) so a Meta export
  // with message_1.json, message_2.json ... (possibly for many chats) can be read with the same code.
  // v6: both work on a "source" that is either bytes already in memory or a File/Blob. For a File only the
  // pieces that are needed are read (the end of the zip, the central directory, then each wanted entry,
  // streamed through DecompressionStream), so a large Discord or Meta package is never loaded whole.
  // Zip64 (over 4 GB or 65,535 entries) is understood too.
  function u64(b, o) { return u32(b, o) + u32(b, o + 4) * 4294967296; }
  function readBlobBytes(blob) {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    return new Promise(function (res, rej) { var r = new FileReader(); r.onerror = function () { rej(new Error('Could not read that file.')); }; r.onload = function () { res(new Uint8Array(r.result)); }; r.readAsArrayBuffer(blob); });
  }
  function zipSource(x) {
    if (typeof Blob !== 'undefined' && x instanceof Blob) {
      return { size: x.size, read: function (s, e) { return readBlobBytes(x.slice(s, e)); }, blob: function (s, e) { return x.slice(s, e); } };
    }
    var b = x instanceof Uint8Array ? x : new Uint8Array(x);
    return { size: b.length, read: function (s, e) { return Promise.resolve(b.subarray(s, Math.min(e, b.length))); }, blob: function (s, e) { return new Blob([b.subarray(s, e)]); } };
  }
  function zipIndex(src) {
    var tailLen = Math.min(src.size, 65557 + 20), tailStart = src.size - tailLen;
    return src.read(tailStart, src.size).then(function (t) {
      var i, eocd = -1;
      for (i = t.length - 22; i >= 0; i--) if (u32(t, i) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('This does not look like a zip file.');
      var n = u16(t, eocd + 10), cdSize = u32(t, eocd + 12), cdOff = u32(t, eocd + 16);
      var z64 = (n === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) && eocd >= 20 && u32(t, eocd - 20) === 0x07064b50;
      var ready = Promise.resolve();
      if (z64) {
        var z64at = u64(t, eocd - 12);
        ready = src.read(z64at, z64at + 56).then(function (z) {
          if (z.length < 56 || u32(z, 0) !== 0x06064b50) throw new Error('This zip file is damaged.');
          n = u64(z, 32); cdSize = u64(z, 40); cdOff = u64(z, 48);
        });
      }
      return ready.then(function () { return src.read(cdOff, cdOff + cdSize); }).then(function (b) {
        var off = 0, entries = [], dec = new TextDecoder();
        for (var k = 0; k < n && off + 46 <= b.length && u32(b, off) === 0x02014b50; k++) {
          var nameLen = u16(b, off + 28), extraLen = u16(b, off + 30), comLen = u16(b, off + 32);
          var e = { name: dec.decode(b.subarray(off + 46, off + 46 + nameLen)), method: u16(b, off + 10), csize: u32(b, off + 20), usize: u32(b, off + 24), local: u32(b, off + 42) };
          if (e.usize === 0xffffffff || e.csize === 0xffffffff || e.local === 0xffffffff) { // zip64 extra field (id 1)
            for (var x = off + 46 + nameLen, xe = x + extraLen; x + 4 <= xe; x += 4 + u16(b, x + 2)) {
              if (u16(b, x) !== 1) continue;
              var q = x + 4;
              if (e.usize === 0xffffffff) { e.usize = u64(b, q); q += 8; }
              if (e.csize === 0xffffffff) { e.csize = u64(b, q); q += 8; }
              if (e.local === 0xffffffff) e.local = u64(b, q);
              break;
            }
          }
          entries.push(e);
          off += 46 + nameLen + extraLen + comLen;
        }
        var real = entries.filter(function (x) { return !/(^|\/)__MACOSX\//.test(x.name) && !/(^|\/)\._/.test(x.name); });
        return { src: src, entries: real };
      });
    });
  }
  function zipText(src, e) {
    return src.read(e.local, e.local + 30).then(function (h) {
      if (h.length < 30 || u32(h, 0) !== 0x04034b50) throw new Error('Zip entry is damaged.');
      var start = e.local + 30 + u16(h, 26) + u16(h, 28);
      if (e.method === 0) return src.read(start, start + e.csize).then(function (d) { return new TextDecoder().decode(d); });
      if (e.method !== 8) throw new Error('Unsupported zip compression.');
      if (typeof DecompressionStream === 'undefined') throw new Error('Your browser cannot unzip here. Unzip the file and drop the _chat.txt (WhatsApp), result.json (Telegram), message_1.json (Instagram / Messenger) or a messages.json (Discord) instead.');
      var stream = src.blob(start, start + e.csize).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (ab) { return new TextDecoder().decode(ab); });
    });
  }
  var ZIP_NONE = 'No WhatsApp _chat.txt or Telegram result.json found inside the zip, and no Instagram / Messenger message_1.json or Discord messages folder either.';
  var META_FILE_RE = /(^|\/)message_\d+\.json$/i;
  function pickZipEntry(real) {
    return real.filter(function (x) { return /(^|\/)_chat\.txt$/i.test(x.name); })[0]
      || real.filter(function (x) { return /(^|\/)result\.json$/i.test(x.name); }).sort(function (a, b) { return a.name.length - b.name.length; })[0];
  }
  // Kept for the WhatsApp / Telegram path (and old tests): resolves to the chat text.
  function readZipChat(buf) {
    var src; try { src = zipSource(buf); } catch (err) { return Promise.reject(err); }
    return zipIndex(src).then(function (z) {
      var e = pickZipEntry(z.entries) || z.entries.filter(function (x) { return /\.txt$/i.test(x.name); })[0];
      if (!e) throw new Error(ZIP_NONE);
      return zipText(z.src, e);
    });
  }
  // v5: resolves to { text } (WhatsApp / Telegram) or { threads: metaThreads(...) } (Instagram / Messenger).
  // v6: or { discord: { channels } } for a Discord data package. `buf` may also be a File / Blob (read in pieces).
  // opts.onProgress(done, total) is called while Discord channels are read.
  function readZipImport(buf, opts) {
    var src; try { src = zipSource(buf); } catch (err) { return Promise.reject(err); }
    return zipIndex(src).then(function (z) {
      var e = pickZipEntry(z.entries);
      if (e) return zipText(z.src, e).then(function (t) { return { text: t }; });
      if (z.entries.some(function (x) { return DC_MSG_FILE_RE.test(x.name); })) return readDiscordZip(z, opts).then(function (pkg) { return { discord: pkg }; });
      var metas = z.entries.filter(function (x) { return META_FILE_RE.test(x.name); });
      if (metas.length) {
        return Promise.all(metas.map(function (x) {
          return zipText(z.src, x).then(function (t) { var d = null; try { d = JSON.parse(t.replace(/^\ufeff/, '')); } catch (err) { d = null; } return { name: x.name, data: d }; });
        })).then(function (files) {
          var ok = files.filter(function (f) { return isMetaJson(f.data); });
          if (!ok.length) throw new Error('The message_N.json files in this zip could not be read. Download your information again in JSON format (not HTML).');
          return { threads: metaThreads(ok) };
        });
      }
      var txt = z.entries.filter(function (x) { return /\.txt$/i.test(x.name); })[0];
      if (txt) return zipText(z.src, txt).then(function (t) { return { text: t }; });
      if (z.entries.some(function (x) { return /(^|\/)message_\d+\.html$/i.test(x.name); })) throw new Error('This Instagram / Messenger download is in HTML format. Request your information again and choose JSON as the format.');
      if (z.entries.some(function (x) { return /(^|\/)(account\/user\.json|servers\/index\.json)$/i.test(x.name); })) throw new Error('This Discord data package has no messages in it. Request your data again and make sure Messages is selected.');
      throw new Error(ZIP_NONE);
    });
  }

  // ---------- Unlock-return storage (computed stats only, never chat text) ----------
  function slugify(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recap'; }
  function shareFilename(S) { return slugify(S ? brandFor(S) : BRAND_NAME) + '.png'; }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }
  // Whitelist of what may be stored on the device. Deliberately leaves out per-person
  // working data (longest message text, reply gaps, emoji maps) so no message text is kept.
  function toStoredStats(S) {
    var person = function (p) { return { name: p.name, count: p.count, share: p.share, topEmoji: p.topEmoji ? { key: p.topEmoji.key, count: p.topEmoji.count } : null }; };
    var o = pick(S, ['year', 'usedYear', 'total', 'totalAll', 'groupName', 'first', 'last', 'activeDays', 'span', 'perDay', 'laughs', 'media',
      'selfOnly', 'channelCount', 'serverCount', 'srvCount', 'dmMsgs', 'dmCount', 'links', 'mentions', 'attachments']); // v6: Discord personal-recap counts
    if (S.topChannels) o.topChannels = S.topChannels.map(function (c) { return pick(c, ['label', 'kind', 'count', 'share']); });
    o.people = (S.people || []).map(person);
    o.topTalker = S.topTalker ? person(S.topTalker) : null;
    o.busiestDay = pick(S.busiestDay, ['t', 'count']);
    o.busiestHour = pick(S.busiestHour, ['hour', 'count']);
    o.busiestWeekday = pick(S.busiestWeekday, ['day', 'count']);
    o.streak = pick(S.streak, ['len', 'start', 'end']);
    o.topEmojis = (S.topEmojis || []).map(function (e) { return { key: e.key, count: e.count }; });
    o.topWords = (S.topWords || []).map(function (e) { return { key: e.key, count: e.count }; });
    o.awards = (S.awards || []).map(function (a) { return pick(a, ['id', 'emoji', 'title', 'winner', 'short', 'line']); });
    if (S.pair) o.pair = pick(S.pair, ['names', 'counts', 'starts', 'startTotal', 'reply', 'hearts', 'laughs', 'questions', 'goodnights', 'goodmornings']); // v7: counts only
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
    if (opts.plan === 'pair') rec.paidPlan = 'pair'; // v7: an "unlocked" marker from a $2.99 return
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
    if (q.unlocked === '1') return q.plan === 'pair' ? { paid: true, plan: 'pair' } : { paid: true }; // v7: &plan=pair = the $2.99 link
    if (q.unlocked !== undefined) return { paid: false };
    if (q.paid !== '1') return null;
    var sid = q.session_id || '';
    return { paid: /^cs_(test|live)_[A-Za-z0-9_]{6,200}$/.test(sid), sessionId: sid };
  }
  // Turns the saved record after a paid return: unlocked, kept PAID_TTL_MS from now.
  function markPaid(storage, rec, now, plan) {
    now = now || Date.now();
    rec.paid = true; rec.expiresAt = now + PAID_TTL_MS; rec.paidAt = now;
    if (plan === 'pair') rec.paidPlan = 'pair'; else delete rec.paidPlan; // v7
    try { storage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
    return rec;
  }
  function paymentUrl(ref, link) { link = link || PAYMENT_LINK; return link + (link.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(ref); }

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

  var api = { parseChat: parseChat, parseTelegram: parseTelegram, flattenTgText: flattenTgText, detectFormat: detectFormat, parseAny: parseAny, computeStats: computeStats, assignAwards: assignAwards, readZipChat: readZipChat, readZipImport: readZipImport, parseMeta: parseMeta, fixMojibake: fixMojibake, isMetaJson: isMetaJson, metaThreads: metaThreads, inferDateOrder: inferDateOrder, AWARDS: AWARDS, MAX_AWARDS: MAX_AWARDS, plural: plural, featuredAwards: featuredAwards, fmtDate: fmtDate, fmtHour: fmtHour, PAYMENT_LINK: PAYMENT_LINK, PROTOTYPE_PREVIEW: PROTOTYPE_PREVIEW, PAIR_PAYMENT_LINK: PAIR_PAYMENT_LINK, PAIR_PRICE: PAIR_PRICE, PRICE: PRICE, PAIR_BRAND: PAIR_BRAND, pairStats: pairStats, isPair: isPair, planFor: planFor, covers: covers, priceFor: priceFor, linkFor: linkFor, brandFor: brandFor, firstTexter: firstTexter, BRAND_NAME: BRAND_NAME, STORE_KEY: STORE_KEY, PENDING_TTL_MS: PENDING_TTL_MS, PAID_TTL_MS: PAID_TTL_MS, slugify: slugify, shareFilename: shareFilename, toStoredStats: toStoredStats, saveRecord: saveRecord, loadRecord: loadRecord, forgetRecord: forgetRecord, markPaid: markPaid, parseReturn: parseReturn, paymentUrl: paymentUrl, qrEncode: qrEncode, drawQR: drawQR, QR_URL: QR_URL, shareFile: shareFile, canShareFiles: canShareFiles, shareImage: shareImage, SHARE_CTA: SHARE_CTA,
    // v6 (Discord)
    parseDiscord: parseDiscord, parseDce: parseDce, parseCsv: parseCsv, discordCsvRows: discordCsvRows, snowflakeMs: snowflakeMs, discordTsMs: discordTsMs, discordText: discordText,
    discordParsed: discordParsed, discordChannelInfo: discordChannelInfo, isDiscordRows: isDiscordRows, isDceJson: isDceJson, sniffJson: sniffJson, SELF_AWARDS: SELF_AWARDS, assignSelfAwards: assignSelfAwards, placesText: placesText };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.Wrapped = api;

  // ===================== Browser UI =====================
  var doc = root.document;
  var state = { stats: null, slides: [], idx: 0, unlocked: false, paidMarker: false, paidPlan: null };
  var SELF_NOTE = 'Only your own messages: Discord’s data package doesn’t include anyone else’s.';
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
    if (S.empty) { setStatus((parsed.format === 'discord' ? 'We could not find any messages from you in that Discord file. Make sure your data request included Messages, then drop the whole data package .zip (or a messages.json from inside its Messages folder).' : parsed.format === 'dce' ? 'We could not find any messages in that file.' : parsed.format === 'telegram' ? 'We could not find any messages in that Telegram export. Make sure it is a group or chat export from Telegram Desktop in the "Machine-readable JSON" format.' : parsed.format === 'meta' ? 'We could not find any messages in that Instagram or Messenger chat. Make sure your download includes Messages and covers the dates you want.' : 'We could not find any chat messages in that file. Make sure it is a WhatsApp "Export chat" file (.txt or .zip), a Telegram Desktop JSON export (result.json), an Instagram / Messenger JSON download (.zip or message_1.json), or a Discord data package (.zip, messages.json or messages.csv).'), true); return; }
    $('#picker').hidden = true;
    state.stats = S;
    state.unlocked = state.paidMarker && covers(state.paidPlan, S);
    showDeck(S);
  }
  // v5: a Meta download can hold many chats. Let the person pick one (titles are shown only here, on the device).
  var PICKER_MAX = 40;
  // v6: also used for Discord ("Which channels?"): items may carry their own open(), and opts sets the heading,
  // the note and how many leading items (e.g. "All channels") don't count toward the limit.
  var PICKER_DEFAULT = null;
  function showPicker(threads, opts) {
    opts = opts || {};
    var box = $('#picker'), list = $('#picker-list'), h = $('#picker-h'), note = $('#picker-note'), extra = opts.extra || 0;
    if (h && note) {
      if (!PICKER_DEFAULT) PICKER_DEFAULT = { h: h.textContent, note: note.textContent };
      h.textContent = opts.heading || PICKER_DEFAULT.h; note.textContent = opts.note || PICKER_DEFAULT.note;
    }
    list.textContent = '';
    threads.slice(0, PICKER_MAX + extra).forEach(function (th) {
      var b = el('button', 'btn btn-ghost picker-item');
      b.type = 'button';
      b.appendChild(el('span', 'picker-title', th.title));
      b.appendChild(el('span', 'picker-count', th.count === 1 ? '1 message' : Math.round(th.count).toLocaleString('en-US') + ' messages'));
      b.addEventListener('click', function () { if (th.open) th.open(); else openThread(th); });
      list.appendChild(b);
    });
    var n = threads.length - extra, noun = opts.noun || 'chats';
    $('#picker-more').hidden = n <= PICKER_MAX;
    $('#picker-more').textContent = n > PICKER_MAX ? 'Showing the ' + PICKER_MAX + ' biggest of ' + n + ' ' + noun + '.' + (opts.moreNote || '') : '';
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
  // v6: Discord data package: "All channels and DMs" first, then each channel, biggest first.
  function openDiscord(pkg, id) { handleParsed(discordParsed(pkg.channels, id), null); }
  function showDiscordPicker(pkg) {
    if (pkg.channels.length === 1) return openDiscord(pkg, null);
    var total = pkg.channels.reduce(function (n, c) { return n + c.count; }, 0);
    var items = [{ title: 'All channels and DMs (your whole year)', count: total, open: function () { openDiscord(pkg, null); } }]
      .concat(pkg.channels.map(function (c) { return { title: c.label, count: c.count, open: function () { openDiscord(pkg, c.id); } }; }));
    showPicker(items, { extra: 1, noun: 'channels', moreNote: ' “All channels and DMs” still includes every one.', heading: 'Which channels?',
      note: 'Your Discord data package has ' + plural(pkg.channels.length, 'channel') + ' and DMs with messages from you. Pick all of them for your whole year, or just one. It holds only messages you sent, so the recap is about you. This list is made on your device and isn’t saved.' });
  }
  function handleImport(r, label) {
    if (r.discord) return showDiscordPicker(r.discord);
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
  function isZipHead(head, file) {
    var b = new Uint8Array(head, 0, Math.min(4, head.byteLength));
    return (b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) || /\.zip$/i.test(file.name) || /zip/i.test(file.type || ''); // "PK\3\4" = zip, whatever the name
  }
  // v6: only the first 4 bytes are read to tell a zip apart. A zip is then read in pieces (see zipSource),
  // never loaded whole; other files are small and read in full.
  function sniffFile(file) { return readBuf(file.slice(0, 4)).then(function (head) { return isZipHead(head, file); }); }
  function zipProgress(done, total) { if (total > 20 && (done % 10 === 0 || done === total)) setStatus('Reading your Discord messages on your device… ' + done + ' of ' + total + ' channels'); }
  function handleFile(file) {
    if (!file) return;
    setStatus('Reading on your device…');
    $('#picker').hidden = true;
    sniffFile(file).then(function (zip) {
      if (zip) return readZipImport(file, { onProgress: zipProgress }).then(function (r) { handleImport(r, file.name); });
      return readBuf(file).then(function (buf) { handleText(new TextDecoder().decode(buf), file.name); });
    }).catch(function (err) { setStatus(err && err.message ? err.message : 'Could not read that file.', true); });
  }
  // v5: several files at once, e.g. message_1.json + message_2.json of one Instagram / Messenger chat.
  // v6: or Discord's messages.json (or .csv) together with its channel.json and/or index.json.
  function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (files.length <= 1) return handleFile(files[0]);
    setStatus('Reading on your device…');
    Promise.all(files.map(function (f) { return sniffFile(f).then(function (z) { return { f: f, zip: z }; }); })).then(function (heads) {
      var zips = heads.filter(function (x) { return x.zip; });
      if (zips.length) return handleFile(zips[0].f);
      return Promise.all(files.map(function (f) { return readBuf(f).then(function (b) { return new TextDecoder().decode(b); }); })).then(function (texts) {
        var sn = texts.map(sniffJson);
        if (sn.every(function (j) { return j && j.format === 'meta'; })) {
          var th = metaThreads(sn.map(function (j, i) { return { name: files[i].name, data: j.data }; }).map(function (x) { x.name = 'upload/' + x.name.replace(/^.*\//, ''); return x; }));
          return openThread(th[0]);
        }
        var rows = [], chs = [], idx = [];
        texts.forEach(function (t, i) {
          var j = sn[i];
          if (j && j.format === 'discord') rows.push(t);
          else if (!j && detectFormat(t) === 'discord') rows.push(t);
          else if (j && j.format === 'discord-meta') (isDiscordIndexJson(j.data) ? idx : chs).push(j.data);
          else rows.push(null);
        });
        if (rows.length === 1 && rows[0] !== null && chs.length <= 1 && idx.length <= 1) {
          var parsed;
          try { parsed = parseDiscord({ rows: rows[0], channel: chs[0] || null, index: idx[0] || null }); }
          catch (err) { setStatus(err && err.friendly ? err.message : 'Could not read that file.', true); return; }
          return handleParsed(parsed, null);
        }
        if (rows.filter(function (r) { return r !== null; }).length > 1 && rows.every(function (r) { return r !== null; })) {
          setStatus('To combine several Discord channels, drop the whole data package .zip instead of separate messages files.', true); return;
        }
        setStatus('Please drop one chat file at a time (or, for Instagram / Messenger, the message_N.json files of one chat; for Discord, the data package .zip).', true);
      });
    }).catch(function (err) { setStatus(err && err.message ? err.message : 'Could not read those files.', true); });
  }

  function slide(kind, title) { var s = el('section', 'slide slide-' + kind); s.setAttribute('aria-roledescription', 'slide'); var inner = el('div', 'slide-inner'); s.appendChild(inner); if (title) inner.appendChild(el('p', 'slide-kicker', title)); return { node: s, inner: inner }; }
  function big(parent, num, label) { var d = el('div', 'big'); d.appendChild(el('div', 'big-num', num)); if (label) d.appendChild(el('div', 'big-label', label)); parent.appendChild(d); }

  // v6: the personal Discord deck. Same free/locked split (first 4 free) and the same lock, share and storage code.
  function selfSlides(S) {
    var slides = [], yr = S.usedYear ? String(S.year) : 'all time', name = S.groupName || 'Your year on Discord';
    var top = (S.topChannels || [])[0];
    var s1 = slide('intro', BRAND_NAME);
    s1.inner.appendChild(el('h2', 'slide-title', name));
    big(s1.inner, nf(S.total), 'messages you sent in ' + yr);
    s1.inner.appendChild(el('p', 'slide-sub', placesText(S) + ' · ' + plural(S.activeDays, 'active day')));
    s1.inner.appendChild(el('p', 'slide-note self-note', SELF_NOTE));
    if (!S.usedYear) s1.inner.appendChild(el('p', 'slide-note', 'No ' + S.year + ' messages found, so this covers everything: ' + fmtDate(S.first) + ' to ' + fmtDate(S.last) + '.'));
    else if (S.totalAll > S.total) s1.inner.appendChild(el('p', 'slide-note', 'Counting ' + S.year + ' only (' + nf(S.totalAll - S.total) + ' older messages left out).'));
    slides.push(s1);

    var s2 = slide('busy', 'When you posted');
    big(s2.inner, fmtDate(S.busiestDay.t), 'your busiest day · ' + nf(S.busiestDay.count) + ' messages');
    big(s2.inner, fmtHour(S.busiestHour.hour), 'your busiest hour');
    big(s2.inner, S.busiestWeekday.day, 'your busiest weekday');
    s2.inner.appendChild(el('p', 'slide-sub', 'About ' + (Math.round(S.perDay * 10) / 10) + ' messages a day'));
    slides.push(s2);

    var s3 = slide('talk', 'Where you talked');
    s3.inner.appendChild(el('h2', 'slide-title', top ? top.label : name));
    if (top) s3.inner.appendChild(el('p', 'slide-sub', nf(top.count) + ' messages · ' + Math.round(top.share * 100) + '% of yours'));
    var bars = el('ul', 'bars');
    (S.topChannels || []).forEach(function (c) {
      var li = el('li'); var lab = el('span', 'bar-label', c.label); var track = el('span', 'bar-track'); var fill = el('span', 'bar-fill');
      fill.style.width = Math.max(2, Math.round(c.share / top.share * 100)) + '%';
      track.appendChild(fill); li.appendChild(lab); li.appendChild(track); li.appendChild(el('span', 'bar-val', Math.round(c.share * 100) + '%')); bars.appendChild(li);
    });
    if ((S.channelCount || 0) > 8) bars.appendChild(el('li', 'bar-more', '+ ' + (S.channelCount - 8) + ' more'));
    s3.inner.appendChild(bars);
    if (S.dmMsgs) s3.inner.appendChild(el('p', 'slide-sub', nf(S.dmMsgs) + ' of your messages were in DMs and group DMs'));
    slides.push(s3);

    var s4 = slide('streak', 'Your longest streak');
    big(s4.inner, plural(S.streak.len, 'day'), 'in a row with at least one message from you');
    s4.inner.appendChild(el('p', 'slide-sub', fmtDate(S.streak.start) + ' → ' + fmtDate(S.streak.end)));
    slides.push(s4);

    var s5 = slide('emoji', 'Your emoji of the year');
    if (S.topEmojis.length) {
      big(s5.inner, S.topEmojis[0].key, 'used ' + nf(S.topEmojis[0].count) + ' times');
      if (S.topEmojis.length > 1) s5.inner.appendChild(el('p', 'slide-sub', 'Runners-up: ' + S.topEmojis.slice(1).map(function (e) { return e.key; }).join('  ')));
    } else s5.inner.appendChild(el('p', 'slide-sub', 'A purely emoji-free year. Impressive restraint.'));
    slides.push(s5);

    var s6 = slide('word', 'Your word of the year');
    if (S.topWords.length) {
      big(s6.inner, '“' + S.topWords[0].key + '”', 'said ' + nf(S.topWords[0].count) + ' times');
      s6.inner.appendChild(el('p', 'slide-sub', 'Runners-up: ' + S.topWords.slice(1).map(function (w) { return w.key; }).join(', ')));
    } else s6.inner.appendChild(el('p', 'slide-sub', 'Not enough words to pick one.'));
    slides.push(s6);

    var s7 = slide('laugh', 'Laughs, links and files');
    big(s7.inner, nf(S.laughs), 'laughs you sent (haha, lol, 😂, 🤣)');
    big(s7.inner, nf(S.links || 0), 'links you shared');
    big(s7.inner, nf(S.attachments || 0), 'messages with attachments');
    slides.push(s7);

    for (var i = 0; i < S.awards.length; i += 4) {
      var sa = slide('awards', 'Your badges' + (S.awards.length > 4 ? ' (' + (i / 4 + 1) + '/' + Math.ceil(S.awards.length / 4) + ')' : ''));
      var ula = el('ul', 'awards');
      S.awards.slice(i, i + 4).forEach(function (a) {
        var li = el('li'); li.appendChild(el('span', 'aw-emoji', a.emoji));
        var tx = el('div'); tx.appendChild(el('strong', null, a.title)); tx.appendChild(el('span', 'aw-win', a.short || a.winner)); tx.appendChild(el('span', 'aw-line', a.line));
        li.appendChild(tx); ula.appendChild(li);
      });
      sa.inner.appendChild(ula);
      slides.push(sa);
    }

    var ss = slide('summary', 'Your ' + yr + ' in one slide');
    ss.inner.appendChild(el('h2', 'slide-title', name));
    var grid = el('dl', 'sum');
    [['Messages', nf(S.total)], ['Top channel', top ? top.label : '—'], ['Busiest day', fmtDate(S.busiestDay.t)], ['Streak', plural(S.streak.len, 'day')], ['Emoji', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word', S.topWords[0] ? S.topWords[0].key : '—']].forEach(function (r) { grid.appendChild(el('dt', null, r[0])); grid.appendChild(el('dd', null, r[1])); });
    ss.inner.appendChild(grid);
    var ul2 = el('ul', 'sum-awards');
    S.awards.slice(0, 6).forEach(function (a) { ul2.appendChild(el('li', null, a.emoji + ' ' + a.title + (a.short ? ': ' + a.short : ''))); });
    ss.inner.appendChild(ul2);
    ss.inner.appendChild(el('p', 'slide-foot', 'made at zexley.com · stats computed by code, badges for fun · only your own messages, from your Discord data package · not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, Discord, or Spotify'));
    slides.push(ss);
    return slides;
  }
  // ---------- v7: "Two of Us", the 1-on-1 deck (exactly two people sent messages) ----------
  // Same free/locked split (first 4 free), lock, share and storage code. Kind, count-based, no message text.
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function pairBars(parent, P, vals) {
    var tot = vals[0] + vals[1], mx = Math.max(vals[0], vals[1]) || 1, bars = el('ul', 'bars');
    [0, 1].forEach(function (i) {
      var li = el('li'); var lab = el('span', 'bar-label', P.names[i]); var track = el('span', 'bar-track'); var fill = el('span', 'bar-fill');
      fill.style.width = Math.max(2, Math.round(vals[i] / mx * 100)) + '%';
      track.appendChild(fill); li.appendChild(lab); li.appendChild(track); li.appendChild(el('span', 'bar-val', pct(vals[i], tot) + '%')); bars.appendChild(li);
    });
    parent.appendChild(bars);
  }
  function pairSlides(S) {
    var P = S.pair, slides = [], yr = S.usedYear ? String(S.year) : 'all time', duo = P.names.join(' & ');
    var s1 = slide('intro', PAIR_BRAND);
    s1.inner.appendChild(el('h2', 'slide-title', duo));
    big(s1.inner, nf(S.total), 'messages between you in ' + yr);
    s1.inner.appendChild(el('p', 'slide-sub', plural(S.activeDays, 'day') + ' you talked · about ' + (Math.round(S.perDay * 10) / 10) + ' messages a day'));
    if (!S.usedYear) s1.inner.appendChild(el('p', 'slide-note', 'No ' + S.year + ' messages found, so this covers everything: ' + fmtDate(S.first) + ' to ' + fmtDate(S.last) + '.'));
    else if (S.totalAll > S.total) s1.inner.appendChild(el('p', 'slide-note', 'Counting ' + S.year + ' only (' + nf(S.totalAll - S.total) + ' older messages left out).'));
    slides.push(s1);

    var s2 = slide('busy', 'When you two talked');
    big(s2.inner, fmtDate(S.busiestDay.t), 'your busiest day · ' + nf(S.busiestDay.count) + ' messages');
    big(s2.inner, fmtHour(S.busiestHour.hour), 'your busiest hour');
    big(s2.inner, S.busiestWeekday.day, 'your busiest weekday');
    slides.push(s2);

    var s3 = slide('talk', 'Who texts first');
    var ft = firstTexter(P);
    s3.inner.appendChild(el('h2', 'slide-title', ft));
    if (P.startTotal && P.starts[0] !== P.starts[1]) {
      var w = P.starts[0] > P.starts[1] ? 0 : 1;
      s3.inner.appendChild(el('p', 'slide-sub', 'started ' + pct(P.starts[w], P.startTotal) + '% of your conversations (' + nf(P.starts[w]) + ' of ' + nf(P.startTotal) + ')'));
    } else if (P.startTotal) s3.inner.appendChild(el('p', 'slide-sub', 'You each started ' + nf(P.starts[0]) + ' conversations.'));
    pairBars(s3.inner, P, P.starts);
    s3.inner.appendChild(el('p', 'slide-note', 'A conversation starts with the first message after 6+ quiet hours. Messages overall: ' + P.names[0] + ' ' + pct(P.counts[0], S.total) + '% · ' + P.names[1] + ' ' + pct(P.counts[1], S.total) + '%.'));
    slides.push(s3);

    var s4 = slide('streak', 'Your longest streak');
    big(s4.inner, plural(S.streak.len, 'day'), 'in a row that you talked');
    s4.inner.appendChild(el('p', 'slide-sub', fmtDate(S.streak.start) + ' → ' + fmtDate(S.streak.end)));
    slides.push(s4);

    var s5 = slide('reply', 'Reply speed');
    [0, 1].forEach(function (i) {
      big(s5.inner, P.reply[i] != null ? fmtGap(P.reply[i]) : '—', P.names[i] + (P.reply[i] != null ? '’s typical reply' : ': not enough quick replies to tell'));
    });
    s5.inner.appendChild(el('p', 'slide-note', 'Typical = the middle value of replies sent within 12 hours. Just for fun: life gets busy.'));
    slides.push(s5);

    var s6 = slide('emoji', 'Your emoji');
    if (S.topEmojis.length) {
      big(s6.inner, S.topEmojis[0].key, 'your shared favorite · used ' + nf(S.topEmojis[0].count) + ' times');
      var ul = el('ul', 'mini');
      S.people.slice(0, 2).forEach(function (p) { if (p.topEmoji) ul.appendChild(el('li', null, p.name + ': ' + p.topEmoji.key)); });
      s6.inner.appendChild(ul);
    } else s6.inner.appendChild(el('p', 'slide-sub', 'A purely emoji-free year. Impressive restraint.'));
    slides.push(s6);

    var s7 = slide('word', 'Your word of the year');
    if (S.topWords.length) {
      big(s7.inner, '“' + S.topWords[0].key + '”', 'said ' + nf(S.topWords[0].count) + ' times between you');
      s7.inner.appendChild(el('p', 'slide-sub', 'Runners-up: ' + S.topWords.slice(1).map(function (w) { return w.key; }).join(', ')));
    } else s7.inner.appendChild(el('p', 'slide-sub', 'Not enough words to pick one.'));
    slides.push(s7);

    var s8 = slide('laugh', 'Hearts and laughs');
    big(s8.inner, nf(P.hearts[0] + P.hearts[1]), 'hearts and “love you”s');
    big(s8.inner, nf(P.laughs[0] + P.laughs[1]), 'laughs (haha, lol, 😂, 🤣)');
    if (P.goodnights || P.goodmornings) s8.inner.appendChild(el('p', 'slide-sub', nf(P.goodmornings) + ' good mornings · ' + nf(P.goodnights) + ' good nights'));
    slides.push(s8);

    for (var i = 0; i < S.awards.length; i += 4) {
      var sa = slide('awards', 'Your awards' + (S.awards.length > 4 ? ' (' + (i / 4 + 1) + '/' + Math.ceil(S.awards.length / 4) + ')' : ''));
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
    ss.inner.appendChild(el('h2', 'slide-title', duo));
    var grid = el('dl', 'sum');
    [['Messages', nf(S.total)], ['First to text', ft], ['Busiest day', fmtDate(S.busiestDay.t)], ['Streak', plural(S.streak.len, 'day')], ['Emoji', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word', S.topWords[0] ? S.topWords[0].key : '—']].forEach(function (r) { grid.appendChild(el('dt', null, r[0])); grid.appendChild(el('dd', null, r[1])); });
    ss.inner.appendChild(grid);
    var ul2 = el('ul', 'sum-awards');
    S.awards.slice(0, 6).forEach(function (a) { ul2.appendChild(el('li', null, a.emoji + ' ' + a.title + ': ' + a.winner)); });
    ss.inner.appendChild(ul2);
    ss.inner.appendChild(el('p', 'slide-foot', 'made at zexley.com · a 1-on-1 recap · stats computed by code, awards for fun · not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, Discord, or Spotify'));
    slides.push(ss);
    return slides;
  }
  // The share image never names a DM partner, even though this device's slides can.
  function shareChannel(c) { return !c ? '—' : c.kind === 'dm' ? 'A direct message' : c.kind === 'group' ? 'A group DM' : c.label; }
  api.shareChannel = shareChannel;

  function buildSlides(S) {
    var name = S.groupName || 'Your group chat';
    var slides = S.selfOnly ? selfSlides(S) : isPair(S) ? pairSlides(S) : [];
    var yr = S.usedYear ? String(S.year) : 'all time';
    if (!S.selfOnly && !isPair(S)) {

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
    ss.inner.appendChild(el('p', 'slide-foot', 'made at zexley.com · stats computed by code, awards for fun · not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, Discord, or Spotify'));
    slides.push(ss);
    }

    state.slides = slides;
    var track = $('#slides'); track.textContent = '';
    slides.forEach(function (s, k) {
      s.node.id = 'slide-' + (k + 1);
      s.node.setAttribute('aria-label', 'Slide ' + (k + 1) + ' of ' + slides.length);
      if (k >= FREE_SLIDES) {
        s.node.classList.add('locked');
        var lock = el('div', 'lock');
        lock.appendChild(el('p', 'lock-title', '🔒 ' + (slides.length - FREE_SLIDES) + ' more slides, including all ' + S.awards.length + (S.selfOnly ? ' badges' : ' awards')));
        var b = el('button', 'btn unlock-btn', 'Unlock everything · ' + priceFor(S) + ' one-time');
        b.type = 'button'; b.addEventListener('click', onUnlock);
        lock.appendChild(b);
        var note = el('p', 'lock-note');
        note.appendChild(doc.createTextNode('If the unlock doesn’t work or you’re unhappy, email neo@zexley.com within 14 days of purchase and we’ll refund the ' + priceFor(S) + '. You don’t need to send us your chat. By paying, you agree to the '));
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
    var note = $('#paynote'), link = linkFor(state.stats);
    if (link.indexOf('PLACEHOLDER') >= 0) {
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
    if (rec) { root.location.assign(paymentUrl(rec.ref, link)); return; }
    // Storage blocked (some private modes): keep this tab's deck and pay in a new tab.
    root.open(link, '_blank', 'noopener');
    note.hidden = false;
    note.querySelector('.pay-msg').textContent = 'Checkout opened in a new tab. Your browser blocks on-device storage, so keep this tab open and come back to it after paying.';
  }

  // PROTOTYPE ONLY: does exactly what a real checkout return would do, without Stripe.
  function simulateReturn() {
    var rec = store() && saveRecord(store(), state.stats);
    if (!rec) { setStatus('This browser blocks on-device storage, so the return cannot be simulated.', true); return; }
    root.location.assign(root.location.pathname + '?unlocked=1' + (isPair(state.stats) ? '&plan=pair' : ''));
  }

  function fmtClock(t) { var d = new Date(t); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  function forgetNow() {
    var s = store(); if (s) forgetRecord(s);
    state.paidMarker = false; state.paidPlan = null;
    reset();
    $('#saved').hidden = true;
    setStatus('Forgotten. Nothing from your recap is stored on this device.');
  }

  function showSaved(rec) {
    var box = $('#saved'); box.hidden = false;
    box.querySelector('.saved-msg').textContent = rec.stats
      ? (rec.paid ? 'Your unlocked recap' : 'Your recap') + (rec.stats.pair ? ' for ' + rec.stats.pair.names.join(' & ') : rec.stats.groupName ? ' for “' + rec.stats.groupName + '”' : '') + ' is saved on this device until ' + fmtClock(rec.expiresAt) + '. Only the stats are saved, never your messages.'
      : 'Your unlock is remembered on this device until ' + fmtClock(rec.expiresAt) + '. Load your ' + (rec.paidPlan === 'pair' ? '1-on-1 ' : '') + 'chat and it opens fully unlocked. No chat data is saved.';
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
    state.stats = rec.stats; state.unlocked = !!rec.paid && covers(rec.paidPlan, rec.stats);
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
        if (rec && rec.stats && !covers(ret.plan, rec.stats)) {
          // v7: a $2.99 (1-on-1) return, but the saved recap is a group chat. Don't unlock it; don't hide the problem.
          setStatus('Thanks for paying! That checkout was the $2.99 one for 1-on-1 chats, but your saved recap is a group chat, so it stays locked. Email neo@zexley.com and we’ll sort it out or refund you.', true);
          showSaved(rec); return;
        }
        if (rec) { markPaid(s, rec, null, ret.plan); state.paidMarker = true; state.paidPlan = rec.paidPlan || null; if (rec.stats) { $('#deck-msg').hidden = false; $('#deck-msg').textContent = 'Thanks! Your full recap is unlocked. It is kept on this device until ' + fmtClock(rec.expiresAt) + ', or press “Forget my recap now”.'; restore(rec); return; } }
        // Paid, but the saved stats are gone (expired, other browser, storage blocked).
        var marker = s && saveRecord(s, null, { paid: true, plan: ret.plan }); if (marker) scheduleExpiry(marker);
        state.paidMarker = true; state.paidPlan = ret.plan === 'pair' ? 'pair' : null;
        setStatus(ret.plan === 'pair' ? 'Thanks for paying! Your saved recap is no longer on this device. Load your 1-on-1 chat again and it will open fully unlocked.' : 'Thanks for paying! Your saved recap is no longer on this device. Load your chat again and it will open fully unlocked.');
        return;
      }
    }
    var saved = s && loadRecord(s);
    if (saved) { state.paidMarker = !!saved.paid; state.paidPlan = saved.paidPlan || null; showSaved(saved); }
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
    x.fillText(fitText(x, brandFor(S).toUpperCase(), 1000).split('').join(String.fromCharCode(8202)), 540, 140);
    var self = !!S.selfOnly, top = self ? (S.topChannels || [])[0] : null, pair = isPair(S) ? S.pair : null;
    // v6: a personal recap says "My year on Discord"; one server channel keeps its name; a DM is never named here.
    var title = pair ? pair.names.join(' & ') : !self ? S.groupName : (S.channelCount === 1 && top && top.kind === 'server' ? top.label : 'My year on Discord');
    x.fillStyle = '#fffaf2'; x.font = '700 84px ' + serif; x.fillText(fitText(x, title || (self ? 'My year on Discord' : 'Our group chat'), 960), 540, 250);
    x.font = '700 200px ' + serif; x.fillStyle = '#fffaf2'; x.fillText(nf(S.total), 540, 470);
    x.font = '400 44px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText((self ? 'messages I sent' : pair ? 'messages between us' : 'messages') + (S.usedYear ? ' in ' + S.year : ' (all time)'), 540, 535);
    if (self) { x.font = '400 28px ' + sans; x.fillStyle = '#b8ab92'; x.fillText('only my own messages, from my Discord data package', 540, 580); } // v6
    var rows = [pair ? ['First to text', firstTexter(pair)] : [self ? 'Top channel' : 'Top talker', self ? shareChannel(top) : S.topTalker.name], ['Busiest day', fmtDate(S.busiestDay.t)], ['Longest streak', plural(S.streak.len, 'day')], ['Emoji of the year', S.topEmojis[0] ? S.topEmojis[0].key : '—'], ['Word of the year', S.topWords[0] ? S.topWords[0].key : '—']];
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
      x.font = '700 48px ' + serif; x.fillStyle = '#fffaf2'; x.fillText(fitText(x, locked ? '? ? ?' : (self && a.short ? a.short : a.winner), W - 200), L + 165, top + 100);
      var sub = locked ? (self ? 'Unlock the full recap to see this badge.' : 'Who won? Unlock the full recap to find out.') : (/^(.+?[.!?])(\s|$)/.exec(a.line) || [a.line, a.line])[1]; // first sentence only
      x.font = '400 28px ' + sans; x.fillStyle = '#e8dcc6'; x.fillText(fitText(x, sub, W - 200), L + 165, top + 130);
      x.textAlign = 'center';
    }
    if (feat.length) {
      x.font = '700 50px ' + serif; x.fillStyle = '#d9a441';
      x.fillText(state.unlocked ? (self ? 'My top badges' : 'Top awards') + (S.awards.length > feat.length ? ' (' + feat.length + ' of ' + S.awards.length + ')' : '') : S.awards.length + (self ? ' personal badges inside 🏆' : pair ? ' awards for two inside 🏆' : ' group awards inside 🏆'), 540, y);
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
    var naf = 'Not affiliated with Meta, WhatsApp, Instagram, Messenger, Telegram, Discord, or Spotify', nfs = 26;
    while (nfs > 18 && x.measureText(naf).width > 1000) { nfs--; x.font = '400 ' + nfs + 'px ' + sans; } // v5: longer list, keep it on the canvas
    x.fillText(naf, 540, 1904);
    return c;
  }
  function saveBlob(blob) {
    var url = URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = shareFilename(state.stats);
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadShare() { drawShare().toBlob(saveBlob, 'image/png'); }
  // v4: "Share image" opens the phone's share sheet with the PNG; falls back to the download.
  function nativeShare() {
    var file;
    try { file = shareFile(drawShare().toDataURL('image/png'), shareFilename(state.stats)); } catch (e) { downloadShare(); return Promise.resolve('downloaded'); }
    return shareImage(root.navigator, file, function () { saveBlob(file); }).then(function (r) { api.lastShareResult = r; return r; });
  }
  function setupShareButton() {
    var b = $('#share-native'); if (!b) return;
    var probe = null; try { probe = new File([new Uint8Array([137, 80, 78, 71])], 'probe.png', { type: 'image/png' }); } catch (e) { probe = null; }
    b.hidden = !(probe && canShareFiles(root.navigator, probe));
    b.addEventListener('click', nativeShare);
  }
  api.drawShare = drawShare; api.nativeShare = nativeShare;

  function reset() { state = { stats: null, slides: [], idx: 0, unlocked: false, paidMarker: state.paidMarker, paidPlan: state.paidPlan }; $('#deck-msg').hidden = true; $('#slides').textContent = ''; $('#deck').hidden = true; $('#intro').hidden = false; $('#paynote').hidden = true; $('#file').value = ''; $('#picker').hidden = true; setStatus(''); }

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
    var sp = $('#sample-pair-btn'); // v7: the made-up 1-on-1 sample (Juniper and Wren)
    if (sp && $('#sample-pair')) sp.addEventListener('click', function () { handleText($('#sample-pair').textContent, 'WhatsApp Chat - Wren (sample).txt'); });
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
