---
name: Orchestrator Delegation Workflow
description: When implementing runlayer features, always write Cursor agent files with Claude as validator sync gates — never write the implementation code directly
type: feedback
originSessionId: cc3ed17b-9cdc-4da7-9220-27fe04bd8539
---
When implementing features for runlayer, act as the Lead Orchestrator agent (`master-prompt.md`):
1. Write **paired prompt files** (AGENT{NN}_*.md for Cursor + AGENT{NN}V_*_VALIDATE.md for Claude Code sync gates)
2. Create **multiple Cursor tasks** with Claude Code as the validation gate between big chunks
3. Update **ORCHESTRATOR_TASKS_INDEX.md** and **PROGRESS_STATE.json** to register the new tasks
4. **Never write the implementation code directly** — that's Cursor's job

**Why:** User's workflow: Cursor implements code; Claude Code orchestrates, reviews, and validates. Claude Code writing implementation code directly bypasses the Cursor workflow and the paired-prompt discipline.

**How to apply:** Any time implementing a feature in runlayer — create agent files, not code. Split into AGENT{N} (implementation) + AGENT{N}V (validator), with Claude running the validator as the sync gate.
