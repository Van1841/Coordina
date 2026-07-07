// ============================================================
// src/llm/classifier.js
// Classifies incoming Slack messages into structured incident
// candidates using Gemini/Groq (via llmRouter), so Coordina
// understands "We are running out of insulin" without relying
// only on keyword matching. Falls back to a conservative
// keyword heuristic if both LLM providers are down, so the
// pipeline degrades gracefully rather than dropping messages.
//
// IMPORTANT BOUNDARY: classification output feeds the decision
// engine as *inputs* (kind/category/peopleAffected/urgencyHint).
// The engine still computes the priority score deterministically
// — the LLM never assigns a score or a confidence percentage.
// ============================================================
import { generate } from './llmRouter.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('classifier');

const CATEGORIES = ['medical', 'shelter', 'food', 'logistics', 'other'];
const KINDS = ['need', 'offer', 'urgent', 'chatter'];

const PROMPT_TEMPLATE = (message) => `You are a message classifier for a disaster-relief coordination system.
Classify the following Slack message. Respond with ONLY a compact JSON object,
no prose, no markdown fences, matching exactly this shape:
{"kind": "need|offer|urgent|chatter", "category": "medical|shelter|food|logistics|other", "peopleAffected": <integer, 0 if unspecified>, "summary": "<one short sentence>"}

Rules:
- "chatter" means the message is not an actionable need, offer, or incident.
- "urgent" means life-safety risk or critical shortage language (e.g. "running out", "urgently", "critical").
- Infer peopleAffected only if the message gives or clearly implies a number; otherwise 0.
- summary must be a neutral, factual restatement, under 20 words.

Message: """${message}"""`;

function keywordFallback(message) {
  const text = message.toLowerCase();
  const urgentWords = ['urgent', 'running out', 'critical', 'emergency', 'immediately', 'now'];
  const medicalWords = ['insulin', 'medicine', 'medical', 'doctor', 'injury', 'hospital', 'ambulance', 'blood'];
  const shelterWords = ['shelter', 'beds', 'housing', 'tent', 'roof'];
  const foodWords = ['food', 'ration', 'meal', 'water', 'grocery'];
  const logisticsWords = ['transport', 'vehicle', 'truck', 'route', 'delivery', 'fuel'];
  const offerWords = ['we can provide', 'offering', 'donate', 'available to help', 'we have'];

  const has = (words) => words.some((w) => text.includes(w));

  let category = 'other';
  if (has(medicalWords)) category = 'medical';
  else if (has(shelterWords)) category = 'shelter';
  else if (has(foodWords)) category = 'food';
  else if (has(logisticsWords)) category = 'logistics';

  let kind = 'chatter';
  if (has(offerWords)) kind = 'offer';
  else if (has(urgentWords)) kind = 'urgent';
  else if (category !== 'other') kind = 'need';

  const numberMatch = text.match(/\b(\d{1,5})\b/);
  const peopleAffected = numberMatch ? Number(numberMatch[1]) : 0;

  return {
    kind,
    category,
    peopleAffected,
    summary: message.slice(0, 140),
    classifiedBy: 'keyword-fallback',
  };
}

function safeParseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to salvage a JSON object substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fallthrough */ }
    }
    return null;
  }
}

export async function classifyMessage(message) {
  const { text, provider, error } = await generate(PROMPT_TEMPLATE(message), { maxOutputTokens: 200, temperature: 0.1 });

  if (!text) {
    log.warn('LLM classification unavailable, using keyword fallback:', error);
    return keywordFallback(message);
  }

  const parsed = safeParseJson(text);
  if (!parsed || !KINDS.includes(parsed.kind) || !CATEGORIES.includes(parsed.category)) {
    log.warn('LLM returned unparseable/invalid classification, using keyword fallback. Raw:', text);
    return keywordFallback(message);
  }

  return {
    kind: parsed.kind,
    category: parsed.category,
    peopleAffected: Number.isFinite(parsed.peopleAffected) ? Math.max(0, Math.round(parsed.peopleAffected)) : 0,
    summary: String(parsed.summary || message.slice(0, 140)).slice(0, 200),
    classifiedBy: provider,
  };
}
