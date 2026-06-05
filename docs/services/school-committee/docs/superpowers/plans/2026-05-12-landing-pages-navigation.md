# Landing Pages & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 public landing-style pages (QR platby, Dobrovolnictví, Transparentnost, GDPR), fix navigation (logo link, chips as links), add footer with all links, school events block, and enhance dashboard/task/report pages.

**Architecture:** All new public pages live in `app/(public)/` as standalone landing-style pages (same visual style as `LandingPage.tsx` — white bg, blue gradient hero, rounded-2xl cards, Tailwind). Authenticated pages at `app/(app)/` get enhanced with assignee data and richer task status. School events are scraped server-side via a new API route. The `LandingPage.tsx` nav title becomes a link, chips become anchor links, and the footer gains all 4 page links.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Prisma, existing auth pattern (`getCurrentUser`), Czech (cs) as primary language with EN fallback using the same `T = { cs, en }` pattern already in `LandingPage.tsx`.

---

## File Map

| Action | File |
|--------|------|
| Modify | `app/(landing)/LandingPage.tsx` — nav logo→link, chips→links, how-it-works step links, money/time card buttons, task example cards→links, footer with 4 links + GDPR |
| Create | `app/(public)/prispevky/page.tsx` — public QR payments landing page |
| Create | `app/(public)/ukoly/page.tsx` — public volunteering tasks landing page |
| Create | `app/(public)/transparentnost/page.tsx` — public transparency report landing page |
| Create | `app/(public)/gdpr/page.tsx` — GDPR info landing page |
| Modify | `app/(app)/tasks/page.tsx` — show assignee name per task |
| Modify | `app/(app)/tasks/[id]/page.tsx` — show assignee, startedAt, finishedAt |
| Modify | `app/(app)/dashboard/page.tsx` — show task assignment block with who's on what |
| Modify | `app/(public)/report/page.tsx` — show completed tasks with who/when |
| Modify | `app/api/tasks/route.ts` — expose assignee first name (not full PII) |
| Modify | `app/api/tasks/[id]/route.ts` — expose assignee first name, startedAt, finishedAt |
| Modify | `app/api/public/report/route.ts` — include completed tasks list with actor name |
| Create | `app/api/public/school-events/route.ts` — scrape zsstrilky.cz upcoming events |
| Modify | `lib/db/tasks.ts` — update listTasks/getTask to include assignee profile join |

---

## Task 1: Fix LandingPage navigation — logo link + chip links + footer

**Files:**
- Modify: `app/(landing)/LandingPage.tsx`

- [ ] **Step 1: Replace nav title span with a link**

In `LandingPage.tsx` line 308, replace:
```tsx
<span className="text-lg font-bold text-blue-700">{t.navTitle}</span>
```
with:
```tsx
<a href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 transition-colors">{t.navTitle}</a>
```

- [ ] **Step 2: Update chip translations to include hrefs**

Replace the `T` chip fields (lines 16–19 and 88–91) so each chip has a label and href. Replace the chip1–chip4 string values with objects in both `cs` and `en`:

```ts
// cs
chips: [
  { label: "💳 QR platby", href: "/prispevky" },
  { label: "🕐 Dobrovolnictví", href: "/ukoly" },
  { label: "📊 Transparentnost", href: "/transparentnost" },
  { label: "🔒 Bezpečně", href: "/gdpr" },
],
// en
chips: [
  { label: "💳 QR Payments", href: "/prispevky" },
  { label: "🕐 Volunteering", href: "/ukoly" },
  { label: "📊 Transparency", href: "/transparentnost" },
  { label: "🔒 Secure", href: "/gdpr" },
],
```

Remove `chip1`, `chip2`, `chip3`, `chip4` from both `cs` and `en` objects.

- [ ] **Step 3: Replace chip span elements with anchor tags**

In the hero section (around line 334), replace:
```tsx
{[t.chip1, t.chip2, t.chip3, t.chip4].map((c) => (
  <span
    key={c}
    className="bg-white text-gray-700 border border-gray-200 rounded-full px-4 py-1 text-sm font-medium shadow-sm"
  >
    {c}
  </span>
))}
```
with:
```tsx
{t.chips.map((c) => (
  <a
    key={c.href}
    href={c.href}
    className="bg-white text-gray-700 border border-gray-200 rounded-full px-4 py-1 text-sm font-medium shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
  >
    {c.label}
  </a>
))}
```

- [ ] **Step 4: Add links to "Jak to funguje" steps**

The 3 steps (lines 357–369) should link: step 1 → `/login`, step 2 → `/ukoly`, step 3 → `/transparentnost`. Replace the step array and wrap each in a link:

