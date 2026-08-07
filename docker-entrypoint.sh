#!/bin/sh

if [ "$SERVICE_TYPE" = "WORKER" ]; then
  echo "Registering BullMQ schedulers..."
  npm run scheduler

  echo "Starting BullMQ Worker..."
  exec npm run worker
else
  echo "Starting API..."
  exec node dist/server.production.js
fi