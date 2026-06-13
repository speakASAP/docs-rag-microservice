# Semantic Compression Guide

```yaml
id: SEMANTIC-COMPRESSION-GUIDE-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 01_vision/VISION.md
downstream: []
related_adrs: []
```

## Purpose
Semantic compression may summarize approved documents for agent context, but summaries must preserve source meaning and cite the source document.

## Rules
Read the full source first, do not add uncited facts, mark AI summaries as draft until reviewed, and read the full source when implementing code or changing contracts.

## Validation
Compression fidelity is validated by comparing the summary against the full source document.
