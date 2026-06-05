# Arabic Pages Content Directory

## Overview

This directory contains Arabic translations of website pages. All pages should be translated from English to Arabic with proper RTL (Right-to-Left) text direction support.

## Directory Structure

```text
/
├── README.md
├── home.md                    # الصفحة الرئيسية
├── about.md                   # من نحن
├── contact.md                 # اتصل بنا
├── services/                  # الخدمات
│   ├── digital-transformation.md
│   ├── ai-automation.md
│   ├── custom-software.md
│   ├── consulting.md
│   ├── web-development.md
│   ├── mobile-development.md
│   ├── cybersecurity.md
│   ├── devops.md
│   ├── ui-ux-design.md
│   ├── testing-qa.md
│   ├── maintenance-support.md
│   └── e-commerce.md
├── solutions/                 # الحلول
│   ├── ai-integration.md
│   ├── business-automation.md
│   ├── digital-transformation.md
│   ├── cloud-migration.md
│   ├── data-analytics.md
│   ├── enterprise-solutions.md
│   ├── legacy-modernization.md
│   ├── api-development.md
│   ├── performance-optimization.md
│   └── blockchain-solutions.md
└── legal/                     # الصفحات القانونية
    ├── privacy-policy.md
    ├── terms-of-service.md
    ├── cookie-policy.md
    ├── disclaimer.md
    ├── accessibility.md
    ├── contact-information.md
    └── impressum.md
```

## File Naming Convention

- Use Arabic slugs as defined in `frontend/src/lib/content/slugMapper.ts`
- Example: `التحول-الرقمي.md` (for "digital-transformation")

## Content Structure

Each page should follow this structure:

```markdown
---
title: "العنوان باللغة العربية"
description: "الوصف باللغة العربية"
language: "ar"
template: "page-template"
seo:
  keywords: ["الكلمات المفتاحية", "باللغة العربية"]
  metaDescription: "الوصف التعريفي باللغة العربية."
---

# العنوان الرئيسي

المحتوى باللغة العربية...
```

## RTL Support

- All content should be written in Arabic
- Text direction is automatically handled by the LanguageProvider
- Use proper Arabic typography and punctuation
- Ensure proper line breaks and paragraph spacing

## Translation Guidelines

1. **Maintain the same structure** as the English version
2. **Adapt content culturally** for Arabic-speaking audiences
3. **Use proper Arabic terminology** for technical terms
4. **Maintain SEO keywords** in Arabic
5. **Keep the same metadata structure**
6. **Ensure proper heading hierarchy** (H1, H2, H3)

## Priority Order

1. **Core Pages** (home, about, contact)
2. **Services Pages** (digital-transformation, ai-automation, etc.)
3. **Solutions Pages** (ai-integration, business-automation, etc.)
4. **Legal Pages** (privacy-policy, terms-of-service, etc.)

## Testing

After creating Arabic translations:

1. Start the development server: `npm run dev`
2. Visit Arabic pages: `/ar/`, `/ar/about`, `/ar/services`, etc.
3. Verify RTL layout is applied correctly
4. Check that Arabic content displays properly
5. Test language switching functionality
6. Verify Arabic URLs are generated correctly

## Notes

- Arabic content will be served at URLs like `/ar/التحول-الرقمي`
- AI content will be served at URLs like `/ar/ai/التحول-الرقمي`
- All Arabic content supports RTL layout automatically
