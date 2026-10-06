// services/bridge/src/llm.js — the one place that talks to the LLM (Groq, OpenAI-compatible API)
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

// LLM_API_KEY / LLM_MODEL; the older GROQ_* names still work
const apiKey = () => process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
const modelName = () => process.env.LLM_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// One chat call that must answer with JSON matching `schema`. Returns the raw JSON string. Throws on any failure.
async function chat({ system, user, name, schema }) {
  if (!apiKey()) throw new Error('LLM_API_KEY is not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName(),
      reasoning_effort: 'low',                   // speed matters more than depth here
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.choices[0].message.content;
}

// Returns the raw JSON string of a draft need card. Throws on any failure; the route falls back.
function callLLM(prompt, text, language) {
  return chat({ system: prompt, user: `Language: ${language || 'en'}\n\n${text}`, name: 'need_card', schema: DRAFT_SCHEMA });
}

// The other AI jobs: returns the parsed JSON object. Throws on any failure; each route has its own fallback.
async function callJSON({ system, user, name, schema }) {
  return JSON.parse(await chat({ system, user, name, schema }));
}

module.exports = { callLLM, callJSON, DRAFT_SCHEMA };
