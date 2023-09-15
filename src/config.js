// @ts-check
/* eslint-disable no-process-env */
module.exports = {
  // URL for the Dockerized Signal Messenger REST API
  // See https://github.com/bbernhard/signal-cli-rest-api
  signalApiUrl: process.env.SIGNAL_API_URL || 'http://signal-api',
  fromNumber: process.env.FROM_NUMBER,
  recipients: (process.env.RECIPIENTS || '').split(/,\s*/).filter(Boolean),
  httpPort: parseInt(process.env.HTTP_PORT || '3000', 10),
  returnEarly: parseBool(process.env.RETURN_EARLY),
  includeRecording: parseBool(process.env.INCLUDE_RECORDING),
}

function parseBool(envVar) {
  if (envVar === 'true' || envVar === '1' || envVar === 'on') return true
  return false
}
