#!/usr/bin/env node

import * as fs from "node:fs"
import { argv, exit, env } from "node:process"

import { credsAuthenticator } from "@nats-io/nats-core";
import { jetstream, jetstreamManager, AckPolicy } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";

if (argv.length < 3 && !env.NATS_CREDS) {
  console.error('creds_file or env.NATS_CREDS is required')
  console.error(`usage: node main.mjs <creds_file>`)
  exit(1)
}

let creds
if (argv.length >= 3) {
  const [_node, _file, credsFile] = argv
  creds = fs.readFileSync(credsFile, 'utf8');
} else {
  creds = env.NATS_CREDS
}

const connOpts = {
  servers: ['nats://connect.ngs.global'],
  // debug: true, // uncomment this for more verbose output, especially helpful when running into connection errors
  name: 'node/main.mjs',
  authenticator: undefined,
};

const authenticator = credsAuthenticator(new TextEncoder().encode(creds));
connOpts.authenticator = authenticator;

(async () => {
  // Connect Core NATS
  let nc;
  try {
    nc = await connect(connOpts);
  } catch (err) {
    console.error(`error connecting to nats: ${err.message}`);
    return;
  }
  console.info(`connected: ${nc.getServer()}`);

  // Test Core NATS
  const sub = nc.subscribe('hello', {
    callback: (err, msg) => {
      if (err) {
        console.error(err)
      }
      console.log(`<<< ${msg.subject} ${msg.data}`)
    }
  })
  nc.publish('hello', 'world')
  console.log('>>> hello world')
  await sub.drain()

  // Connect JetStream
  console.log('---')

  const js = jetstream(nc);
  let jsm;
  try {
    jsm = await jetstreamManager(nc);
  } catch (err) {
    console.error(`error connecting to jetstream: ${err.message}`)
  }
  console.info('connected: jetstream')

  // Create a stream
  let streamInfo;
  try {
    streamInfo = await jsm.streams.add({
      name: 'users',
      subjects: [
        'user-delete-account-request'
      ],
      max_bytes: 1_000_000, // 1MB
    })
  } catch (err) {
    console.error(`failed to create stream: ${err.message}`)
  }
  console.info('created stream: users')

  // Get a consumer
  const getOrCreateConsumer = async() => {
    try {
      return await js.consumers.get(streamInfo.config.name, 'user-consumer')
    } catch (err) {
      if (err.name !== 'ConsumerNotFoundError') {
        throw err
      }

      // create consumer  
      const consumerInfo = await jsm.consumers.add(streamInfo.config.name, {
        durable_name: "user-consumer",
        ack_policy: AckPolicy.Explicit,
      });
      console.info(`created durable consumer: ${consumerInfo.config.name}`)
      return await getOrCreateConsumer()
    }
  }
  const consumer = await getOrCreateConsumer()

  // Public a message to the stream
  const data = JSON.stringify({ user_id: 1 })
  const ack = await js.publish('user-delete-account-request', data, {
    timeout: 10_000,
  })
  console.info(`>>> ${ack.seq} data`)

  // Consumer message that was just published
  const messages = await consumer.consume()
  for await (const msg of messages) {
    console.log(`<<< ${msg.seq} ${msg.data}`)
    msg.ack()

    if (msg.seq === ack.seq) {
      break
    }
  }

  // Close everything
  await nc.close()
  }) ()
