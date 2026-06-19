# 📈 Portafoglio — ETF · Azioni · Crypto

Tracker di investimenti **multi-asset** che funziona interamente nel browser.
Niente account, niente backend, niente cloud: i tuoi dati restano **solo nel tuo
dispositivo** (localStorage). Pensato per essere la cosa più utile e logica nel
2026: un'unica vista su ETF, azioni e crypto, con prezzi crypto live, simulatore
di PAC e suggerimenti di ribilanciamento.

> ⚠️ Strumento **educativo**. Non è consulenza finanziaria.

## ✨ Funzionalità

- **Dashboard** — valore totale, plus/minusvalenza, allocazione per classe
  (grafico a ciambella) e top posizioni.
- **Posizioni** — aggiungi/rimuovi ETF, azioni, crypto, obbligazioni e
  liquidità con quantità, prezzo di carico e prezzo attuale.
- **Prezzi crypto live** — aggiornamento automatico via API pubblica
  [CoinGecko](https://www.coingecko.com/) (basta inserire l'ID della moneta,
  es. `bitcoin`, `ethereum`, `solana`).
- **Ribilanciamento** — imposti le percentuali obiettivo per ogni classe e
  l'app ti dice quanto comprare/vendere per raggiungerle.
- **Simulatore PAC** — interesse composto con versamenti mensili, rendimento
  atteso e correzione per l'inflazione (valore reale).
- **Import / Export** — backup e ripristino del portafoglio in formato JSON.
- **Privacy-first** — nessun dato lascia il browser.

## 🚀 Come si usa

È un sito statico: nessuna installazione, nessun build.

1. Apri `index.html` nel browser (doppio click), **oppure**
2. Servilo localmente per far funzionare i prezzi crypto senza problemi CORS:

   ```bash
   python3 -m http.server 8000
   # poi vai su http://localhost:8000
   ```

Premi **Esempio** nella scheda *Posizioni* per caricare un portafoglio demo.

## 🧱 Stack

HTML + CSS + JavaScript vanilla. Unica dipendenza esterna:
[Chart.js](https://www.chartjs.org/) via CDN per i grafici.

```
index.html   → struttura e viste
styles.css   → tema scuro, layout responsive
app.js       → stato, calcoli, grafici, fetch prezzi
```

## 🔒 Note

- I prezzi crypto richiedono connessione a CoinGecko; se non disponibile, l'app
  resta utilizzabile usando i prezzi inseriti manualmente.
- I dati sono salvati in `localStorage`: cancellando i dati del sito li perdi
  (usa **Esporta** per il backup).
