# Product positioning — Project OS

**Public name:** Project OS  
**Repository / service ID:** `runlayer` (unchanged — deploy names, DB schema, URLs stay as-is)

## What it is

Project OS is the **operating system for running multiple digital projects** with **agent workers** and **human approvals**.

You define goals per project; coordinators and workers execute in the background; you review AI-generated plans and escalations before work proceeds at scale.

## What it is not

- Not a generic “business orchestrator” or workflow BPM tool
- Not an LLM gateway (that is `ai-microservice`)
- Not a replacement for product-specific apps (catalog, orders, etc.)

## Core value props

| Pillar | User-facing promise |
|--------|---------------------|
| Multi-project control plane | One dashboard for many digital projects (repos, apps, initiatives) |
| Agent workers | Coordinators plan; workers execute; validators gate output |
| Human approvals | Plans and critical paths require explicit approval — not full autopilot |
| Observability | Goals, tasks, agents, and step logs in one place |

## Messaging (copy bank)

- **Headline:** The operating system for your digital projects
- **Subhead:** Run many projects in parallel with AI agent workers. You approve plans and escalations; agents handle execution.
- **Feature — workers:** Specialized agent workers execute tasks, write code, validate results, and escalate when stuck.
- **Feature — approvals:** Review AI-generated task plans before work starts; stay in control without micromanaging every step.
- **Feature — scale:** Manage one project or dozens from a single workspace — each with its own goals, tasks, and agent pool.

## Domain language (UI vs code)

| UI (user-facing) | Code / API (legacy) |
|------------------|---------------------|
| Project OS | `runlayer` service |
| Projects (nav) | `businesses` + nested `projects` |
| Workspace / portfolio card | `Business` aggregate |
| Digital project | `Project` entity |

Do not rename database tables or REST paths in a repositioning pass — only user-visible copy and docs.

## Audience

Founders and technical leads running **multiple digital products or codebases** who want agent-assisted execution with clear approval gates, not fully unattended “business autopilot.”
