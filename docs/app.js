/* =====================================================================
   app.js — logica dello store. Normalmente NON serve toccarlo:
   tutto si controlla da config.js.
   ===================================================================== */
(function () {
  "use strict";

  var S = window.STORE || {};

  /* ---- Identità del brand ---- */
  if (S.brand) {
    document.querySelectorAll("[data-brand-name]").forEach(function (el) {
      el.textContent = S.brand.name || el.textContent;
    });
    var tagline = document.querySelector("[data-brand-tagline]");
    if (tagline && S.brand.tagline) tagline.textContent = S.brand.tagline;
    document.title = (S.brand.name || "Store") + " — Design digitale";
  }

  /* ---- Barra sconto di lancio ---- */
  var promoBar = document.getElementById("promo-bar");
  if (promoBar && S.promo && S.promo.show) {
    var codeHtml = S.promo.code
      ? ' <strong class="promo__code">' + esc(S.promo.code) + "</strong>"
      : "";
    promoBar.innerHTML = esc(S.promo.text || "") + codeHtml;
    promoBar.hidden = false;
  }

  /* ---- Prodotti ---- */
  var grid = document.getElementById("product-grid");
  if (grid && Array.isArray(S.products)) {
    grid.innerHTML = S.products.map(renderProduct).join("");
  }

  function renderProduct(p) {
    var hasLink = p.buyUrl && p.buyUrl.trim() !== "";
    var badge = p.badge ? '<span class="card__badge">' + esc(p.badge) + "</span>" : "";
    var btn = hasLink
      ? '<a class="btn btn--small" href="' + esc(p.buyUrl) + '" target="_blank" rel="noopener" ' +
        'aria-label="Acquista ' + esc(p.name) + '">Acquista</a>'
      : '<span class="btn btn--small btn--disabled" title="Aggiungi il link Stripe in config.js">Presto</span>';

    return (
      '<article class="card">' +
        badge +
        '<div class="card__emoji">' + esc(p.emoji || "📦") + "</div>" +
        '<h3 class="card__name">' + esc(p.name || "") + "</h3>" +
        '<p class="card__desc">' + esc(p.description || "") + "</p>" +
        '<div class="card__foot">' +
          '<span class="card__price">' + esc(p.price || "") + "</span>" +
          btn +
        "</div>" +
      "</article>"
    );
  }

  /* ---- Newsletter ---- */
  var nlCard = document.getElementById("newsletter-card");
  var nlForm = document.getElementById("newsletter-form");
  if (nlForm) {
    if (S.newsletterActionUrl) {
      nlForm.setAttribute("action", S.newsletterActionUrl);
    } else if (S.brand && S.brand.email) {
      // Fallback senza servizio esterno: apre l'email del cliente verso di te.
      nlForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = nlForm.querySelector("input[name=email]").value;
        window.location.href =
          "mailto:" + S.brand.email +
          "?subject=" + encodeURIComponent("Iscrizione newsletter") +
          "&body=" + encodeURIComponent("Iscrivimi con questa email: " + email);
      });
    } else if (nlCard) {
      nlCard.style.display = "none";
    }
  }

  /* ---- Slot pubblicità ---- */
  var ad = document.getElementById("ad-slot");
  if (ad && S.adSlotHtml && S.adSlotHtml.trim() !== "") {
    ad.innerHTML = S.adSlotHtml;
    ad.hidden = false;
  }

  /* ---- Social nel footer ---- */
  var social = document.getElementById("footer-social");
  if (social && S.brand && S.brand.social) {
    var labels = { instagram: "Instagram", behance: "Behance", dribbble: "Dribbble", linkedin: "LinkedIn" };
    var html = "";
    Object.keys(labels).forEach(function (k) {
      var url = S.brand.social[k];
      if (url) html += '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + labels[k] + "</a>";
    });
    social.innerHTML = html;
  }

  /* ---- Anno corrente ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- util ---- */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
