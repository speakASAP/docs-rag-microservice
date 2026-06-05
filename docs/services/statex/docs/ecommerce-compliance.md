# E-commerce compliance (Povinný standard pro e-commerce)

StateX website (alfares.cz) adherence to Czech e-commerce mandatory rules (Povinný standard pro e-commerce).

---

## 1. Popis nabízených produktů / Product & service descriptions

**Rule:** Web musí obsahovat popis nabízeného zboží a/nebo služeb.

**Status:** ✅ Compliant

- Services described at `/services` and per-service pages (e.g. `/services/ai-automation`, `/services/web-development`, …).
- Content: `statex-website/frontend/src/constants/services.ts`, `statex-website/frontend/src/content/pages/*/services/*.md`.
- Terms of Service also describe offerings.

---

## 2. Kontaktní informace / Contact information

**Rule:** Kontaktní informace zřetelně na webu:

- právní název obchodníka a jeho identifikační číslo
- obchodní adresa (zobrazená adresa se musí shodovat s fyzickou adresou společnosti obchodníka)
- telefonní/mobilní číslo nebo e-mailová adresa

**Status:** ✅ Compliant

- **Právní název:** `COMPANY_LEGAL_NAME` (Alfares s.r.o.) in footer and `/legal/kontaktni-informace` (CS).
- **IČ / DIČ:** `COMPANY_ICO`, `COMPANY_DIC` in footer; from `NEXT_PUBLIC_COMPANY_ICO`, `NEXT_PUBLIC_COMPANY_DIC` in `.env`.
- **Adresa:** `COMPANY_ADDRESS` in footer and contact/legal pages; matches physical address (Obchodní podmínky).
- **Telefon / e-mail:** `COMPANY_PHONE`, `CONTACT_EMAIL` in footer and contact pages.

Config: `statex-website/frontend/src/config/env.ts`. Footer: `statex-website/frontend/src/components/sections/FooterSection.tsx`. Contact info page: `statex-website/frontend/src/content/pages/cs/legal/kontaktni-informace.md`.

---

## 3. Všeobecné obchodní podmínky (VOP) / Terms and conditions

**Rule:** Obchodní podmínky (OP) musí být volně přístupné na webu a musí obsahovat:

1. právní název prodávajícího a jeho identifikační číslo
2. dodací podmínky
3. storno podmínky
4. podmínky vrácení peněz
5. řešení sporů
6. Zásady ochrany osobních údajů / GDPR

Poznámka: Dokumenty uvedené v bodech 2.–6. mohou být uvedeny samostatně, mimo OP.

**Status:** ✅ Compliant

- **OP document:** `statex-website/frontend/src/content/pages/cs/legal/obchodni-podminky.md`.
  - Identifikace prodávajícího (Alfares s.r.o., IČ, DIČ, adresa).
  - Odkazy na dodací podmínky (Terms of Service), storno/vrácení (Refund Policy), řešení sporů (v OP), GDPR (Privacy Policy, GDPR Compliance).
- **Access:** Footer „Podmínky použití“ / „Terms of Service“ → for CS `obchodni-podminky` via SlugMapper. Legal links use `getLocalizedUrlWithFallback` + `SlugMapper`.
- **Related pages:** `/legal/terms-of-service`, `/legal/refund-policy`, `/legal/privacy-policy`, `/legal/gdpr-compliance`, `/legal/cookie-policy`, `/legal/legal-disclaimers`, `/legal/legal-addendum`.

---

## 4. Registrace domény / Domain registration

**Rule:** Obchodník by měl být registrovaným vlastníkem domény. Výjimky: mateřská společnost, pobočka ve skupině s kontrolním podílem (>50%), 100 % vlastník (fyzická osoba), nebo dohoda/souhlas registrovaného vlastníka (písemná forma, platnost min. 1 rok nebo neomezeně).

**Prokázání vlastnictví:** výpis z registru (CZ: <https://www.nic.cz/whois/>/>), faktura od registrátora, nebo snímek z portálu registrátora (ne starší než 1 měsíc).

**Status:** ⚠️ Operativní (mimo kód)

- Domain alfares.cz: vlastnictví je třeba prokázat při auditu (whois/faktura/screenshot). Žádné změny v codebase.

---

## 5. Specifické kategorie / Specific categories

**Rule:** Pro online prodej alkoholu, tabáku, e-cigaret, doutníků a výrobků vyžadujících kontrolu věku: doložit ověření věku, licence, omezení dodávek do zemí kde jsou produkty nezákonné. Tabák: písemné stanovisko právního poradce / akreditace, registrace Mastercard. Online lékárny: omezení jurisdikcí, OP s kontrolami dodání pouze pacientům, léky na předpis pouze na předpis. Online gambling: specifická due diligence.

**Na CBD produkty (oleje atd.) platební bránu neposkytujeme.**

**Status:** ✅ N/A pro alfares.cz

- alfares.cz neprodává alkohol, tabák, e-cigarety, CBD oleje, léky ani gambling. Služby: AI automatizace, vývoj softwaru, digitální transformace, konzultace. Žádná implementace v codebase.

---

## 6. E-com název lokace / E-shop URL (G Form)

**Rule:** Název lokace (součást G Formu) musí uvádět URL, na které je e-com umístěn.

**Status:** ✅ Compliant

- Footer bottom: „E-shop: {BASE_URL}“ (nebo lokalizovaný ekvivalent) when `t.bottom.ecomUrl` is set (`FooterSection.tsx`). Translations: `statex-website/frontend/src/lib/translations/footer.ts` (ecomUrl for en, cs, de, fr, ar).
- `BASE_URL` from `NEXT_PUBLIC_BASE_URL` / `DOMAIN` (e.g. `https://alfares.cz`).

---

## Implementation notes

- **Env:** `NEXT_PUBLIC_COMPANY_LEGAL_NAME`, `NEXT_PUBLIC_COMPANY_ICO`, `NEXT_PUBLIC_COMPANY_DIC`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_COMPANY_PHONE`, `CONTACT_EMAIL`, `NEXT_PUBLIC_BASE_URL`. See `.env.example`.
- **Localization:** `getLocalizedUrlWithFallback` + `SlugMapper` ensure legal/services/solutions URLs use native slugs (e.g. `/cs/legal/obchodni-podminky` for Terms/OP).
- **Legal page content by locale:** Legal pages (terms-of-service, cookie-policy, privacy-policy, legal-disclaimers, legal-addendum) are stored with **English filenames** per locale (e.g. `cs/legal/terms-of-service.md`, `de/legal/privacy-policy.md`). For non-English locales, the body must exceed ~1500 characters in the locale language; otherwise the ContentLoader falls back to the English body. Full translations are in place for **cs**, **de**, and **fr**. For **ar**, the same five files under `ar/legal/` should be translated to Arabic to avoid showing English body on `/ar/legal/...` URLs.
- **Trailing spaces:** Disallowed (project rule).