```tsx
{[
  { n: "1", title: t.step1Title, desc: t.step1Desc, href: "/login" },
  { n: "2", title: t.step2Title, desc: t.step2Desc, href: "/ukoly" },
  { n: "3", title: t.step3Title, desc: t.step3Desc, href: "/transparentnost" },
].map(({ n, title, desc, href }) => (
  <a key={n} href={href} className="flex flex-col items-center text-center gap-3 group hover:opacity-90 transition-opacity">
    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
      {n}
    </div>
    <h3 className="font-semibold text-gray-900">{title}</h3>
    <p className="text-gray-500 text-sm">{desc}</p>
  </a>
))}
```

- [ ] **Step 5: Add buttons to money/time contribution cards**

Add translations for the two button labels in both `cs` and `en`:
```ts
// cs
moneyBtn: "Zaplatit příspěvek",
timeBtn: "Nabídnout čas",
// en
moneyBtn: "Make a payment",
timeBtn: "Volunteer time",
```

Replace the two card `<div>` elements (lines 382–389) with:
```tsx
<a href="/prispevky" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all block">
  <h3 className="font-bold text-lg mb-2">{t.moneyTitle}</h3>
  <p className="text-gray-500 text-sm mb-4">{t.moneyDesc}</p>
  <span className="inline-block bg-blue-600 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-blue-700 transition-colors">{t.moneyBtn}</span>
</a>
<a href="/ukoly" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all block">
  <h3 className="font-bold text-lg mb-2">{t.timeTitle}</h3>
  <p className="text-gray-500 text-sm mb-4">{t.timeDesc}</p>
  <span className="inline-block bg-blue-600 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-blue-700 transition-colors">{t.timeBtn}</span>
</a>
```

- [ ] **Step 6: Make example task cards link to /ukoly#<slug>**

Add a `slug` field to each example in both `cs` and `en`:
```ts
// cs examples with slugs:
{ icon: "🎨", title: "Malování třídy", desc: "...", slug: "malovani" },
{ icon: "🔧", title: "Drobné opravy", desc: "...", slug: "opravy" },
{ icon: "🎉", title: "Organizace akcí", desc: "...", slug: "akce" },
{ icon: "📚", title: "Doučování", desc: "...", slug: "doucovani" },
{ icon: "🌳", title: "Zahradničení", desc: "...", slug: "zahradnictvi" },
{ icon: "🚗", title: "Odvoz na akce", desc: "...", slug: "odvoz" },
// en same slugs
```

Replace example card divs (line 396–406) with:
```tsx
{t.examples.map((ex) => (
  <a
    key={ex.slug}
    href={`/ukoly#${ex.slug}`}
    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1 hover:shadow-md hover:border-blue-200 transition-all"
  >
    <span className="text-2xl">{ex.icon}</span>
    <span className="font-medium text-sm text-gray-800">{ex.title}</span>
    <span className="text-xs text-gray-500">{ex.desc}</span>
  </a>
))}
```

- [ ] **Step 7: Add GDPR link to the gdpr text in form**

Add translation key in both langs:
```ts
// cs
gdprLinkText: "Zásady ochrany osobních údajů",
// en
gdprLinkText: "Privacy Policy",
```

Replace the gdpr `<p>` (line ~570) with:
```tsx
<p className="text-xs text-gray-400 text-center">
  🔒 {lang === "cs" ? "Vaše data jsou chráněna dle" : "Your data is protected under"}{" "}
  <a href="/gdpr" className="underline hover:text-gray-600">{t.gdprLinkText}</a>.{" "}
  {lang === "cs" ? "Informace nepředáváme třetím stranám." : "We do not share it with third parties."}
</p>
```

- [ ] **Step 8: Replace footer with rich footer containing all 4 page links**

Add footer translations in both langs:
```ts
// cs
footerLinks: [
  { label: "QR příspěvky", href: "/prispevky" },
  { label: "Dobrovolnictví", href: "/ukoly" },
  { label: "Transparentnost", href: "/transparentnost" },
  { label: "GDPR", href: "/gdpr" },
],
// en
footerLinks: [
  { label: "QR Payments", href: "/prispevky" },
  { label: "Volunteering", href: "/ukoly" },
  { label: "Transparency", href: "/transparentnost" },
  { label: "GDPR", href: "/gdpr" },
],
```

Replace footer (line 577–579) with:
```tsx
<footer className="mt-auto border-t border-gray-100 px-4 py-8 bg-white">
  <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
    <div className="flex flex-wrap justify-center gap-4">
      {t.footerLinks.map((l) => (
        <a key={l.href} href={l.href} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">
          {l.label}
        </a>
      ))}
    </div>
    <p className="text-xs text-gray-400">{t.footerCopy(year)}</p>
  </div>
</footer>
```

- [ ] **Step 9: Verify the page builds**
```bash
cd /home/ssf/Documents/Github/school-committee && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors (or only pre-existing unrelated ones)

