// @ts-check
/* eslint-disable no-console */
const {fetch} = require('undici')
const {createApi} = require('unsplash-js')
const {
  attachRecording,
  fromNumber,
  recipients,
  returnEarly,
  signalApiUrl,
  slackWebhookUrl,
  unsplashApiKey,
} = require('./config')

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.isValidationError = true
  }
}

const unsplash =
  unsplashApiKey &&
  createApi({
    accessKey: 'Br0dtxPao9dzcFTM41A4ByF7m_g9Nt-m8fRw5vNrv7g',
    fetch,
  })

exports.notificationController = async (req, res) => {
  try {
    const data = validateData(req.body)
    const uri = `${signalApiUrl.replace(/\/+$/, '')}/v2/send`

    if (returnEarly) {
      res.status(201).json({success: null})
    }

    const payload = await getSignalPayload(data)
    const size =
      payload.length > 1024
        ? `${Math.round(payload.length / 1024)} kB`
        : `${payload.length} bytes`
    console.info('Sending message to Signal API (%s)', size)

    const start = Date.now()
    const response = await fetch(uri, {
      method: 'POST',
      body: payload,
    })
    console.info('Message sent - spent %d ms', Date.now() - start)

    trySendSlackWebhookMessage(parseMessage(data.message))

    if (!response.ok && !returnEarly) {
      const resBody = await response.text()
      res.json({success: false, error: resBody})
    } else if (!returnEarly) {
      res.json({success: true})
    }
  } catch (err) {
    const isValidationError = 'isValidationError' in err
    if (isValidationError) {
      console.warn('Validation error:', err.message)
    } else {
      console.error('Error:', err.stack)
    }
    const code = isValidationError ? 400 : 500
    res.status(code).json({
      success: false,
      error: err instanceof Error ? err.message : `${err}`,
    })
  }
}

function validateData(data) {
  if (Array.isArray(data) || typeof data !== 'object' || data === null) {
    throw new ValidationError('Payload must be a JSON object')
  }

  if (typeof data.message !== 'string') {
    throw new ValidationError('`message` must be a string')
  }

  if (!data.message.includes(' --- ')) {
    throw new Error('Message should separate values by --- (see readme)')
  }

  if (!data.message.includes('sciname=')) {
    throw new Error('Message should include key sciname= (see readme)')
  }

  if (typeof data.attachments !== 'undefined') {
    if (!Array.isArray(data.attachments)) {
      throw new Error('`attachments` must be an array')
    }

    data.attachments = data.attachments.filter((attachment) => {
      if (typeof attachment.base64 !== 'string') {
        throw new Error('Missing base64 data in attachment')
      }

      if (typeof attachment.mimetype !== 'string') {
        throw new Error('Missing mime type for attachment')
      }

      return attachment.mimetype.startsWith('image/')
    })
  }

  return data
}

async function getSignalPayload(data) {
  const attachments = []
  if (data.attachments && data.attachments.length > 0) {
    const img = data.attachments[0]
    attachments.push(
      img.base64.startsWith('data:')
        ? img.base64
        : `data:${img.mimetype};base64,${img.base64}`,
    )
  }

  const pairs = parseMessage(data.message)
  const recording = await tryGetRecording(pairs.listenurl, pairs.date)

  let recordingUrl
  if (pairs.listenurl) {
    if (recording && recording.type === 'embed') {
      recordingUrl = recording.url
    } else if (recording && recording.type === 'attach') {
      attachments.push(recording)
    }
  }

  const confidence =
    pairs.confidencepct || parseFloat(pairs.confidence).toFixed(2)

  const prefix = pairs.comname.toLowerCase().startsWith('a') ? 'An' : 'A'
  let message = `${prefix} ${pairs.comname} (${pairs.sciname}) was just detected with a confidence of ${confidence}%`
  if (recordingUrl) {
    message = `${message}\n\nListen: ${recordingUrl}`
  }

  if (pairs.flickrimage) {
    message = `${message}\n\n${pairs.flickrimage}`
  }

  return JSON.stringify({
    // eslint-disable-next-line camelcase
    base64_attachments: attachments.length > 0 ? attachments : undefined,
    message,
    number: fromNumber,
    recipients,
  })
}

function getRecordingUrl(listenUrl, date) {
  try {
    const url = new URL(listenUrl)
    const filename = url.searchParams.get('filename')
    if (!filename) {
      return undefined
    }

    const [folder] = filename.split(/-\d+-/)
    return `${url.origin}/By_Date/${date}/${folder}/${filename}`
  } catch (err) {
    return undefined
  }
}

async function tryGetRecording(listenUrl, date) {
  try {
    const recordingUrl = getRecordingUrl(listenUrl, date)
    if (!recordingUrl) {
      return undefined
    }

    if (!attachRecording) {
      return {type: 'embed', url: recordingUrl}
    }

    console.info('Attempting fetch recording from ', recordingUrl)
    const recording = await fetch(recordingUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => Buffer.from(buffer).toString('base64'))

    return {
      type: 'attach',
      data: `data:audio/mpeg;base64,${recording}`,
      url: recordingUrl,
    }
  } catch (err) {
    console.warn('Failed to get recording: ', err.stack)
  }

  return undefined
}

async function tryGetUnsplashImage(name) {
  if (!unsplash) {
    return undefined
  }

  try {
    const response = await unsplash.search.getPhotos({
      query: name,
      page: 1,
      perPage: 5,
    })

    const photos = response.response?.results
    return photos && photos.length > 0 ? photos[0].urls.regular : undefined
  } catch (err) {
    return undefined
  }
}

async function trySendSlackWebhookMessage(pairs) {
  if (!slackWebhookUrl) {
    return
  }

  const imageUrl = await tryGetUnsplashImage(pairs.comname)
  const recordingUrl = getRecordingUrl(pairs.listenurl, pairs.date)
  const confidence =
    pairs.confidencepct || parseFloat(pairs.confidence).toFixed(2)

  const prefix = pairs.comname.toLowerCase().startsWith('a') ? 'An' : 'A'
  const text = `${prefix} *${pairs.comname}* (_${pairs.sciname}_) was just detected with a confidence of *${confidence}%*.`

  const res = await fetch(slackWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      /* eslint-disable camelcase */
      blocks: [
        imageUrl && {
          type: 'image',
          title: {
            type: 'plain_text',
            text: pairs.comname,
            emoji: false,
          },
          image_url: imageUrl,
          alt_text: pairs.comname,
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
          accessory: recordingUrl && {
            type: 'button',
            url: recordingUrl,
            accessibility_label: 'Listen to recording',
            text: {
              type: 'plain_text',
              text: 'Listen',
              emoji: false,
            },
          },
        },
      ].filter(Boolean),
      /* eslint-enable camelcase */
    }),
  })

  if (!res.ok || res.status >= 400) {
    console.warn('Failed to send Slack webhook message: ', res.status)
  }
}

function parseMessage(message) {
  return message
    .replace(/\s*\(first time today\)/, '')
    .split(' --- ')
    .reduce((acc, pair) => {
      const [key, ...values] = pair.split('=')
      acc[key] = values.join('=')
      return acc
    }, {})
}
