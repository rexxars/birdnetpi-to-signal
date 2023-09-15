const os = require('os')
const express = require('express')
const bodyParser = require('body-parser')
const {notificationController} = require('./controller')
const config = require('./config')

if (!config.fromNumber) {
  throw new Error('Missing FROM_NUMBER environment variable')
}

if (!config.recipients.length) {
  throw new Error('Missing RECIPIENTS environment variable')
}

const app = express()

app.disable('x-powered-by')
app.enable('trust proxy')

app.use((req, res, next) => {
  res.set('x-served-by', os.hostname())
  next()
})

app.get('/', (req, res) => res.type('text/plain').send('Please use POST'))
app.post('/', bodyParser.json({limit: '1mb'}), notificationController)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).send('Internal Server Error!')

  setImmediate(() => {
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  })
})

exports.app = app
