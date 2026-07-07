// ============================================================
// src/llm/llmRouter.js
// Automatic failover: Gemini primary, Groq fallback. If both
// fail, callers receive `null` explanation text — the decision
// engine's scores and recommendations remain fully intact
// (only the human-readable explanation disappears). The app
// must never crash because an LLM provider is down.
// ============================================================
import * as gemini from './geminiClient.js';
import * as groq from './groqClient.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('llm-router');

/**
 * @returns {{ text: string|null, provider: 'gemini'|'groq'|null, error: string|null }}
 */
export async function generate(prompt, options = {}) {
  try {
    const text = await gemini.generateText(prompt, options);
    return { text, provider: 'gemini', error: null };
  } catch (geminiErr) {
    log.warn('Gemini failed, falling back to Groq:', geminiErr.message);
    try {
      const text = await groq.generateText(prompt, options);
      return { text, provider: 'groq', error: null };
    } catch (groqErr) {
      log.error('Groq fallback also failed:', groqErr.message);
      return {
        text: null,
        provider: null,
        error: `Both LLM providers unavailable (gemini: ${geminiErr.message}; groq: ${groqErr.message})`,
      };
    }
  }
}
