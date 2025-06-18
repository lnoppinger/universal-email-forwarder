import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import 'dotenv/config'
import capcon from 'capture-console'



// Envrionment variables setup
if(process.env.IMAP_PORT      == null || isNaN(Number(process.env.IMAP_PORT      ))) process.env.IMAP_PORT      = "993"
if(process.env.SMTP_PORT      == null || isNaN(Number(process.env.SMTP_PORT      ))) process.env.SMTP_PORT      = "587"
if(process.env.CHECK_INTERVAL == null || isNaN(Number(process.env.CHECK_INTERVAL ))) process.env.CHECK_INTERVAL = "1"
if(process.env.MAX_LOG_CHARS  == null || isNaN(Number(process.env.MAX_LOG_CHARS ))) process.env.MAX_LOG_CHARS   = "5000"

process.env.IMAP_SECURE = String(process.env.IMAP_SECURE == null || process.env.IMAP_SECURE.toLowerCase() == "true")
process.env.SMTP_SECURE = String(process.env.SMTP_SECURE == null || process.env.SMTP_SECURE.toLowerCase() == "true")

let envKeys = [
    "EMAIL",
    "IMAP_PASSWORD",
    "IMAP_HOST",
    "IMAP_PORT",
    "IMAP_SECURE",
    "SMTP_PASSWORD",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "CHECK_INTERVAL",
    "MAX_LOG_CHARS"
]

let envConfig = {}
envKeys.forEach(key => {
    if(process.env[key] == null) throw Error(`Envrionment Variable '${key}' not set.`)
    envConfig[key] = process.env[key]
})

envConfig.FORWARD_RULES = {}
for(let key in process.env) {
  if(key.substring(0, 13) != "FORWARD_RULE_") continue
  let values = process.env[key].replace(/\s/g, "").split(":")
  let emailKey = values.shift()
  envConfig.FORWARD_RULES[emailKey] = values
}

envConfig.FORWARD_DEFAULT = process.env["FORWARD_DEFAULT"]?.replace(/\s/g, "")?.split(":") || []
envConfig.FORWARD_ERROR   = process.env["FORWARD_ERROR"  ]?.replace(/\s/g, "")?.split(":") || []

console.log("[INFO]", envConfig)



// Error email setup
let lastLogs = ""
capcon.startCapture(process.stdout, stdout => {
  stdout = stdout.replace(/\x1b\[[0-9;]*m/g, '')

  let date = (new Date())
  let timestamp = "[" + (new Date()).toISOString().replace('T', ' ').slice(0, 19) + "] "
  if(stdout.substring(0, 5) != "[" + date.getFullYear()) stdout = timestamp + stdout

  lastLogs = stdout + lastLogs
  lastLogs = lastLogs.substring(0, Number(envConfig.MAX_LOG_CHARS))
})

async function reportError(err) {
  try {
    let smtp = nodemailer.createTransport(smtpOptions)
    for(let sendTo of envConfig.FORWARD_ERROR) {
      await smtp.sendMail({
        from: envConfig.EMAIL,
        to: sendTo,
        subject: "Runtime Error in universal-email-forwarder",
        text: 

`Dear Maintainer,

your universal-email-forwarder service for '${envConfig.EMAIL}' exited early because of an error.
No worries, the service will retry forwarding emails in ${envConfig.CHECK_INTERVAL} Minute(s).

Please adjust your configuration or open an issue at https://github.com/lnoppinger/universal-email-forwarder/issues.


Reason for early exit:
${err.stack}


Logs:
${lastLogs}
-- No further Logs available --


If the log output is too short, simply raise the number of characters stored (Envrionment variable MAX_LOG_CHARS).


Sincerely yours

universal-email-forwarder`

      })
    }
  } catch (e) {
    console.error("[Error]", e)
  }
}



// Configurations
const customLogger = {
  debug: msg => console.debug("[DEBUG]", JSON.stringify(msg, null, 0)),
  info: msg => console.log("[INFO]", JSON.stringify(msg, null, 0)),
  warn: msg => console.warn("[WARN]", msg),
  error: msg => console.error("[ERROR]", msg),
}

const imapOptions = {
  host: envConfig.IMAP_HOST,
  port: Number(envConfig.IMAP_PORT),
  secure: envConfig.IMAP_SECURE == "true",
  auth: {
    user: envConfig.EMAIL,
    pass: envConfig.IMAP_PASSWORD
  },
  logger: customLogger,
  debug: true
}
let imap

const smtpOptions = {
  host: envConfig.SMTP_HOST,
  port: Number(envConfig.SMTP_PORT),
  secure: envConfig.SMTP_SECURE == "true",
  auth: {
    user: envConfig.EMAIL,
    pass: envConfig.SMTP_PASSWORD
  },
  logger: customLogger,
  // debug: true
}

let lock

process.on('SIGINT', async () => {
  lock?.release()
  await imap?.logout()
  process.exit()
})



// Core script
setInterval(run, Number(envConfig.CHECK_INTERVAL)*60*1000)
run()

async function run() {
  try {

    let smtp = nodemailer.createTransport(smtpOptions)
    imap = new ImapFlow(imapOptions)
    await imap.connect()
    lock = await imap.getMailboxLock('INBOX')

    // Delete old read emails (90 Days)
    let thresholdDate =(new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
    let oldUids = await imap.search({
      seen: true,
      before: thresholdDate
    })
    if(oldUids.length > 0) {
      for (let uid of oldUids) {
        await imap.messageDelete(uid)
      }
      console.log("[INFO]", `Deleted ${oldUids.length} read or forwarded emails older than 90 days.`)
    }

    // Forward messages
    let uids = await imap.search({ seen: false })
    let sentUids = []

    if(uids.length <= 0) return

    for(let uid of uids) {
      try {
        for await (const msg of imap.fetch(uid, { envelope: true, uid: true, flags: true, source: true })) {
          let parsed = await new Promise( (resolve, reject) => {
            simpleParser(msg.source, (err, mail) => {
              if(err) reject(err)
              resolve(mail)
            })
          })
          let toAddr = parsed.to?.value?.[0]?.address?.toLowerCase()

          let forwardToArr = envConfig.FORWARD_RULES[toAddr] || envConfig.FORWARD_DEFAULT
          for(let forwardTo of forwardToArr) {
            await smtp.sendMail({
              from: toAddr,
              to: forwardTo,
              subject: parsed.subject,
              text: parsed.text,
              html: parsed.html,
              attachments: parsed.attachments,
              replyTo: parsed.from.text
            })
            console.log("[INFO]", `Forwarded email #${uid} | ${toAddr} → ${forwardTo} | ${parsed.subject}`)
          }
          
          sentUids.push(msg.seq)
        }

      } catch(e) {
        console.warn("[WARN]", "Failed to send email, Reason: \n", e)
        reportError(e)
      }
    }
    console.log("[INFO]", "All emails sent.")

    
    for (let uid of sentUids) {
      await imap.messageFlagsSet(uid, ['\\Seen'])
    }
    console.log("[INFO]", `Set /seen flag for ${sentUids.length} emails.`)

  } catch (err) {
    console.error("[ERROR]", err)
    reportError(err)

  } finally {
    lock?.release()
    await imap?.logout()
  }
}