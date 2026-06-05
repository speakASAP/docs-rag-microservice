# Instructions for the verifying agent

You are verifying the **shop-assistant** project against the requirements below. Your task:

1. **Read** the project docs: `README.md`, `docs/DEVELOPMENT.md`, `docs/API.md`, `docs/IMPLEMENTATION_PLAN.md`.
2. **Inspect** the codebase (backend and frontend) and, if possible, run the app and test the flows.
3. **For each requirement**, state: **Done**, **Partial**, or **Not done**, and cite evidence (file paths, endpoints, UI).
4. **List** any gaps or inconsistencies with the requirements.
5. **Suggest** concrete next steps to reach full compliance.

Report in a structured way (e.g. by section) so the team can fix missing parts using `docs/IMPLEMENTATION_PLAN.md`.

---

## Requirements to verify

### 1. Product vision and scenario

- [ ] **1.1** The product is an **AI shop assistant** that helps users buy products.
- [ ] **1.2** Supported scenario: user asks for something like *"Find a red silk skirt size 52, 48 cm long. Find a shop which delivers in the Czech Republic. Find the best quality skirt with the cheapest price and delivery."*
- [ ] **1.3** The system finds options, considers delivery to the Czech Republic, and aims for best quality and cheapest price with delivery.

### 2. Landing and main request form

- [ ] **2.1** There is a **landing page** that looks like a **production website**.
- [ ] **2.2** **At the top** of the landing there is a **form** where the user can **type** their request.
- [ ] **2.3** There is a clear **submit** button (e.g. **"I want it"**).
- [ ] **2.4** **MVP:** Form has **prefilled text** for faster testing:  
  `"Find a red silk skirt size 52, 48 cm long. Find a shop which delivers in the Czech Republic. Find the best quality skirt with the cheapest price and delivery."`
- [ ] **2.5** Voice input is **not** required for MVP (can be absent or disabled).

### 3. Progress and intermediary results

- [ ] **3.1** Right after submitting the request, the user sees **progress** (e.g. search status).
- [ ] **3.2** The user sees **intermediary results** (e.g. **only skirt photos**) to discuss and narrow search (color, size, etc.) before final results.
- [ ] **3.3** At the end the user sees **photos with total price** and can **choose the best variant** by clicking and going to the product URL.

### 4. Communication form and agent

- [ ] **4.1** **Next to** the main form there is a **communication form** with the **Communication AI agent**.
- [ ] **4.2** The communication UI can show **dialog** (messages) with the user.
- [ ] **4.3** The communication UI can show **tables**.
- [ ] **4.4** The communication UI can show **photos**.
- [ ] **4.5** The communication UI can show **video previews** (if applicable).

### 5. AI agents in the background

- [ ] **5.1** **SEARCH** agent: browses internet, searches for goods.
- [ ] **5.2** **COMPARISON** agent: compares prices.
- [ ] **5.3** **LOCATION** agent: works with locations (e.g. delivery region).
- [ ] **5.4** **COMMUNICATION** agent: communicates with the user (query refinement).
- [ ] **5.5** **PRESENTATION** agent: presents results in different formats (dialog, tables, photos, video).

For each: confirm the agent type exists in schema/docs and is **used in the flow** (or explicitly stubbed/planned).

### 6. Admin panel

- [ ] **6.1** There is an **admin panel** (UI and/or API) to **setup agents**.
- [ ] **6.2** Admin can **create agents** and **assign models** from ai-microservice.
- [ ] **6.3** **CRUD for models:** list/select AI models (from ai-microservice).
- [ ] **6.4** **CRUD for AI agents:** create, read, update, delete agent configurations.
- [ ] **6.5** **CRUD for prompts:** create, read, update, delete prompts.
- [ ] **6.6** Each agent configuration has: **AI model** (from ai-microservice), **Role**, **Prompt**.

### 7. Agent communication and visibility

- [ ] **7.1** Agents can **communicate with each other** and make requests (e.g. via queue or in-process).
- [ ] **7.2** In the **admin section** it is possible to see **what agents are doing**, which **tasks they assign** to each other, and their **prompts**.
- [ ] **7.3** **Full communication flow** between agents is visible (e.g. in admin or debug view) for development and fine-tuning.

### 8. Use case: request → search → presentation

- [ ] **8.1** User creates a request (e.g. "red skirt") in the form and submits.
- [ ] **8.2** **Communication agent** analyzes the request and **creates a task** for a **Search agent** (e.g. "search for several product photos (red skirts)").
- [ ] **8.3** When photos are found, the **Search agent** asks the **Presentation agent** to present them to the user.
- [ ] **8.4** The **Presentation agent** provides prepared results to the **user chat** and informs the **Communication agent** that results are ready.
- [ ] **8.5** User can **reply in the chat**; Communication agent **assigns tasks** to other agents and the cycle continues.

### 9. Agent sets (named configurations)

- [ ] **9.1** Different **named sets** for agents can be saved (e.g. "Communication Agent Polite", "Communication Agent Strict").
- [ ] **9.2** Each set has: **type** (e.g. communication agent, search agent), **model** (e.g. ChatGPT, Grok), **prompt** (text instruction for that agent).

### 10. Contracts and parallel work

- [ ] **10.1** AI agents can **make contracts with other AI agents** to speed up parallel work (task handoffs and/or queue).
- [ ] **10.2** This behavior is visible or documented (e.g. in agent communication logs or admin).

### 11. Documentation and plan

- [ ] **11.1** **Documentation** is in place (README, development docs, API, integration).
- [ ] **11.2** A **plan to fix** any not-finished parts exists (e.g. in `docs/IMPLEMENTATION_PLAN.md`) and is updated when tasks are completed.

### 12. Initial-stage business requirements

- [ ] **12.1** **Priorities:** The assistant collects and compares products by user priorities (price, quality, location/delivery). COMPARISON and LOCATION agents are used; user can set priority order.
- [ ] **12.2** **Multi-product search:** The system can search **simultaneously for several products** in one request (e.g. red skirt + winter boots + scarf); results are grouped by product type.
- [ ] **12.3** **Multi-user per account:** One account can have multiple profiles/recipients (e.g. clothes for Mom, Dad, Child; or three children). User can select “who is this for?” and searches can be scoped per profile.
- [ ] **12.4** **Saved search criteria:** User can optionally **save** criteria (priorities, product types, profiles, filters) for reuse (e.g. named templates like “Weekly groceries”); CRUD and “Run this search” are available.
- [ ] **12.5** **Integrations:** ai-microservice, auth-microservice, database-server, and logging-microservice are integrated and used for the above (see README and INTEGRATION.md). No modifications are made inside those services.

---

## Verification output format

The verifier should produce:

1. **Summary:** One short paragraph on overall compliance (e.g. "MVP 70% complete, main gaps: ...").
2. **Per-section results:** For each requirement, **Done / Partial / Not done** plus evidence (file, endpoint, or behavior).
3. **Gap list:** Numbered list of missing or incorrect items.
4. **Recommended next steps:** Ordered list of actions to reach full compliance, aligned with `IMPLEMENTATION_PLAN.md`.

This output can be used to update `docs/IMPLEMENTATION_PLAN.md` and to prioritize development work.
