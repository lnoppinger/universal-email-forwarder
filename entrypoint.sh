#!/bin/sh

: "${CRON_INTERVAL:=5}"

# Cronjob schreiben, Ausgabe ins Docker-Log
echo "*/$CRON_INTERVAL * * * * cd /app && node index.mjs >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

echo "[INFO] Führe index.js einmalig sofort aus..."
node /app/index.mjs

echo "[INFO] Starte Cron alle $CRON_INTERVAL Minuten..."
crond -f -l 2
