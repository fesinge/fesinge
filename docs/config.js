/* =====================================================================
   CONFIGURAZIONE DELLO STORE  —  modifica SOLO questo file
   =====================================================================
   Qui dentro c'è tutto quello che ti serve cambiare per andare online.
   Non serve toccare il codice: cambia testi, prezzi e link e basta.
   ===================================================================== */

window.STORE = {
  /* --- Identità del brand --------------------------------------- */
  brand: {
    name: "fesinge",
    tagline: "Design digitale che lavora per te, anche offline.",
    // Email dove ricevere i messaggi del modulo contatti / newsletter.
    // Lascia "" se non vuoi mostrare il modulo.
    email: "federica.francof@gmail.com",
    // Link ai tuoi social (lascia "" per nascondere l'icona)
    social: {
      instagram: "",
      behance: "",
      dribbble: "",
      linkedin: "",
    },
  },

  /* --- I tuoi prodotti digitali --------------------------------- *
   * Ogni prodotto vende da solo: il cliente clicca "Acquista",
   * paga su Stripe, e riceve il file automaticamente. Tu sei offline.
   *
   * COME CREARE IL LINK DI PAGAMENTO (una volta sola, gratis):
   *  1. Crea un account su https://stripe.com
   *  2. Vai su "Payment Links" → "New" → carica il file / imposta prezzo
   *  3. Attiva la "consegna automatica del file dopo il pagamento"
   *  4. Copia il link e incollalo qui sotto in "buyUrl"
   *
   * Finché "buyUrl" è "" il bottone mostra "Presto disponibile".
   * ------------------------------------------------------------- */
  products: [
    {
      id: "ui-kit-aurora",
      name: "Aurora UI Kit",
      description: "120+ componenti pronti per Figma. Design system completo, dark & light.",
      price: "€39",
      badge: "Best seller",
      emoji: "🎨",
      buyUrl: "", // ← incolla qui il tuo Stripe Payment Link
    },
    {
      id: "landing-templates",
      name: "10 Landing Page Templates",
      description: "Template moderni e responsive in HTML/Figma. Lanci un sito in un'ora.",
      price: "€29",
      badge: "",
      emoji: "🚀",
      buyUrl: "",
    },
    {
      id: "icon-pack",
      name: "Minimal Icon Pack",
      description: "300 icone vettoriali (SVG) coerenti, perfette per app e siti.",
      price: "€19",
      badge: "",
      emoji: "✨",
      buyUrl: "",
    },
    {
      id: "ux-ebook",
      name: "E-book: UX che converte",
      description: "Guida pratica in PDF: i principi di design che fanno vendere.",
      price: "€15",
      badge: "Novità",
      emoji: "📘",
      buyUrl: "",
    },
  ],

  /* --- Newsletter ----------------------------------------------- *
   * Per raccogliere email (lead = vendite future automatiche).
   * Incolla l'URL del form da un servizio gratuito come
   * Mailchimp / Buttondown / Substack. Lascia "" per nasconderlo.
   * ------------------------------------------------------------- */
  newsletterActionUrl: "",

  /* --- Pubblicità (opzionale) ----------------------------------- *
   * Quando avrai traffico potrai monetizzare anche con le ads.
   * Incolla qui lo snippet (es. Google AdSense). Lascia "" per nasconderlo.
   * ------------------------------------------------------------- */
  adSlotHtml: "",
};
