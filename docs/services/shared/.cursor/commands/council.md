# Council (four roles, one pass)

Run a **single** structured review. You are **not** four separate models — simulate four expert voices briefly, then merge.

## Input

Use the user’s question or the attached context as the issue under review.

## Output format (strict)

### 1. Architect

- 3–5 bullets: boundaries, components, coupling, operational fit with the Statex ecosystem (shared microservices, deploy, logging).

### 2. Security

- 3–5 bullets: secrets, auth, data exposure, supply chain, what must stay human-in-the-loop.

### 3. Product / business

- 3–5 bullets: user value, scope, what to cut or defer, alignment with repo `BUSINESS.md` if relevant.

### 4. Skeptic

- 3–5 bullets: risks, unknowns, ways this fails in production, hidden cost (time, tokens, ops).

### 5. Consolidated recommendation

- **Decision**: ship / revise / spike / reject (one line).
- **Rationale**: 2–4 sentences.
- **Next steps**: ordered list, smallest first.
- **Open questions**: only what truly blocks execution.

Keep each section tight. No filler.
