// services/bridge/src/bhashini.js — the one place that talks to Bhashini
// Two steps per task: a config call (which model, which URL, which key), then a compute call.
const CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const PIPELINE_ID = process.env.BHASHINI_PIPELINE_ID || '64392f96daac500b55c543cd';   // MeitY pipeline
const ONE_HOUR = 60 * 60 * 1000;

const configCache = new Map();                   // "asr:ta" -> { at, serviceId, url, authName, authValue }

async function getConfig(taskType, language) {
  const cacheKey = `${taskType}:${language.sourceLanguage}:${language.targetLanguage || ''}`;
  const hit = configCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ONE_HOUR) return hit;

  if (!process.env.BHASHINI_USER_ID || !process.env.BHASHINI_ULCA_API_KEY)
    throw new Error('BHASHINI_USER_ID or BHASHINI_ULCA_API_KEY is not set');

  const res = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: {
      userID: process.env.BHASHINI_USER_ID,
      ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pipelineTasks: [{ taskType, config: { language } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Bhashini config ${res.status}: ${await res.text()}`);
  const body = await res.json();

  const serviceId = body.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const endpoint = body.pipelineInferenceAPIEndPoint;
  if (!serviceId || !endpoint) throw new Error(`Bhashini has no ${taskType} model for ${language.sourceLanguage}`);

  const config = {
    at: Date.now(),
    serviceId,
    url: endpoint.callbackUrl,
    authName: endpoint.inferenceApiKey.name,
    authValue: endpoint.inferenceApiKey.value,
  };
  configCache.set(cacheKey, config);
  return config;
}

async function compute(config, taskConfig, inputData) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { [config.authName]: config.authValue, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipelineTasks: [{ ...taskConfig, config: { ...taskConfig.config, serviceId: config.serviceId } }],
      inputData,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Bhashini compute ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.pipelineResponse[0].output[0];
}

// Speech to text. audioBase64 must be WAV (or FLAC) that really has this sampling rate.
async function transcribe({ audioBase64, language, audioFormat = 'wav', samplingRate = 16000 }) {
  const lang = { sourceLanguage: language };
  const config = await getConfig('asr', lang);
  const out = await compute(
    config,
    { taskType: 'asr', config: { language: lang, audioFormat, samplingRate } },
    { audio: [{ audioContent: audioBase64 }] }
  );
  return out.source;
}

// Text to text, e.g. Tamil ('ta') to English ('en').
async function translate({ text, from, to = 'en' }) {
  const lang = { sourceLanguage: from, targetLanguage: to };
  const config = await getConfig('translation', lang);
  const out = await compute(
    config,
    { taskType: 'translation', config: { language: lang } },
    { input: [{ source: text }] }
  );
  return out.target;
}

module.exports = { transcribe, translate };
