FROM node:20-alpine

# Install cron and bash
RUN apk add --no-cache dumb-init curl bash busybox-suid

WORKDIR /app
COPY . .

# Install dependencies
RUN npm install imap-simple nodemailer mailparser dotenv

# Start script to write cronjob and start cron
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]