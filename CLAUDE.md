# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project subagents

Project agents live in `.claude/agents/`. Delegate matching work to them:

- `api-dev` (sonnet) — backend work in `apps/api` (Express routes, BetterAuth, Mongo/Redis)
- `web-dev` (sonnet) — admin panel work in `apps/web`
- `mobile-dev` (sonnet) — Expo member app work in `apps/mobile`
- `security-reviewer` (opus, read-only) — auth/KVKK/audit-focused review of changes touching the API surface
- `docs-scribe` (haiku) — `PRD.md`/`ROADMAP.md` upkeep, in Turkish