---

## Task 2: Public QR Payments landing page (`/prispevky`)

**Files:**
- Create: `app/(public)/prispevky/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(public)/prispevky/page.tsx
import Link from "next/link";

export const metadata = { title: "QR příspěvky – Školní výbor" };

export default function PrispevkyPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-gray-900">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 transition-colors">Školní výbor</a>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
            Přihlásit se
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-4">💳</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            QR příspěvky školnímu výboru
          </h1>
          <p className="text-gray-600 text-lg mb-8 max-w-xl mx-auto">
            Přispějte 500 Kč ročně na chod školního výboru. Platba přes QR kód — žádné karty, žádné složité formuláře.
          </p>
          <a
            href="/login"
            className="bg-blue-600 text-white font-semibold rounded-xl px-8 py-3 text-base hover:bg-blue-700 transition-colors shadow"
          >
            Přihlásit se a zaplatit →
          </a>
        </div>
      </section>

      {/* WHY */}
      <section className="px-4 py-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Proč přispívat?</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: "🏫", title: "Podpora školy", desc: "Příspěvky financují pomůcky, akce a vybavení pro vaše děti." },
              { icon: "📊", title: "Plná transparentnost", desc: "Každá koruna je zveřejněna ve zprávě o hospodaření." },
              { icon: "⚡", title: "Jednoduché a rychlé", desc: "Naskenujte QR kód v bankovní aplikaci. Hotovo za 30 sekund." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AMOUNT */}
      <section className="px-4 py-14 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Výše příspěvku</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 inline-block min-w-[280px]">
            <p className="text-5xl font-extrabold text-blue-600 mb-2">500 Kč</p>
            <p className="text-gray-500 text-sm">za rok / za rodinu</p>
          </div>
          <p className="text-gray-500 text-sm mt-6 max-w-md mx-auto">
            Příspěvek je dobrovolný. Pokud nemůžete přispět finančně, můžete pomoci svým{" "}
            <a href="/ukoly" className="text-blue-600 underline hover:text-blue-800">časem a dobrovolnictvím</a>.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-4 py-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Jak zaplatit</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: "1", title: "Přihlaste se", desc: "Použijte svůj e-mail nebo odkaz zaslaný výborem." },
              { n: "2", title: "Vygenerujte QR kód", desc: "Systém vytvoří personalizovaný QR kód na 500 Kč s vaším variabilním symbolem." },
              { n: "3", title: "Naskenujte v aplikaci", desc: "Otevřete bankovní aplikaci (George, Smart Banka apod.) a naskenujte kód." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">{n}</div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/login" className="bg-blue-600 text-white font-semibold rounded-xl px-8 py-3 text-base hover:bg-blue-700 transition-colors shadow">
              Přihlásit se a zaplatit →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-gray-100 px-4 py-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "QR příspěvky", href: "/prispevky" },
              { label: "Dobrovolnictví", href: "/ukoly" },
              { label: "Transparentnost", href: "/transparentnost" },
              { label: "GDPR", href: "/gdpr" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">{l.label}</a>
            ))}
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Školní výbor · strilkove.cz</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**
```bash
cd /home/ssf/Documents/Github/school-committee && npx tsc --noEmit 2>&1 | grep prispevky
```
Expected: no output (no errors)

---

## Task 3: Public Volunteering/Tasks landing page (`/ukoly`)

**Files:**
- Create: `app/(public)/ukoly/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(public)/ukoly/page.tsx
export const metadata = { title: "Dobrovolnictví – Školní výbor" };

const TASKS = [
  {
    slug: "malovani",
    icon: "🎨",
    title: "Malování třídy",
    desc: "Pomoc s renovací a výmalbou prostor školy. Hledáme rodiče s citem pro barvy a ochotou pracovat o víkendu.",
    duration: "1–2 dny",
    when: "Jarní prázdniny",
    spots: 4,
  },
  {
    slug: "opravy",
    icon: "🔧",
    title: "Drobné opravy",
    desc: "Oprava nábytku, dveří, drobné elektro práce. Ideální pro šikovné ruce.",
    duration: "Průběžně",
    when: "Dle dohody",
    spots: 3,
  },
  {
    slug: "akce",
    icon: "🎉",
    title: "Organizace akcí",
    desc: "Příprava školních slavností, výletů a soutěží. Koordinace s učiteli a vedením školy.",
    duration: "3–5 hodin / akce",
    when: "Dle programu",
    spots: 6,
  },
  {
    slug: "doucovani",
    icon: "📚",
    title: "Doučování",
    desc: "Pomoc žákům s látkou ve vašem oboru. Matematika, čeština, angličtina nebo přírodní vědy.",
    duration: "1–2 hod / týden",
    when: "Školní rok",
    spots: 5,
  },
  {
    slug: "zahradnictvi",
    icon: "🌳",
    title: "Zahradničení",
    desc: "Úprava školní zahrady, výsadba záhonů a péče o zeleň kolem budovy.",
    duration: "1 den",
    when: "Jaro / podzim",
    spots: 8,
  },
  {
    slug: "odvoz",
    icon: "🚗",
    title: "Odvoz na akce",
    desc: "Přeprava dětí na soutěže a výlety vlastním vozidlem. Nutný platný řidičský průkaz.",
    duration: "Dle akce",
    when: "Dle programu",
    spots: 10,
  },
];

