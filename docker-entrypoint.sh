#!/bin/sh

if [ "$SERVICE_TYPE" = "WORKER" ]; then
  echo "Starting BullMQ Worker..."
  exec node dist/infrastructure/background-jobs/worker.js
else
  echo "Starting API..."
  exec node dist/server.production.js
fi