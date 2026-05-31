# ADR-007: Configurable server URL

**Status:** Accepted  
**Date:** 2026-05

## Context

The API base URL was hardcoded to `eurocontrol-api.iserver365.com`. Other organisations use different Orbus iServer instances with their own subdomains (e.g., `acme-api.iserver365.com`). A hardcoded URL limits orbusctl to a single organisation.

## Decision

Store the server URL in `~/.orbusctl/config.json` and read it via `getServer()`/`getBaseUrl()` in `core/config.ts`. The organisation name is extracted from the URL pattern `{orgname}-api.iserver365.com` and displayed in the TUI header as `ORBUSCTL · ORGNAME`.

The Config section in the TUI provides an inline text editor for changing the server URL, and changes take effect immediately without restart.

## Consequences

**Positive**
- orbusctl works for any Orbus iServer instance, not just Eurocontrol
- Organisation name displayed in the header gives clear context about which instance is connected
- Config section allows switching servers without restarting the app

**Negative**
- Organisation name extraction depends on the `{orgname}-api.iserver365.com` URL pattern — custom domains would show the raw hostname or require additional parsing logic
- Changing the server mid-session invalidates the current auth token (different instance, different credentials)
