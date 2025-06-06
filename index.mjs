import imaps from 'imap-simple'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import 'dotenv/config'

let envKeys = [
    "USERNAME",
    "IMAP_PASSWORD",
    "IMAP_HOST",
    "SMTP_PASSWORD",
    "SMTP_HOST",
    "FORWARD_RULE_1",
    "FORWARD_DEFAULT"
]
envKeys.forEach(key => {
    if(process.env[key] == null) throw Error(`Envrionment Variable '${key}' not set.`)
    console.log(process.env[key])
})

if(process.env.IMAP_PORT == null) process.env.IMAP_PORT = "993"
if(process.env.SMTP_PORT == null) process.env.SMTP_PORT = "587"

process.env.IMAP_SECURE = process.env.IMAP_SECURE == null || process.env.IMAP_SECURE.toLowerCase() == "true"
process.env.SMTP_SECURE = process.env.SMTP_SECURE == null || process.env.SMTP_SECURE.toLowerCase() == "true"

const imapConnection = await new Promise( (resolve, reject) => {
    imaps.connect({
        imap: {
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASSWORD,
            host: process.env.IMAP_HOST,
            port: Number(process.env.IMAP_PORT),
            tls: process.env.IMAP_SECURE,
            authTimeout: 5000
        }
    })
    .then(conn => resolve(conn))
    .catch(err => reject(err))
})
await imapConnection.openBox('INBOX')
const messages = await imapConnection.search(['UNSEEN'], { bodies: [''], markSeen: true })

if(messages < 1) {
    imapConnection.end()
    process.exit(0)
}

let forwardMap = {}
process.env.forEach(key => {
    if(key.substring(0, 13) == "FORWARD_RULE_") forwardMap[key.toLowerCase()] = process.env[key]
})

for (const message of messages) {
    try {
        const all = message.parts.find(part => part.which === '')
        const parsed = await simpleParser(all.body)

        const recipient = parsed.to.value[0].address
        let target = forwardMap[recipient.toLowerCase()]
        if (target == null) target = process.env.FORWARD_DEFAULT

        nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            }
        }).sendMail({
            from: parsed.from.text,
            to: target,
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html,
        })
        console.log(`Forwarded email for ${target}: ${parsed.subject}`)

    } catch(e) {
        console.error(e)
    }
}

imapConnection.end()