# Open-source directory submission

Our package is listed on [npm](https://www.npmjs.com/package/etsy-seller-mcp-hub) and the [official MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=etsy-seller-mcp-hub).

## Glama listing: already published

Our server has a [Glama profile](https://glama.ai/mcp/servers/Bl0ck154/etsy-seller-mcp-hub). The live score badge is available at:

`https://glama.ai/mcp/servers/Bl0ck154/etsy-seller-mcp-hub/badges/score.svg`

The badge displays A and indicates that the maintainer has claimed the listing. It is linked from our README and [upstream awesome-mcp-servers PR #18306](https://github.com/punkpeye/awesome-mcp-servers/pull/18306). Do not submit a duplicate server.

Glama currently says the source server **cannot be deployed on Glama**. The package is nonetheless available through npm and the official MCP Registry. Shared hosted deployment is intentionally out of scope: sellers self-host with their own credentials.

`Dockerfile.glama` uses synthetic, no-credential introspection. Never provide OAuth secrets or customer data to a directory scanner. The upstream PR remains open until external maintainers merge it. A directory score is not an independent security certification.

## Glama schema inspection vs. server health (November 2026)

The public [Glama schema page](https://glama.ai/mcp/servers/Bl0ck154/etsy-seller-mcp-hub/schema) currently shows **"Server capabilities have not been inspected yet"** and **"No tools"**. This means the directory has not populated its tool schema; it **does not mean** our local MCP returns zero tools. Similar uninspected listings exist for other local Etsy MCP servers.

Glama's "cannot be deployed" label refers to hosted deployment **on Glama**, not to whether users can install this self-hosted npm package. We intentionally do not offer a shared multi-seller public endpoint.

Run `npm test` (including `test/glama-introspection.test.mjs`) to verify the stdio `initialize` and `tools/list` handshake with synthetic `config.example.json`, **without contacting Etsy or loading seller credentials**. The test expects 53 read-only tool schemas. To inspect manually, start `ETSY_HUB_CONFIG=./config.example.json ETSY_MCP_READ_ONLY=1 node bin/etsy-mcp.mjs` on a machine with Node 22+ and send JSON-RPC `initialize` and `tools/list` requests. No Etsy OAuth is needed for listing tool metadata; live operations still need authorized credentials.

If Glama continues to display an uninspected schema, request a refresh from the Glama listing administrators rather than registering the same server twice. Do **not** upload tokens, alter production OAuth, or expose a public credentialless MCP service just to satisfy directory scanning.

## Other possible catalogues

After Glama, consider Smithery and mcp.so if they accept self-hosted stdio servers. Describe this as source code installed per seller, **not** as a public, shared remote connector.

## Outreach and community

Use accurate examples from [DEMO.md](DEMO.md) with fictional data only. Ask technical sellers for feedback on ease of setup, OAuth and first useful tasks. Do not buy stars or simulate testimonials.
