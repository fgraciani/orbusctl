# orbusctl Vision

## What it is

orbusctl is a terminal UI for Orbus Infinity (iServer365). It gives architects, admins, and AI agents a fast, keyboard-driven interface to browse, audit, compare, and manage EA models — without leaving the terminal.

## Who uses it

| User | Primary need |
|------|-------------|
| **EA Architects** | Browse and compare models, inspect object hierarchies |
| **Admins** | Audit user activity, manage sessions, monitor platform health |
| **AI Agents** | Programmatic access to model data via a structured CLI |

## Why it exists

The Orbus web UI is powerful but slow for repetitive tasks and inaccessible to automation. orbusctl provides:
- Speed — keyboard navigation, no mouse, no page loads
- Scriptability — machine-readable output for AI pipelines
- Portability — runs anywhere Node.js runs, no browser required

## What success looks like

- An architect can browse 4 models, compare two, and export a diff in under 2 minutes
- An admin can audit the last 24h of activity without opening a browser
- An AI agent can list, filter, and export model objects in a single command
- A new user can navigate the full TUI without reading documentation

## Scope

orbusctl provides read and write access to Orbus model data (objects, relationships, drawings) via TUI and CLI. Diagram canvas rendering, webhook management, and admin user management are out of scope.

For what's implemented, see [CHANGELOG.md](../CHANGELOG.md). For what's coming, see [BACKLOG.md](../BACKLOG.md). For current limitations, see [KNOWN-ISSUES.md](../KNOWN-ISSUES.md).
