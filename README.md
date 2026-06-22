# 📈 Portafoglio — ETF · Azioni · Crypto

Tracker di investimenti **multi-asset** che funziona interamente nel browser.
Niente account, niente backend, niente cloud: i tuoi dati restano **solo nel tuo
dispositivo** (localStorage). Un'unica vista su ETF, azioni e crypto, con prezzi
live, storico del valore, simulatore di PAC e suggerimenti di ribilanciamento.
Installabile come **app** (PWA) e utilizzabile **offline**.

> ⚠️ Strumento **educativo**. Non è consulenza finanziaria.

## ✨ Funzionalità

- **Dashboard** — valore totale, plus/minusvalenza, allocazione per classe
  (grafico a ciambella) e top posizioni.
- **Storico del valore** — ogni giorno che apri l'app salva un'istantanea del
  valore totale e la mostra in un grafico nel tempo.
- **Posizioni** — aggiungi/rimuovi ETF, azioni, crypto, obbligazioni e
  liquidità con quantità, prezzo di carico e prezzo attuale.
- **Prezzi live con ricerca** — scegli la classe, scrivi il nome (es. *Apple*,
  *Bitcoin*, *VWCE*) e seleziona il risultato dal menù a tendina: il simbolo per
  il prezzo live viene compilato automaticamente, non devi conoscere ticker o ID.
  - **Crypto** via [CoinGecko](https://www.coingecko.com/) — ricerca completa,
    prezzo in EUR.
  - **Azioni / ETF** via [Stooq](https://stooq.com/) — i titoli/ETF più comuni
    sono in un catalogo integrato; per gli altri c'è il campo *simbolo manuale*.
    Il prezzo è nella valuta della borsa, quindi per gli ETF il catalogo usa le
    quotazioni in EUR dove possibile.
  - Una volta aggiunta la posizione, **i prezzi si aggiornano da soli** ad ogni
    apertura dell'app: non vanno inseriti né aggiornati a mano.
- **Conversione valute automatica** — le posizioni in USD, GBP, CHF, JPY sono
  convertite in EUR con i tassi BCE live ([Frankfurter](https://www.frankfurter.app/)),
  così totali e rendimenti sono corretti anche con strumenti su borse estere.
- **Analisi** — scheda dedicata con:
  - **Rendimento**: CAGR (annualizzato), max drawdown e volatilità dallo storico.
  - **Fisco 🇮🇹 (stima)**: imposta sul capital gain (26%), bollo titoli (0,2%) e
    compensazione delle minusvalenze pregresse. Stima educativa, non fiscale.
  - **Consigli & avvisi**: concentrazione su singolo titolo, esposizione crypto,
    fondo d'emergenza/liquidità, scostamento dai target, costi (TER).
- **Ribilanciamento** — imposti le percentuali obiettivo per ogni classe e
  l'app ti dice quanto comprare/vendere per raggiungerle.
- **Simulatore PAC** — interesse composto con versamenti mensili, rendimento
  atteso e correzione per l'inflazione (valore reale).
- **Obiettivi & FIRE** — stima quando raggiungi una cifra obiettivo e calcola il
  tuo "numero FIRE" (capitale per l'indipendenza finanziaria) dato il tasso di
  prelievo sicuro e la spesa annua desiderata.
- **Import / Export** — backup e ripristino di posizioni, obiettivi e storico
  in formato JSON.
- **PWA** — installabile su desktop e mobile, con cache offline dell'app.
- **Privacy-first** — nessun dato lascia il browser.

## 🚀 Come si usa

È un sito statico: nessuna installazione, nessun build. Per far funzionare
prezzi live, service worker e installazione PWA serve servirlo via HTTP:

```bash
python3 -m http.server 8000
# poi vai su http://localhost:8000
```

In alternativa apri direttamente `index.html` (i prezzi live potrebbero essere
bloccati dalle regole CORS del browser; i prezzi inseriti a mano funzionano
sempre).

Premi **Esempio** nella scheda *Posizioni* per caricare un portafoglio demo.
Quando il browser lo consente, compare il pulsante **⬇ Installa** in alto.

## 🧱 Stack

HTML + CSS + JavaScript vanilla. Unica dipendenza esterna:
[Chart.js](https://www.chartjs.org/) via CDN per i grafici.

```
index.html     → struttura e viste
styles.css     → tema scuro, layout responsive
app.js         → stato, calcoli, grafici, prezzi live, storico, PWA
manifest.json  → metadati PWA
sw.js          → service worker (cache offline dell'app shell)
icon.svg       → icona dell'app
```

## 🔒 Note

- I prezzi live richiedono connessione a CoinGecko/Stooq. Se l'API è
  irraggiungibile o bloccata da CORS, l'app resta utilizzabile con i prezzi
  inseriti manualmente (lo stato in alto mostra *prezzi offline*).
- **Valute**: Stooq restituisce il prezzo nella valuta della borsa. L'app non
  converte: per coerenza in EUR usa simboli quotati in EUR.
- I dati sono salvati in `localStorage`: cancellando i dati del sito li perdi
  (usa **Esporta** per il backup).
- Lo storico è giornaliero e si costruisce nel tempo: il primo grafico significativo
  appare dopo almeno due giorni di utilizzo (o importando un backup con storico).
