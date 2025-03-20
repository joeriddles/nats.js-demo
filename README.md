# nats.js demo

Simple demo of [nat.js](https://github.com/nats-io/nats.js/) with [Synadia Cloud / NGS](https://docs.synadia.com/cloud/faq).

Setup:
```shell
npm install
```

To run:
```shell
node main.mjs <nats_creds_file>
```

Alternatively, you can run it with the `NATS_CREDS` environment variable:
```shell
NATS_CREDS='...' node main.mjs
# or even...
NATS_CRESDS="$(cat <nats_creds_file>)" node main.mjs
```

Expected output:
```
connected: connect.ngs.global:4222
>>> hello world
<<< hello world
---
connected: jetstream
created stream: users
created durable consumer: user-consumer
>>> 1 data
<<< 1 {"user_id":1}
```

Synadia Cloud — create stream:
![Synadia Cloud stream screenshot](./static/cloud.png)

Docs:
- https://nats-io.github.io/nats.js/
- https://github.com/nats-io/nats.js/
- https://docs.synadia.com/cloud/faq
