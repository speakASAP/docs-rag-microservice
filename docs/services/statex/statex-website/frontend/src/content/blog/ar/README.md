# Arabic Blog Content Directory

## Overview

This directory contains Arabic translations of blog posts. All blog posts should be translated from English to Arabic with proper RTL (Right-to-Left) text direction support.

## File Naming Convention

- Use Arabic slugs as defined in `frontend/src/lib/content/slugMapper.ts`
- Example: `التحول-الرقمي-الأوروبي-2026.md` (for "european-digital-transformation-2026")

## Content Structure

Each blog post should follow this structure:

```markdown
---
title: "العنوان باللغة العربية"
description: "الوصف باللغة العربية"
author: "فريق Statex"
publishDate: "2026-01-15"
category: "التحول الرقمي"
tags: ["التحول الرقمي", "أوروبا", "اتجاهات التكنولوجيا"]
language: "ar"
template: "blog-post"
seo:
  keywords: ["التحول الرقمي", "أوروبا", "التكنولوجيا"]
  metaDescription: "دليل شامل لاتجاهات التحول الرقمي الأوروبية والاستراتيجيات."
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

## Files to Translate

The following blog posts need Arabic translations:

- `التحول-الرقمي-الأوروبي-2026.md` (European Digital Transformation 2026)
- `التحليلات-المتوافقة-مع-اللائحة-العامة-لحماية-البيانات.md` (GDPR Compliant Analytics)
- `توطين-تحسين-محركات-البحث-الأوروبي.md` (European SEO Localization)
- And all other blog posts...

## Testing

After creating Arabic translations:

1. Start the development server: `npm run dev`
2. Visit the Arabic blog: `/ar/blog/`
3. Verify RTL layout is applied correctly
4. Check that Arabic content displays properly
5. Test language switching functionality
