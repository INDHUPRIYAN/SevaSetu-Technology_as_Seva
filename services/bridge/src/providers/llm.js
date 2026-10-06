// The LLM module: understanding, structured extraction, follow-up questions and the dignity rewrite behind
// one small interface. LLM_PROVIDER=groq (default) | none. Every answer is JSON checked against a schema
// (see ../llm.js); with `none`, or with no LLM_API_KEY / LLM_MODEL, every call throws at once and the
// caller uses its rule-based fallback.
const groq = require('../llm');

const PROVIDERS = {
  groq,
  none: {
    callLLM: async () => { throw new Error('No LLM provider'); },
    callJSON: async () => { throw new Error('No LLM provider'); },
    isConfigured: () => false,
  },
};

const current = () => PROVIDERS[process.env.LLM_PROVIDER || 'groq'] || PROVIDERS.none;

module.exports = {
  callLLM: (...args) => current().callLLM(...args),
  callJSON: job => current().callJSON(job),
  isConfigured: () => current().isConfigured(),
  DRAFT_SCHEMA: groq.DRAFT_SCHEMA,
};
