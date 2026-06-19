# 💸 Il tuo store che monetizza offline

Questo repo contiene un **sito-store statico** pronto a vendere i tuoi prodotti
digitali (UI kit, template, e-book…) **in automatico, anche mentre sei offline**.

Il segreto è semplice:

- Il sito è **statico** → non c'è nessun server da accendere o mantenere.
- I pagamenti li gestisce **Stripe** → incassa e **consegna il file da solo**.
- Lo pubblichi **gratis su GitHub Pages** → online 24/7.

Tu lo prepari una volta. Poi vende da solo.

---

## 🗂️ Cosa c'è dentro

```
docs/
 ├── index.html   → la pagina dello store (non serve toccarla)
 ├── styles.css   → la grafica (non serve toccarla)
 ├── app.js       → la logica (non serve toccarla)
 └── config.js    → ⭐ QUI cambi testi, prodotti, prezzi e link
```

👉 **Devi modificare solo `docs/config.js`.**

---

## 🚀 Andare online in 3 passi

### 1) Attiva GitHub Pages (una volta sola)
1. Vai su questo repo su GitHub → **Settings** → **Pages**
2. In *"Build and deployment"* scegli:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` · cartella **`/docs`** → **Save**
3. Dopo ~1 minuto il sito è online all'indirizzo:
   `https://fesinge.github.io/fesinge/`

> Nota: ora il sito è sul branch `claude/offline-monetization-jnaj7g`.
> Quando sei pronta, fai il merge in `main` (o cambia il branch in Settings → Pages).

### 2) Crea i link di pagamento su Stripe (gratis)
1. Registrati su **https://stripe.com**
2. Vai su **Payment Links → New**
3. Crea il prodotto, imposta il **prezzo** e **carica il file** da vendere
4. Attiva la **consegna automatica del file dopo il pagamento**
   *(Stripe → impostazioni prodotto → "Deliver a digital product / file")*
5. Copia il link generato (tipo `https://buy.stripe.com/xxxx`)

### 3) Incolla tutto in `config.js`
Apri `docs/config.js` e per ogni prodotto compila `buyUrl` con il link Stripe:

```js
{
  name: "Aurora UI Kit",
  price: "€39",
  buyUrl: "https://buy.stripe.com/xxxx",  // ← qui
}
```

Salva, fai commit/push → il sito si aggiorna da solo. **Fatto.** 🎉

---

## 🧩 Le 3 fonti di guadagno (già predisposte)

| Fonte | Dove si attiva | Stato |
|-------|----------------|-------|
| 🛍️ **Vendita prodotti digitali** | `products[].buyUrl` (Stripe) | da collegare |
| 💌 **Newsletter** (vendite future) | `newsletterActionUrl` (Mailchimp/Substack) | opzionale |
| 📣 **Pubblicità** | `adSlotHtml` (es. Google AdSense) | opzionale, quando hai traffico |

Finché un `buyUrl` è vuoto, il bottone mostra **"Presto"** — così puoi
pubblicare il sito anche prima di aver finito i prodotti.

---

## 👀 Vederlo in anteprima sul tuo PC
Apri semplicemente `docs/index.html` nel browser (doppio clic).
Oppure, per un'anteprima più fedele:

```bash
cd docs
python3 -m http.server 8000
# poi apri http://localhost:8000
```

---

## ✅ Checklist primo lancio
- [ ] Ho creato almeno 1 prodotto digitale (anche piccolo!)
- [ ] Ho creato il Payment Link su Stripe con consegna automatica
- [ ] Ho incollato il link in `config.js`
- [ ] Ho attivato GitHub Pages
- [ ] Ho condiviso il link dello store sui social

Da qui in poi: ogni vendita arriva **mentre fai altro**. 🌙
