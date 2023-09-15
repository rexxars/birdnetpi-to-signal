# birdnetpi-to-signal

Prettifies notifications from birdnet-pi and sends them to Signal

You will probably have a hard time using this - its mostly built for my own use case. However, _should_ you want to use it, you will need:

- An installation of [BirdNET-Pi](https://github.com/mcguirepr89/BirdNET-Pi/)
- A running and authorized/registerd version of [Dockerized Signal Messenger REST API
  ](https://github.com/bbernhard/signal-cli-rest-api)

Then, you will need to configure the "Notifications" section of BirdNET-Pi to send a notification to a webhook, using the `json://` apprise delivery method. Use `jsons://` if you want to use HTTPS.

The URL to configure in your BirdNET-Pi settings should point to an instance of this application - whether you are running it as a plain Node.js app or through the Docker image (ghcr.io/rexxars/birdnetpi-to-signal:latest). URL would then be something like:

```
json://your-birdnetpi-to-signal-host:3000/
```

The message body needs to include all the details available, but the format is woefully underpowered and kinda brittle. The format I have landed on so far is the following. Use this as the notification body:

```
sciname=$sciname --- comname=$comname --- confidence=$confidence --- confidencepct=$confidencepct --- listenurl=$listenurl --- date=$date --- time=$time --- week=$week --- latitude=$latitude --- longitude=$longitude --- cutoff=$cutoff --- sens=$sens --- overlap=$overlap --- flickrimage=$flickrimage
```

An example payload to this app would then look something like this:

```
sciname=Helopsaltes ochotensis --- comname=Middendorffs Grasshopper Warbler --- confidence=0.8681279 --- confidencepct=87 --- listenurl=http://birdnetpi.local/\\?filename=Middendorffs_Grasshopper_Warbler-87-2023-09-14-birdnet-17:05:24.mp3 --- date=2023-09-14 --- time=17:05:24 --- week=34 --- latitude=37.8841 --- longitude=-122.2647 --- cutoff=0.7 --- sens=1.25 --- overlap=0 --- flickrimage=
```

Which would be parsed to a payload like this:

```js
{
  sciname: 'Helopsaltes ochotensis',
  comname: 'Middendorffs Grasshopper Warbler',
  confidence: '0.8681279',
  confidencepct: '87',
  listenurl: 'http://birdnetpi.local/\\?filename=Middendorffs_Grasshopper_Warbler-87-2023-09-14-birdnet-17:05:24.mp3',
  date: '2023-09-14',
  time: '17:05:24',
  week: '34',
  latitude: '37.8841',
  longitude: '-122.2647',
  cutoff: '0.7',
  sens: '1.25',
  overlap: '0',
  flickrimage: ''
}
```

You'll need to set up a few environment variables:

- `SIGNAL_API_URL` - URL to [Dockerized Signal Messenger REST API
  ](https://github.com/bbernhard/signal-cli-rest-api). Needs to be pre-registered with your Signal account and ready to go.
- `FROM_NUMBER` - The number of your Signal account. Includes country code, e.g. `+15551234567`
- `RECIPIENTS` - Comma-separated list of recipients. Can also be a group ID, eg `group.<someId>` - see the Signal REST API readme for details on how to find the IDs.
- `HTTP_PORT` - Port number for this service. Defaults to 3000.

## License

MIT-licensed. See LICENSE.