export default function UkolyPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-gray-900">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 transition-colors">Školní výbor</a>
        <a href="/login" className="text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
          Přihlásit se
        </a>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-4">🕐</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Dobrovolnictví pro školu
          </h1>
          <p className="text-gray-600 text-lg mb-8 max-w-xl mx-auto">
            Nemůžete přispět finančně? Nevadí. Pomozte škole svým časem a schopnostmi. Každá pomoc má velkou hodnotu.
          </p>
          <a href="/login" className="bg-blue-600 text-white font-semibold rounded-xl px-8 py-3 text-base hover:bg-blue-700 transition-colors shadow">
            Přihlásit se a přihlásit k úkolu →
          </a>
        </div>
      </section>

      {/* TASK LIST */}
      <section className="px-4 py-14 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Dostupné úkoly</h2>
          <p className="text-gray-500 text-center mb-10">
            Přihlaste se, abyste se mohli přihlásit k úkolu a viděli, kdo již pomáhá.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TASKS.map((task) => (
              <div
                key={task.slug}
                id={task.slug}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col gap-3 scroll-mt-20"
              >
                <div className="text-3xl">{task.icon}</div>
                <h3 className="font-bold text-gray-900 text-lg">{task.title}</h3>
                <p className="text-sm text-gray-500 flex-1">{task.desc}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-blue-50 text-blue-700 rounded-full px-3 py-1">⏱ {task.duration}</span>
                  <span className="bg-gray-50 text-gray-600 rounded-full px-3 py-1">📅 {task.when}</span>
                  <span className="bg-green-50 text-green-700 rounded-full px-3 py-1">👥 {task.spots} míst</span>
                </div>
                <a
                  href="/login"
                  className="mt-2 block text-center bg-blue-600 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-blue-700 transition-colors"
                >
                  Přihlásit se k úkolu
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-14 bg-gray-50 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Chcete raději přispět finančně?</h2>
          <p className="text-gray-500 text-sm mb-6">Příspěvek 500 Kč ročně pomáhá stejně jako váš čas.</p>
          <a href="/prispevky" className="inline-block bg-blue-600 text-white font-semibold rounded-xl px-8 py-3 text-base hover:bg-blue-700 transition-colors shadow">
            Zaplatit QR příspěvek →
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-gray-100 px-4 py-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "QR příspěvky", href: "/prispevky" },
              { label: "Dobrovolnictví", href: "/ukoly" },
              { label: "Transparentnost", href: "/transparentnost" },
              { label: "GDPR", href: "/gdpr" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">{l.label}</a>
            ))}
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Školní výbor · strilkove.cz</p>
        </div>
      </footer>
    </div>
  );
}
```

---

## Task 4: Public Transparency landing page (`/transparentnost`)

**Files:**
- Create: `app/(public)/transparentnost/page.tsx`

- [ ] **Step 1: Create the page — it embeds the existing report data via server fetch**

```tsx
// app/(public)/transparentnost/page.tsx
import { Suspense } from "react";

export const metadata = { title: "Transparentnost – Školní výbor" };

interface ReportData {
  totalCollectedCzk: number;
  totalSpentCzk: number;
  balanceCzk: number;
  completedTaskCount: number;
  expenses: { id: string; title: string; category: string; amountCzk: number; spentAt: string }[];
}

