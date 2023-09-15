/* eslint-disable camelcase */
const {fetch} = require('undici')
const {signalApiUrl, fromNumber, recipients} = require('./config')

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.isValidationError = true
  }
}

exports.notificationController = async (req, res) => {
  try {
    const data = validateData(req.body)
    const uri = `${signalApiUrl.replace(/\/+$/, '')}/v2/send`
    fetch({url: new URL(uri), method: 'POST', body: await getPayload(data)})
    res.json({success: true})
  } catch (err) {
    const isValidationError = 'isValidationError' in err
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

async function getPayload(data) {
  const attachments = []
  if (data.attachment.length > 0) {
    const img = data.attachments[0]
    attachments.push(
      img.base64.startsWith('data:')
        ? img.base64
        : `data:${img.mimetype};base64,${img.base64}`,
    )
  }

  const pairs = data.message.split(' --- ').reduce((acc, pair) => {
    const [key, ...values] = pair.split('=')
    acc[key] = values.join('=')
    return acc
  }, {})

  if (pairs.listenurl) {
    pairs.listenurl = pairs.listenurl.replace(/\/\+\?filename=/, '/?filename=')
  }

  const listenUrl = new URL(pairs.listenurl)
  const filename = listenUrl.searchParams.filename
  const [folder] = filename.split(/-\d+-/)
  const recordingUrl = `${listenUrl.origin}/By_Date/${pairs.date}/${folder}/${filename}`

  try {
    const recording = await fetch(recordingUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => Buffer.from(buffer).toString('base64'))

    attachments.push(`data:audio/mpeg;base64,${recording}`)
  } catch (err) {
    console.warn(err)
  }

  let message = `A ${pairs.comname} (${pairs.sciname}) was just detected with a confidence of ${data.confidencepct}%`
  if (pairs.flickrimage) {
    message = +'\n\n' + pairs.flickrimage
  }

  return JSON.stringify({
    base64_attachments: attachments.length > 0 ? attachments : undefined,
    message,
    number: fromNumber,
    recipients,
  })
}