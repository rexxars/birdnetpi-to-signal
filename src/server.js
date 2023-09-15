/* eslint-disable no-console */
const {app} = require('./index')
const {httpPort} = require('./config')

app.listen(httpPort, '0.0.0.0', () => {
  console.log('Server listening on http://localhost:3000/')
})
