# Universal Email Forwarder

This self-hosted docker-container connects to a existing mail-server and forwards all emails send to this inbox based on the rules you provide.

## Installation

```
version: '3'

services:
  forwarder:
    build: https://github.com/lnoppinger/universal-email-forwarder

    environment:
      - EMAIL=name@example.com

      - IMAP_PASSWORD=supersafeimappassword
      - IMAP_HOST=imap.mailprovider.com
      - IMAP_PORT=993                           # opt
      - IMAP_SECURE=true                        # opt

      - SMTP_PASSWORD=supersafesmptpassword
      - SMTP_HOST=smtp.mailprovider.com
      - SMTP_PORT=587                           # opt
      - SMTP_SECURE=true                        # opt

      - CHECK_INTERVAL=1                        # opt (in Minutes)
      - MAX_LOG_CHARS=5000                      # opt (Length of log displayed in error email)
      - FORWARD_ERROR=maintainer-Mailbox@some-tec-support.de                             # opt
      - FORWARD_DEFAULT=mailbox-if-nothing-else-matched@something.com                    # opt

      - FORWARD_RULE_0=foo@example.com : foooooo@another.com                             # opt
      - FORWARD_RULE_1=bar@example.com : baaaaaaar@anotheranother.de : another@email.de  # opt
      - FORWARD_RULE_BAZ=baz@example.com:baaaaaaz@another.com:baz2@some-other-email.com  # opt
          # The X in FORWARD_RULE_X can be any combination and length of [A-Z][a-z][0-9]

      # variables with   # opt   is configured with those default values; those can be omitted

    restart: unless-stopped
```

## Workflow
- A email is sent to the inbox
- The service searches for unread messages
- The 'sent_to' email address is compared to the rules set by FORWARD_RULE_X. In every rule all entries are separated by : (whitespaces are ignored). The frist entry is compared to the 'sent_to' address.
- If no rule matched, FORWARD_DEFAULT is used. 
- After that the email is forwarded to all subsequent entries in the matched rule.
- Those steps will be repeated until all unread emails are forwarded.
- Then all forwarded emails are set to 'seen'
- If any error occured, a email is sent to the addresses set with FORWARD_ERROR, containing the error and the current logs.