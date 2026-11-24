-- Fixed diagnostic labels only. No secrets, identifiers, IPs or request bodies.
CREATE TABLE IF NOT EXISTS mcp_oauth_diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  client_kind TEXT NOT NULL,
  stage TEXT NOT NULL,
  status INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_oauth_diagnostics_time ON mcp_oauth_diagnostics(at);
