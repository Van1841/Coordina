// ============================================================
// src/rts/realtimeSearch.js
// Real-Time Search (RTS) abstraction.
//
// WHY RTS INSTEAD OF POLLING (see also README.md):
// A polling loop over Slack history / a database has three
// structural problems in a multi-org crisis-coordination
// setting:
//   1. Latency vs. cost tradeoff — poll fast enough to catch an
//      "insulin running out" message within minutes, and you're
//      hammering Slack's Web API and MySQL constantly; poll
//      slow enough to be cheap, and urgent incidents sit
//      unseen for the length of the interval.
//   2. No semantic matching — polling gives you rows/messages,
//      not "is this the same shortage someone reported an hour
//      ago at a different org, worded differently." Detecting
//      duplicates or related incidents needs a search/index
//      operation, not a timestamp comparison.
//   3. External situational awareness — Coordina also needs to
//      notice things that never touch its own DB (e.g. a
//      regional advisory affecting shelter routing). Polling
//      your own tables can never surface that; a search-style
//      query against a live index/provider can.
//
// RTS solves this by exposing an event-driven `watch()` (push,
// not pull) for in-workspace signals, and a `search()` for
// semantic "find things related to X" queries — both backed by
// an in-process event bus + index here, with a thin adapter to
// swap in a real external RTS provider (set RTS_PROVIDER_API_KEY).
// ============================================================
import { EventEmitter } from 'node:events';
import axios from 'axios';
import { config } from '../config/index.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('rts');

class RealtimeSearch extends EventEmitter {
  constructor() {
    super();
    this.index = []; // { id, text, category, organizationId, createdAt }
    this.setMaxListeners(50);
  }

  // Push a new signal into RTS. Called by Slack event handlers,
  // the classifier, MCP servers reporting shortages, etc.
  // This is what makes RTS event-driven rather than pull-based:
  // consumers subscribe once via `watch()` and get notified
  // immediately, no interval required.
  publish(signal) {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date(), ...signal };
    this.index.push(entry);
    if (this.index.length > 2000) this.index.shift(); // bounded in-memory index
    this.emit('signal', entry);
    log.debug('published signal', entry.category, '-', entry.text?.slice(0, 60));
    return entry;
  }

  // Subscribe to live signals. Returns an unsubscribe function.
  watch(handler) {
    this.on('signal', handler);
    return () => this.off('signal', handler);
  }

  // Semantic-ish similarity search over the live index, used to
  // detect duplicate incidents and related situations. Uses a
  // lightweight token-overlap scorer locally; if a real RTS
  // provider key is configured, delegates to it for broader,
  // truly real-time web/situational search instead.
  async search(text, { category = null, limit = 5 } = {}) {
    if (config.rts.providerApiKey) {
      try {
        return await this._providerSearch(text, { category, limit });
      } catch (err) {
        log.warn('external RTS provider failed, falling back to local index:', err.message);
      }
    }
    return this._localSearch(text, { category, limit });
  }

  _localSearch(text, { category, limit }) {
    const tokens = new Set(tokenize(text));
    const scored = this.index
      .filter((e) => !category || e.category === category)
      .map((e) => ({ entry: e, score: overlapScore(tokens, new Set(tokenize(e.text))) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((s) => ({ ...s.entry, relevance: s.score }));
  }

  async _providerSearch(text, { category, limit }) {
    // Generic adapter shape for an external RTS/websearch provider.
    // Kept intentionally provider-agnostic; point RTS_PROVIDER_API_KEY
    // + this URL at whatever real-time search service is available.
    const res = await axios.post(
      'https://api.rts-provider.example/v1/search',
      { query: text, category, limit },
      { headers: { Authorization: `Bearer ${config.rts.providerApiKey}` }, timeout: 4000 }
    );
    return res.data?.results ?? [];
  }
}

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapScore(setA, setB) {
  let overlap = 0;
  for (const t of setA) if (setB.has(t)) overlap += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  return overlap / union; // Jaccard similarity
}

export const rts = new RealtimeSearch();
