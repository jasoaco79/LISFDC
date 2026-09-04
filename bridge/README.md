# LISFDC local bot bridge

Local HTTP + MCP for LISFDC.
Start: use package.json start script.
Health: GET http://127.0.0.1:17321/health

## Safety
- Bind 127.0.0.1 only (port 17321).
- Bearer token LISFDC_BRIDGE_TOKEN; auto-written to .token (gitignored).
- Salesforce scrape-only; reject url on scrape_salesforce.

## Extension
Load unpacked extension/ v1.1.0+, enable Bot bridge in side panel, paste token.

## MCP env
LISFDC_BRIDGE_TOKEN and LISFDC_BRIDGE_URL (default http://127.0.0.1:17321).
Script name in package.json: mcp.

## Tools
lisfdc_health, lisfdc_scrape_linkedin, lisfdc_open_linkedin,
lisfdc_research_linkedin, lisfdc_scrape_salesforce, lisfdc_get_stored.

## CLI helper
cli.mjs accepts: health, scrape_linkedin, open_linkedin, research_linkedin,
scrape_salesforce, get_stored with --url and --waitMs.

## API
GET /health
POST /v1/commands
GET /v1/commands/pending
POST /v1/commands/:id/result
GET /v1/commands/:id
One command at a time (409 if busy).