async function fetchReport(): Promise<ReportData | null> {
  try {
    const base = process.env.APP_BASE_URL ?? "http://localhost:4800";
    const schoolId = process.env.DEFAULT_SCHOOL_ID ?? "";
    if (!schoolId) return null;
    const res = await fetch(`${base}/api/public/report?schoolId=${schoolId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function ReportBlock() {
  const data = await fetchReport();

  if (!data) {
    return (
      <p className="text-center text-gray-400 text-sm">
        Data momentálně nejsou dostupná. Zkuste to prosím později.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Vybráno", value: `${data.totalCollectedCzk.toLocaleString("cs-CZ")} Kč`, color: "text-green-600" },
          { label: "Vydáno", value: `${data.totalSpentCzk.toLocaleString("cs-CZ")} Kč`, color: "text-red-600" },
          { label: "Zůstatek", value: `${data.balanceCzk.toLocaleString("cs-CZ")} Kč`, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 text-center shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Dokončené dobrovolnické úkoly</h3>
        <p className="text-3xl font-extrabold text-blue-600">{data.completedTaskCount}</p>
      </div>

      {data.expenses.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Výdaje</h3>
          <ul className="space-y-2">
            {data.expenses.map((e) => (
              <li key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex justify-between items-center shadow-sm">
                <span>
                  <span className="font-medium text-gray-900">{e.title}</span>
                  <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{e.category}</span>
                </span>
                <span className="text-red-600 font-semibold">{e.amountCzk.toLocaleString("cs-CZ")} Kč</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TransparentnostPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-gray-900">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 transition-colors">Školní výbor</a>
        <a href="/login" className="text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
          Přihlásit se
        </a>
      </nav>

      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-4">📊</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Transparentní hospodaření
          </h1>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Víte přesně, kolik bylo vybráno, vydáno a co za to škola získala. Žádné skryté pohyby.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Suspense fallback={<p className="text-sm text-gray-400 text-center">Načítám data…</p>}>
            <ReportBlock />
          </Suspense>
        </div>
      </section>

      <section className="px-4 py-10 bg-gray-50 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gray-500 text-sm mb-4">
            Chcete přispět? Pomůžete finančně nebo svým časem.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/prispevky" className="bg-blue-600 text-white font-semibold rounded-xl px-6 py-2.5 text-sm hover:bg-blue-700 transition-colors">
              💳 Zaplatit příspěvek
            </a>
            <a href="/ukoly" className="bg-white border border-blue-200 text-blue-700 font-semibold rounded-xl px-6 py-2.5 text-sm hover:bg-blue-50 transition-colors">
              🕐 Dobrovolničit
            </a>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-gray-100 px-4 py-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "QR příspěvky", href: "/prispevky" },
              { label: "Dobrovolnictví", href: "/ukoly" },
              { label: "Transparentnost", href: "/transparentnost" },
              { label: "GDPR", href: "/gdpr" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">{l.label}</a>
            ))}
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Školní výbor · strilkove.cz</p>
        </div>
      </footer>
    </div>
  );
}
```

---

## Task 5: Public GDPR landing page (`/gdpr`)

**Files:**
- Create: `app/(public)/gdpr/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(public)/gdpr/page.tsx
export const metadata = { title: "GDPR – Školní výbor" };

const SECTIONS = [
  {
    icon: "📋",
    title: "Jaká data sbíráme?",
    body: "Shromažďujeme pouze data nezbytná pro provoz platformy: jméno, e-mail, telefon (volitelně), jazyk a způsob zapojení. Neukládáme rodná čísla, přesná data narození ani citlivé informace o dětech.",
  },
  {
    icon: "⚖️",
    title: "Na jakém základě?",
    body: "Zpracování probíhá na základě souhlasu (registrace, komunikace) a oprávněného zájmu (provoz spolku, účetnictví). Souhlas můžete kdykoli odvolat.",
  },
  {
    icon: "🔒",
    title: "Jak data chráníme?",
    body: "Data jsou uložena na šifrovaných serverech v EU. Přístup mají pouze oprávnění členové výboru. Platební data nejsou ukládána — zpracovává je banka přímo.",
  },
  {
    icon: "📤",
    title: "Komu data předáváme?",
    body: "Data neprodáváme ani nepůjčujeme třetím stranám. Sdílíme je pouze se zpracovateli nezbytných služeb (hosting, e-mail) na základě smluvního ujednání.",
  },
  {
    icon: "🗑️",
    title: "Jak smazat svá data?",
    body: "Kdykoli si můžete podat žádost o smazání účtu přes nastavení v aplikaci. Data vymažeme nebo anonymizujeme do 30 dnů.",
  },
  {
    icon: "📅",
    title: "Jak dlouho data uchováváme?",
    body: "Profil: do ukončení členství. Platební záznamy: dle účetních předpisů. Zpětná vazba: 12–24 měsíců. Audit logy: 24–60 měsíců.",
  },
  {
    icon: "✋",
    title: "Vaše práva",
    body: "Máte právo na přístup, opravu, výmaz, omezení zpracování a přenositelnost svých dat. Při pochybnostech se obraťte na výbor nebo na Úřad pro ochranu osobních údajů (uoou.cz).",
  },
  {
    icon: "👶",
    title: "Data o dětech",
    body: "Neukládáme jméno, přesné datum narození ani fotografie dětí bez samostatného souhlasu. Vedeme pouze přiřazení ke třídě a volitelný identifikátor.",
  },
];

export default function GdprPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-gray-900">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 transition-colors">Školní výbor</a>
        <a href="/login" className="text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
          Přihlásit se
        </a>
      </nav>

      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Ochrana osobních údajů (GDPR)
          </h1>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Zpracováváme jen data, která skutečně potřebujeme. Vaše soukromí bereme vážně.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-6">
            {SECTIONS.map((s) => (
              <div key={s.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 bg-gray-50 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-3">Kontakt správce dat</h2>
          <p className="text-gray-500 text-sm">
            Školní výbor ZŠ Střílky · strilkove.cz<br />
            Pro žádosti o přístup nebo výmaz dat se přihlaste do aplikace nebo nás kontaktujte e-mailem.
          </p>
        </div>
      </section>

      <footer className="mt-auto border-t border-gray-100 px-4 py-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "QR příspěvky", href: "/prispevky" },
              { label: "Dobrovolnictví", href: "/ukoly" },
              { label: "Transparentnost", href: "/transparentnost" },
              { label: "GDPR", href: "/gdpr" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">{l.label}</a>
            ))}
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Školní výbor · strilkove.cz</p>
        </div>
      </footer>
    </div>
  );
}
```

---

## Task 6: School events API route (server-side scrape)

**Files:**
- Create: `app/api/public/school-events/route.ts`

- [ ] **Step 1: Create the scrape route**

```ts
// app/api/public/school-events/route.ts
import { NextResponse } from "next/server";

export interface SchoolEvent {
  title: string;
  date: string;
  url: string;
}

const SOURCE_URL = "https://www.zsstrilky.cz/zakladni-skola/nadchazejici-udalosti";
let cache: { events: SchoolEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ events: cache.events });
  }

  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "school-committee-bot/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ events: [] });
    }

    const html = await res.text();
    const events = parseEvents(html);
    cache = { events, fetchedAt: Date.now() };
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

function parseEvents(html: string): SchoolEvent[] {
  const events: SchoolEvent[] = [];
  // Match article or event list items — adjust regex if site structure changes
  const itemRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(html)) !== null && events.length < 10) {
    const block = match[1];
    const titleMatch = /<h[23][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const dateMatch = /<time[^>]*datetime="([^"]*)"[^>]*>/i.exec(block) ||
                      /<[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\//i.exec(block);

    if (titleMatch) {
      const rawHref = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]+>/g, "").trim();
      const date = dateMatch ? (dateMatch[1] || dateMatch[2] || "").replace(/<[^>]+>/g, "").trim() : "";
      const url = rawHref.startsWith("http") ? rawHref : `https://www.zsstrilky.cz${rawHref}`;
      if (title) events.push({ title, date, url });
    }
  }

  // Fallback: try simpler link+date pattern if no articles found
  if (events.length === 0) {
    const linkRegex = /<a[^>]*href="(\/[^"]*udalost[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && events.length < 10) {
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (title && title.length > 3) {
        events.push({
          title,
          date: "",
          url: `https://www.zsstrilky.cz${match[1]}`,
        });
      }
    }
  }

  return events;
}
```

---

## Task 7: School events block in LandingPage

**Files:**
- Modify: `app/(landing)/LandingPage.tsx`

- [ ] **Step 1: Add translations for school events section**

Add to both `cs` and `en` objects in `T`:
```ts
// cs
eventsTitle: "Školní akce",
eventsSubtitle: "Nadcházející události ze ZŠ Střílky",
eventsLoading: "Načítám akce…",
eventsEmpty: "Momentálně žádné nadcházející akce.",
eventsLink: "Zobrazit vše na webu školy",
// en
eventsTitle: "School Events",
eventsSubtitle: "Upcoming events from ZŠ Střílky",
eventsLoading: "Loading events…",
eventsEmpty: "No upcoming events at the moment.",
eventsLink: "View all on school website",
```

- [ ] **Step 2: Add state + fetch for school events**

After the existing state declarations (around line 178), add:
```tsx
const [schoolEvents, setSchoolEvents] = useState<{ title: string; date: string; url: string }[]>([]);
const [eventsLoading, setEventsLoading] = useState(true);

