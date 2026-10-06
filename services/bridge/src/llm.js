// services/bridge/src/llm.js — the one place that talks to the LLM (Groq, OpenAI-compatible chat API).
// Every answer is JSON, checked on the server against the schema it was asked for. An answer that does not
// fit is asked for once more; a second miss throws, and the route uses its fallback. Nothing invalid is
// ever applied. Keys and the model name come from the environment only: with no LLM_API_KEY or no
// LLM_MODEL, every call throws at once and the app runs on its fallbacks.
const { validate } = require('./validate');

const GROQ_URL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions';

// Strict mode makes Groq return exactly these keys, so the draft always fits endpoint 6.
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'want', 'serveUsWell', 'youWillLearn', 'groupSize', 'interestTags', 'rhythm', 'weeks', 'place'],
  properties: {
    title: { type: 'string' },
    want: { type: 'string' },
    serveUsWell: { type: 'string' },
    youWillLearn: { type: 'string' },
    groupSize: { type: 'integer' },
    interestTags: { type: 'array', items: { type: 'string' } },
    rhythm: {
      type: 'object',
      additionalProperties: false,
      required: ['day', 'start', 'end'],
      properties: { day: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } },
    },
    weeks: { type: 'integer' },
    place: { type: 'string' },
  },
};

// LLM_API_KEY / LLM_MODEL; the older GROQ_* names still work. No model name is written in the code.
const apiKey = () => process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
const modelName = () => process.env.LLM_MODEL || process.env.GROQ_MODEL;
// Groq's constrained decoding ("json_schema", strict) is for its openai/gpt-oss and qwen3 models; for
// any other model set LLM_RESPONSE_FORMAT=json_object (valid JSON, checked against the schema here).
const responseFormat = (name, schema) => (process.env.LLM_RESPONSE_FORMAT === 'json_object'
  ? { type: 'json_object' }
  : { type: 'json_schema', json_schema: { name, strict: true, schema } });

const isConfigured = () => Boolean(apiKey() && modelName());

// One chat call. Returns the raw text of the answer. Throws on any failure.
async function chat({ system, user, name, schema }) {
  if (!apiKey()) throw new Error('LLM_API_KEY is not set');
  if (!modelName()) throw new Error('LLM_MODEL is not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName(),
      temperature: 0.2,
      messages: [
        { role: 'system', content: `${system}\n\nAnswer with JSON only, matching this schema:\n${JSON.stringify(schema)}` },
        { role: 'user', content: user },
      ],
      response_format: responseFormat(name, schema),
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.choices[0].message.content;
}

// Ask, parse, check against the schema; on a miss ask once more. Returns the checked object.
async function askChecked(job) {
  let lastProblems = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chat(job);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { lastProblems = ['not JSON']; continue; }
    const problems = validate(job.schema, parsed);
    if (!problems.length) return parsed;
    lastProblems = problems;
  }
  throw new Error(`LLM answer did not match the schema: ${lastProblems.slice(0, 3).join('; ')}`);
}

// Returns the raw JSON string of a checked draft need card. Throws on any failure; the route falls back.
async function callLLM(prompt, text, language) {
  const draft = await askChecked({ system: prompt, user: `Language: ${language || 'en'}\n\n${text}`, name: 'need_card', schema: DRAFT_SCHEMA });
  return JSON.stringify(draft);
}

// The other AI jobs: returns the checked, parsed object. Throws on any failure; each route has its own fallback.
const callJSON = askChecked;

module.exports = { callLLM, callJSON, DRAFT_SCHEMA, isConfigured };
