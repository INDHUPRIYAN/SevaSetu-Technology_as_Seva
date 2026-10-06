// services/bridge/src/llm.js — the one place that talks to Groq
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

// Returns the raw JSON string of a draft need card. Throws on any failure; the route falls back.
async function callLLM(prompt, text, language) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      reasoning_effort: 'low',                   // speed matters more than depth here
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Language: ${language || 'en'}\n\n${text}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'need_card', strict: true, schema: DRAFT_SCHEMA },
      },
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.choices[0].message.content;
}

module.exports = { callLLM, DRAFT_SCHEMA };
