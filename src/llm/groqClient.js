// // ============================================================
// // src/llm/groqClient.js
// // Groq (OpenAI-compatible) chat completion client. Automatic
// // fallback provider when Gemini errors, times out, or is
// // rate-limited. See llm/llmRouter.js for the failover logic.
// // ============================================================
// import axios from 'axios';
// import { config } from '../config/index.js';

// const URL = 'https://api.groq.com/openai/v1/chat/completions';

// export async function generateText(prompt, { maxOutputTokens = 512, temperature = 0.4 } = {}) {
//   const { apiKey, model } = config.llm.groq;
//   if (!apiKey) throw new Error('GROQ_API_KEY not configured');

//   const res = await axios.post(
//     URL,
//     {
//       model,
//       messages: [{ role: 'user', content: prompt }],
//       max_tokens: maxOutputTokens,
//       temperature,
//     },
//     { timeout: 8000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
//   );

//   const text = res.data?.choices?.[0]?.message?.content ?? '';
//   if (!text) throw new Error('Groq returned an empty response');
//   return text.trim();
// }


// ============================================================
// src/llm/groqClient.js
// Groq (OpenAI-compatible) chat completion client. Automatic
// fallback provider when Gemini errors, times out, or is
// rate-limited. See llm/llmRouter.js for the failover logic.
// ============================================================
import axios from 'axios';
import { config } from '../config/index.js';

const URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function generateText(prompt, { maxOutputTokens = 512, temperature = 0.4 } = {}) {
  const { apiKey, model } = config.llm.groq;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  // openai/gpt-oss-* models on Groq are reasoning models: they spend
  // tokens "thinking" before writing the actual answer. A small
  // max_tokens budget gets entirely consumed by reasoning, leaving
  // zero tokens for the real response — which surfaces as an empty
  // completion rather than an error. Forcing a low reasoning effort
  // and enforcing a higher token floor keeps the final answer intact.
  const isReasoningModel = model.includes('gpt-oss');
  const effectiveMaxTokens = isReasoningModel ? Math.max(maxOutputTokens, 1024) : maxOutputTokens;

  const res = await axios.post(
    URL,
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: effectiveMaxTokens,
      temperature,
      ...(isReasoningModel ? { reasoning_effort: 'low' } : {}),
    },
    { timeout: 12000, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );

  const text = res.data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq returned an empty response (likely reasoning tokens exhausted the budget)');
  return text.trim();
}