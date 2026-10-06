# Bhashini — endpoints and pipeline

Used only by `services/bridge` (see [src/bhashini.js](../services/bridge/src/bhashini.js)).

These values are public and safe to commit. The secret values (`BHASHINI_USER_ID`,
`BHASHINI_ULCA_API_KEY`) go only in `services/bridge/.env` and the Render environment, never in this file.

| Name | Value | What it is |
|---|---|---|
| `BHASHINI_PIPELINE_SRC` | `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline` | Config call: send `userID` and `ulcaApiKey` headers, get back the `serviceId` and an inference key |
| `BHASHINI_INFERENCE` | `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` | Compute call: send the audio or text with the inference key from the config call |
| `BHASHINI_PIPELINE_ID` | `64392f96daac500b55c543cd` | The MeitY pipeline (ASR, translation, TTS) |

## How the two calls fit together

1. **Config call** to `BHASHINI_PIPELINE_SRC` with the task (`asr` or `translation`), the language
   (`ta`, `hi`, `en`) and `BHASHINI_PIPELINE_ID`. The response gives the `serviceId`, the inference
   URL (`callbackUrl`, which is `BHASHINI_INFERENCE`) and the inference key (`Authorization` header).
   The code caches this for one hour per task and language.
2. **Compute call** to `BHASHINI_INFERENCE` with that header, the `serviceId` and the input:
   - Speech to text: `inputData.audio[0].audioContent` = base64 WAV, 16 000 Hz, mono.
   - Translation: `inputData.input[0].source` = the text.

The answer is in `pipelineResponse[0].output[0]`: `.source` for speech to text, `.target` for translation.