useEffect(() => {
  fetch("/api/public/school-events")
    .then((r) => r.json())
    .then((d) => setSchoolEvents(d.events ?? []))
    .catch(() => {})
    .finally(() => setEventsLoading(false));
}, []);
```

- [ ] **Step 3: Add events section before the form section**

Insert this block before `{/* LEAD CAPTURE FORM */}` (around line 409):
```tsx
{/* SCHOOL EVENTS */}
<section className="px-4 py-14 bg-white">
  <div className="max-w-3xl mx-auto">
    <h2 className="text-2xl font-bold text-center mb-2">{t.eventsTitle}</h2>
    <p className="text-gray-500 text-center mb-8 text-sm">{t.eventsSubtitle}</p>
    {eventsLoading ? (
      <p className="text-sm text-gray-400 text-center">{t.eventsLoading}</p>
    ) : schoolEvents.length === 0 ? (
      <p className="text-sm text-gray-400 text-center">{t.eventsEmpty}</p>
    ) : (
      <ul className="space-y-3 mb-6">
        {schoolEvents.map((ev, i) => (
          <li key={i}>
            <a
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{ev.title}</p>
                {ev.date && <p className="text-xs text-gray-400 mt-0.5">📅 {ev.date}</p>}
              </div>
              <span className="text-blue-600 text-sm shrink-0">→</span>
            </a>
          </li>
        ))}
      </ul>
    )}
    <div className="text-center">
      <a
        href="https://www.zsstrilky.cz/zakladni-skola/nadchazejici-udalosti"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        {t.eventsLink} →
      </a>
    </div>
  </div>
