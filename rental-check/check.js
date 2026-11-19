/* Zexley rental listing red-flag checker. Runs entirely in the browser. No network requests, no storage. */
(function () {
  "use strict";

  // bad: which answer is the red flag ("yes" or "no"). w: weight. crit: forces at least "High".
  var Q = [
    { id: "pay", bad: "yes", w: 4, crit: true, q: "Do they want payment by wire transfer, Zelle, Venmo, Cash App, gift cards, or crypto?",
      flag: "They want a payment method that is hard or impossible to reverse.",
      todo: "Ask how rent and the deposit are paid. Be wary of wire, payment apps, gift cards, or crypto.",
      step: "Don't pay by wire, payment app, gift card, or crypto. Pay only after you've seen the place and signed a lease, using a traceable method such as a check or the management company's official payment portal." },
    { id: "upfront", bad: "yes", w: 3, q: "Are they asking for a deposit, application fee, or first month's rent before you've seen the place in person or signed a lease?",
      flag: "They want money before you've seen the unit or signed a lease (an FTC warning sign).",
      todo: "Find out what they want paid, and when.",
      step: "Don't send any money to \"hold\" the unit. A real landlord can wait until after a showing and a signed lease." },
    { id: "noshow", bad: "yes", w: 3, q: "Will they avoid showing it in person, or only offer a \"self-tour\" with a lockbox code sent by text?",
      flag: "No in-person showing, or only a texted lockbox code. The FTC says scammers copy self-tour listings this way.",
      todo: "Ask for an in-person showing with the landlord or agent.",
      step: "Insist on an in-person showing with the owner or a licensed agent who has keys. If you can't go, send someone you trust." },
    { id: "away", bad: "yes", w: 3, q: "Is the \"landlord\" out of the country, deployed, on a mission, or otherwise unable to meet?",
      flag: "The landlord says they're away and can't meet. This is a classic scam story.",
      todo: "Ask where the landlord is and who will hand over the keys.",
      step: "Treat \"I'm away, just send the money and I'll mail the keys\" as a scam until proven otherwise." },
    { id: "dup", bad: "yes", w: 4, crit: true, q: "Did you find the same photos or address listed elsewhere with a different price or contact, or listed for sale?",
      flag: "The same home appears elsewhere with a different price, a different contact, or as for sale (an FTC warning sign).",
      todo: "Reverse-search the photos and search the address (see the steps below).",
      step: "Contact the other listing's agent or owner, using details you found yourself, and ask whether the home is really for rent." },
    { id: "credit", bad: "yes", w: 3, q: "Did they send you a link to a specific credit-check site, or ask for a screenshot of your credit score?",
      flag: "They sent a credit-check link or asked for a credit-score screenshot. The FTC says real landlords usually pull credit themselves.",
      todo: "If they ask for a credit report, ask whether they run it themselves.",
      step: "Don't sign up for credit-check links from a landlord. They can enroll you in paid memberships. A real landlord runs the check after you apply." },
    { id: "pii", bad: "yes", w: 2, q: "Did they ask for your Social Security number, a photo of your ID, or pay stubs before you've seen the place?",
      flag: "They want sensitive personal information early (an FTC warning sign).",
      todo: "Hold back your SSN, ID and pay stubs until you've seen the place and decided to apply.",
      step: "Don't share your SSN, ID, or pay stubs until you've verified the owner and decided to apply." },
    { id: "pressure", bad: "yes", w: 2, q: "Are they pushing you to decide fast (\"other people want it\", \"today only\")?",
      flag: "Pressure to decide quickly. The FTC's advice: walk away.",
      todo: "Notice whether they push you to commit quickly.",
      step: "Slow down. A legitimate rental will still be there after a day of checking." },
    { id: "owner", bad: "no", w: 3, q: "Does the person you're dealing with match the owner in county property records, or a management company you verified yourself?",
      flag: "The name doesn't match the county's owner records.",
      todo: "Look up the owner in county property records (see the steps below).",
      step: "Ask the person to explain the mismatch, and contact the recorded owner directly using contact details you found yourself." },
    { id: "textonly", bad: "yes", w: 1, q: "Do they only communicate by text, email, or chat, and avoid phone or video calls?",
      flag: "They only communicate by text, email, or chat.",
      todo: "Ask for a phone call.",
      step: "Ask for a phone call and a full name. Search the name and phone number online." },
    { id: "seen", bad: "no", w: 1, q: "Have you, or someone you trust, been inside with the landlord or an agent?",
      flag: "No one you trust has been inside with the landlord or an agent yet.",
      todo: "Plan an in-person visit.",
      step: "Visit in person before paying. Check that the person showing it has keys and that neighbors or building staff recognize them." },
    { id: "platform", bad: "yes", w: 1, context: true, q: "Did you find it on Facebook (Marketplace or a group) or Craigslist?",
      flag: "Found on Facebook or Craigslist. That's not a red flag by itself, but these are where most reported rental scams start, according to the FTC.",
      todo: "", step: "" }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var form = $("rc");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildQuestions() {
    var h = "";
    Q.forEach(function (q, i) {
      var name = "q_" + q.id;
      h += '<div class="q" role="radiogroup" aria-labelledby="' + name + '_t">';
      h += '<p class="qt" id="' + name + '_t">' + (i + 1) + ". " + esc(q.q) + "</p>";
      h += '<div class="seg">';
      [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]].forEach(function (o) {
        h += '<label><input type="radio" name="' + name + '" value="' + o[0] + '"><span>' + o[1] + "</span></label>";
      });
      h += "</div></div>";
    });
    $("questions").innerHTML = h;
  }

  function answers() {
    var a = {};
    Q.forEach(function (q) {
      var el = form.querySelector('input[name="q_' + q.id + '"]:checked');
      a[q.id] = el ? el.value : "";
    });
    return a;
  }

  function priceInfo() {
    var rent = parseFloat($("rent").value), typ = parseFloat($("typical").value);
    if (!(rent > 0) || !(typ > 0)) return null;
    var below = Math.round((1 - rent / typ) * 100);
    var w = below >= 30 ? 3 : below >= 15 ? 2 : 0;
    return { rent: rent, typ: typ, below: below, w: w };
  }

  function evaluate(a, price) {
    var score = 0, crit = false, flags = [], todos = [], steps = [], answered = 0;
    if (price) {
      if (price.w > 0) {
        score += price.w;
        flags.push("Rent is about " + price.below + "% below similar places. The FTC lists much-cheaper-than-usual rent as a warning sign.");
        steps.push("Ask why the rent is so low, and compare a few more similar listings nearby.");
      }
    } else {
      todos.push("Compare the rent with at least five similar listings nearby.");
    }
    Q.forEach(function (q) {
      var v = a[q.id];
      if (v) answered++;
      if (v === q.bad) {
        score += q.w;
        if (q.crit) crit = true;
        flags.push(q.flag);
        if (q.step) steps.push(q.step);
      } else if (v === "unsure" && q.todo) {
        todos.push(q.todo);
      } else if (!v && q.todo && !q.context) {
        todos.push(q.todo);
      }
    });
    if (a.seen === "yes" && a.owner === "yes" && score > 0) score = Math.max(0, score - 1);
    var level;
    if (score >= 10) level = "veryhigh";
    else if (score >= 6) level = "high";
    else if (score >= 3) level = "moderate";
    else level = "low";
    if (crit && (level === "low" || level === "moderate")) level = "high";
    if (a.pay === "yes" && (a.upfront === "yes" || a.noshow === "yes" || a.away === "yes")) level = "veryhigh";
    return { score: score, level: level, flags: flags, todos: todos, steps: steps, answered: answered };
  }

  var LEVELS = {
    low: { label: "Low risk so far", pct: 15, text: "No major red flags from your answers. Keep verifying: see the owner records and visit in person before paying anything." },
    moderate: { label: "Moderate risk", pct: 45, text: "Some warning signs. Don't pay or share personal information until you've checked the items below." },
    high: { label: "High risk", pct: 75, text: "Several serious warning signs. Don't send money. Verify the owner and see the place in person first, or walk away." },
    veryhigh: { label: "Very high risk", pct: 100, text: "This matches common rental-scam patterns. We strongly suggest you don't pay. If you've already paid, see the steps below right away." }
  };

  function render() {
    var a = answers(), price = priceInfo(), r = evaluate(a, price);
    var L = LEVELS[r.level];
    var none = r.answered === 0 && !price;
    $("risk").className = "risk " + (none ? "" : r.level);
    $("level").textContent = none ? "Answer the questions above" : L.label;
    $("meter").style.width = none ? "0" : L.pct + "%";
    $("level-text").textContent = none ? "Your summary updates as you answer." : L.text + " (" + r.answered + " of " + Q.length + " questions answered.)";
    $("price-note").textContent = price ? (price.below > 0 ? "About " + price.below + "% below typical." : "At or above typical rent.") : "";

    $("flags").innerHTML = r.flags.length ? r.flags.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") : "<li>None from your answers so far.</li>";
    $("todos").innerHTML = r.todos.length ? r.todos.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") : "<li>Nothing left on the list.</li>";

    var steps = r.steps.slice();
    steps.push("Look up the owner in county property records and reverse-search the photos (steps below).");
    if (r.level === "high" || r.level === "veryhigh") {
      steps.push("Report the listing to the site or app where you found it.");
    }
    steps.push("Already paid? Contact your bank or payment app right away and ask them to stop or reverse the payment, then report it at ReportFraud.ftc.gov (and ic3.gov if it happened online).");
    $("steps").innerHTML = steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    return { r: r, L: L, steps: steps, price: price };
  }

  function summaryText() {
    var x = render();
    var lines = ["Rental listing check (zexley.com/rental-check)", "Result: " + x.L.label, ""];
    if (x.price) lines.push("Rent $" + x.price.rent + " vs typical $" + x.price.typ + " (" + (x.price.below > 0 ? x.price.below + "% below" : "not below typical") + ")", "");
    lines.push("Red flags:");
    (x.r.flags.length ? x.r.flags : ["None so far"]).forEach(function (f) { lines.push("- " + f); });
    lines.push("", "Still to check:");
    (x.r.todos.length ? x.r.todos : ["Nothing"]).forEach(function (f) { lines.push("- " + f); });
    lines.push("", "Next steps:");
    x.steps.forEach(function (s, i) { lines.push((i + 1) + ". " + s); });
    lines.push("", "This result is based only on your answers. It is not a finding or accusation about any landlord, property manager, or listing. Public records may be outdated or incomplete; confirm with the official source. Not legal advice. If you suspect fraud, contact the platform, your bank, and the authorities. See zexley.com/terms");
    return lines.join("\n");
  }

  function copyText(text, statusEl) {
    function done(ok) { statusEl.textContent = ok ? "Copied." : "Couldn't copy automatically. Select the text and copy it."; setTimeout(function () { statusEl.textContent = ""; }, 3000); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done(ok);
    }
  }

  function countyLink() {
    var c = $("county").value.trim(), s = $("state").value.trim(), a = $("county-link");
    if (!c) { a.href = "#"; a.setAttribute("aria-disabled", "true"); return; }
    a.removeAttribute("aria-disabled");
    var q = c.replace(/\s+county$/i, "") + " County " + s + " assessor property search";
    a.href = "https://duckduckgo.com/?q=" + encodeURIComponent(q.replace(/\s+/g, " ").trim());
  }

  buildQuestions();
  form.addEventListener("change", render);
  form.addEventListener("input", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); render(); $("out").scrollIntoView({ behavior: "smooth", block: "start" }); });
  form.addEventListener("reset", function () { setTimeout(render, 0); });
  $("copy").addEventListener("click", function () { copyText(summaryText(), $("copy-status")); });
  $("print").addEventListener("click", function () { window.print(); });
  $("county").addEventListener("input", countyLink);
  $("state").addEventListener("input", countyLink);
  $("county-link").addEventListener("click", function (e) { if (this.getAttribute("aria-disabled") === "true") { e.preventDefault(); $("county").focus(); } });
  var body = "I'd like to hear when the $49 rental check opens.\n\nCity or county of the listing (optional):\n";
  $("early-list").href = "mailto:neo@zexley.com?subject=" + encodeURIComponent("Early list: Rental check ($49)") + "&body=" + encodeURIComponent(body);
  render();

  // Exposed for automated tests only.
  window.__zexleyRental = { evaluate: evaluate, Q: Q, summaryText: summaryText };
})();
