// The LLM module: every answer is checked against its schema on the server; a miss is asked for once more;
// a second miss throws so the route falls back. Keys and the model name come only from the environment.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../src/validate');

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['questions', 'n'],
  properties: { questions: { type: 'array', items: { type: 'string' } }, n: { type: 'integer' } },
};

describe('validate', () => {
  it('accepts a matching object and rejects the wrong shape', () => {
    assert.deepEqual(validate(SCHEMA, { questions: ['a?'], n: 1 }), []);
    assert.ok(validate(SCHEMA, { questions: 'a?', n: 1 }).length);          // array expected
    assert.ok(validate(SCHEMA, { questions: [], n: 1.5 }).length);           // integer expected
    assert.ok(validate(SCHEMA, { questions: [] }).length);                   // missing n
    assert.ok(validate(SCHEMA, { questions: [], n: 1, extra: true }).length); // not allowed
    assert.ok(validate({ type: 'string', enum: ['a', 'b'] }, 'c').length);
  });
});

describe('callJSON', () => {
  const env = {};
  let calls;
  const answers = [];
  beforeEach(() => {
    Object.assign(env, { LLM_API_KEY: process.env.LLM_API_KEY, LLM_MODEL: process.env.LLM_MODEL, LLM_PROVIDER: process.env.LLM_PROVIDER });
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    delete process.env.LLM_PROVIDER;
    calls = [];
    answers.length = 0;
    global.fetch = async (url, init) => {
      calls.push(JSON.parse(init.body));
      const content = answers.shift();
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
    };
  });
  afterEach(() => {
    for (const k of Object.keys(env)) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
    delete global.fetch;
  });
  const job = { system: 's', user: 'u', name: 'job', schema: SCHEMA };

  it('returns a checked answer, sending the model name from the environment', async () => {
    answers.push(JSON.stringify({ questions: ['Why?'], n: 2 }));
    const out = await require('../src/llm').callJSON(job);
    assert.deepEqual(out, { questions: ['Why?'], n: 2 });
    assert.equal(calls[0].model, 'test-model');
    assert.equal(calls[0].response_format.type, 'json_schema');
  });

  it('retries once on an answer that does not fit, then uses the second answer', async () => {
    answers.push(JSON.stringify({ questions: 'nope', n: 1 }), JSON.stringify({ questions: ['Fine?'], n: 1 }));
    const out = await require('../src/llm').callJSON(job);
    assert.equal(out.questions[0], 'Fine?');
    assert.equal(calls.length, 2);
  });

  it('throws after two misses, so nothing invalid is ever applied', async () => {
    answers.push('not json', JSON.stringify({ n: 1 }));
    await assert.rejects(require('../src/llm').callJSON(job), /did not match the schema/);
    assert.equal(calls.length, 2);
  });

  it('throws at once with no key or no model name, without calling the network', async () => {
    delete process.env.LLM_MODEL;
    await assert.rejects(require('../src/llm').callJSON(job), /LLM_MODEL/);
    process.env.LLM_MODEL = 'm';
    delete process.env.LLM_API_KEY;
    await assert.rejects(require('../src/llm').callJSON(job), /LLM_API_KEY/);
    assert.equal(calls.length, 0);
  });

  it('LLM_PROVIDER=none turns the model off', async () => {
    process.env.LLM_PROVIDER = 'none';
    await assert.rejects(require('../src/providers/llm').callJSON(job), /No LLM provider/);
    assert.equal(require('../src/providers/llm').isConfigured(), false);
  });
});