</section>
```

---

## Task 8: Enhance task list API — expose assignee first name

**Files:**
- Modify: `lib/db/tasks.ts`
- Modify: `app/api/tasks/route.ts`
- Modify: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Update listTasks to include assignee profile join**

In `lib/db/tasks.ts`, replace the `listTasks` function:
```ts
export interface TaskWithAssignee {
  id: string;
  schoolId: string;
  classId: string | null;
  title: string;
  description: string;
  deadline: Date | null;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: string | null;
  assigneeName: string | null;
}

export async function listTasks(params: ListTasksParams): Promise<PageResult<TaskWithAssignee>> {
  const limit = resolveLimit(params.limit);
  const rows = await db.task.findMany({
    where: {
      schoolId: params.schoolId,
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const enriched: TaskWithAssignee[] = await Promise.all(
    rows.map(async (task) => {
      let assigneeName: string | null = null;
      if (task.assignedTo) {
        const profile = await db.profile.findUnique({
          where: { userId: task.assignedTo },
          select: { firstName: true },
        });
        if (profile) assigneeName = profile.firstName;
      }
      return { ...task, assigneeName };
    })
  );

  return buildPage(enriched, limit);
}
```

- [ ] **Step 2: Update getTask to include assignee and status event dates**

Add after the existing `getTask` function:
```ts
export interface TaskDetail {
  id: string;
  schoolId: string;
  classId: string | null;
  title: string;
  description: string;
  deadline: Date | null;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: string | null;
  assigneeName: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export async function getTaskDetail(id: string): Promise<TaskDetail> {
  const task = await db.task.findUnique({
    where: { id },
    include: { statusEvents: { orderBy: { createdAt: "asc" } } },
  });
  if (!task) throw new NotFoundError("Task not found");

  let assigneeName: string | null = null;
  if (task.assignedTo) {
    const profile = await db.profile.findUnique({
      where: { userId: task.assignedTo },
      select: { firstName: true },
    });
    if (profile) assigneeName = profile.firstName;
  }

  const claimedEvent = task.statusEvents.find((e) => e.newStatus === "reserved" || e.newStatus === "claimed");
  const completedEvent = task.statusEvents.find((e) => e.newStatus === "completed" || e.newStatus === "verified");

  return {
    id: task.id,
    schoolId: task.schoolId,
    classId: task.classId,
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    priority: task.priority,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedTo: task.assignedTo,
    assigneeName,
    startedAt: claimedEvent?.createdAt ?? null,
    finishedAt: completedEvent?.createdAt ?? null,
  };
}
```

- [ ] **Step 3: Update tasks list API route to expose assigneeName**

In `app/api/tasks/route.ts`, update the GET handler — after fetching `result`, map items:
```ts
import { listTasks } from "@/lib/db/tasks";
// ... existing imports

// In the GET handler, after: const result = await listTasks({...})
const safeItems = result.items.map((task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  deadline: task.deadline,
  priority: task.priority,
  status: task.status,
  createdAt: task.createdAt,
  isClaimed: task.assignedTo !== null,
  assigneeName: task.assigneeName,
}));

return NextResponse.json({ items: safeItems, nextCursor: result.nextCursor }, { status: 200 });
```

- [ ] **Step 4: Update task detail API route to use getTaskDetail**

In `app/api/tasks/[id]/route.ts`, replace `getTask` with `getTaskDetail`:
```ts
import { getTaskDetail } from "@/lib/db/tasks";

// In the GET handler:
const task = await getTaskDetail(id);

const safeTask = {
  id: task.id,
  title: task.title,
  description: task.description,
  deadline: task.deadline,
  priority: task.priority,
  status: task.status,
  createdAt: task.createdAt,
  isClaimed: task.assignedTo !== null,
  assigneeName: task.assigneeName,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
};

return NextResponse.json({ task: safeTask }, { status: 200 });
```

---

## Task 9: Enhance task list UI — show assignee

**Files:**
- Modify: `app/(app)/tasks/page.tsx`

- [ ] **Step 1: Update Task interface and card display**

Update the `Task` interface to include `assigneeName`:
```ts
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  deadline: string | null;
  isClaimed: boolean;
  assigneeName: string | null;
}
```

In the task card (inside the `<Link>` block), after the title/desc block, add:
```tsx
{task.assigneeName && (
  <p className="text-xs text-gray-400 mt-1">
    👤 {task.assigneeName}
  </p>
)}
```

---

## Task 10: Enhance task detail UI — show assignee, startedAt, finishedAt

**Files:**
- Modify: `app/(app)/tasks/[id]/page.tsx`

- [ ] **Step 1: Update Task interface**

```ts
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  deadline: string | null;
  isClaimed: boolean;
  createdAt: string;
  assigneeName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}
```

- [ ] **Step 2: Display assignee and dates in detail card**

After the deadline line (around line 113), add:
```tsx
{task.assigneeName && (
  <p className="text-sm text-gray-500">
    Řeší: <span className="font-medium text-gray-800">{task.assigneeName}</span>
  </p>
)}
{task.startedAt && (
  <p className="text-sm text-gray-500">
    Zahájeno: {new Date(task.startedAt).toLocaleDateString("cs-CZ")}
  </p>
)}
{task.finishedAt && (
  <p className="text-sm text-gray-500">
    Dokončeno: {new Date(task.finishedAt).toLocaleDateString("cs-CZ")}
  </p>
)}
```

---

## Task 11: Enhance public report API — include completed tasks

**Files:**
- Modify: `app/api/public/report/route.ts`

- [ ] **Step 1: Read the current route**
Read `app/api/public/report/route.ts` and add completed tasks to the response.

The route currently returns `totalCollectedCzk`, `totalSpentCzk`, `balanceCzk`, `completedTaskCount`, `expenses`. Add `completedTasks` array:

```ts
// After existing expense query, add:
const completedTaskRows = await db.task.findMany({
  where: { schoolId, status: { in: ["completed", "verified"] } },
  include: { statusEvents: { orderBy: { createdAt: "asc" } } },
  orderBy: { updatedAt: "desc" },
  take: 20,
});

const completedTasks = await Promise.all(
  completedTaskRows.map(async (task) => {
    let actorName: string | null = null;
    if (task.assignedTo) {
      const profile = await db.profile.findUnique({
        where: { userId: task.assignedTo },
        select: { firstName: true },
      });
      if (profile) actorName = profile.firstName;
    }
    const finishedEvent = task.statusEvents.find(
      (e) => e.newStatus === "completed" || e.newStatus === "verified"
    );
    return {
      id: task.id,
      title: task.title,
      actorName,
      finishedAt: finishedEvent?.createdAt ?? task.updatedAt,
    };
  })
);
```

Add `completedTasks` to the returned JSON object.

---

## Task 12: Enhance public report page — show completed tasks

**Files:**
- Modify: `app/(public)/report/page.tsx`

- [ ] **Step 1: Update ReportData interface and display**

Add to `ReportData`:
```ts
completedTasks?: { id: string; title: string; actorName: string | null; finishedAt: string }[];
```

After the existing `completedTaskCount` section, add:
```tsx
{data.completedTasks && data.completedTasks.length > 0 && (
  <section>
    <h2 className="text-lg font-bold text-gray-900 mb-3">Dokončené úkoly</h2>
    <ul className="space-y-2">
      {data.completedTasks.map((t) => (
        <li key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex justify-between items-center">
          <span>
            <span className="font-medium text-gray-900 text-sm">{t.title}</span>
            {t.actorName && (
              <span className="ml-2 text-xs text-gray-400">👤 {t.actorName}</span>
            )}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(t.finishedAt).toLocaleDateString("cs-CZ")}
          </span>
        </li>
      ))}
    </ul>
  </section>
)}
```

---

## Task 13: Build verification

- [ ] **Step 1: Run TypeScript check**
```bash
cd /home/ssf/Documents/Github/school-committee && npx tsc --noEmit 2>&1 | head -60
```
Expected: no new errors

- [ ] **Step 2: Run Next.js build**
```bash
cd /home/ssf/Documents/Github/school-committee && npm run build 2>&1 | tail -30
```
Expected: build succeeds, 4 new routes listed (`/prispevky`, `/ukoly`, `/transparentnost`, `/gdpr`)

- [ ] **Step 3: Spot-check live site after deploy**
```bash
curl -s -o /dev/null -w "%{http_code}" https://strilkove.cz/prispevky
curl -s -o /dev/null -w "%{http_code}" https://strilkove.cz/ukoly
curl -s -o /dev/null -w "%{http_code}" https://strilkove.cz/transparentnost
curl -s -o /dev/null -w "%{http_code}" https://strilkove.cz/gdpr
```
Expected: all `200`
