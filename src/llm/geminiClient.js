// ============================================================
// src/llm/geminiClient.js
// Thin wrapper around the Gemini REST API (free tier friendly —
// no SDK dependency, just fetch). Primary LLM provider.
// ============================================================
import axios from 'axios';
import { config } from '../config/index.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function generateText(prompt, { maxOutputTokens = 512, temperature = 0.4 } = {}) {
  const { apiKey, model } = config.llm.gemini;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
  const res = await axios.post(
    url,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature },
    },
    { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
  );

  const text = res.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) throw new Error('Gemini returned an empty response');
  return text.trim();
}
