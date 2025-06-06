# Universal Email Forwarder

This self-hosted docker-container connects to a existing mail-server and forwards all emails send to this inbox based on the rules you provide.

## Installation

```
version: '3'
services:
  forwarder:
    build: https://github.com/lnoppinger/universal-email-forwarder
    environment:
      - USERNAME=name@example.com
      - IMAP_PASSWORD=supersafeimappassword
      - IMAP_HOST=imap.mailprovider.com
      - IMAP_PORT=993                         # default: 993
      - IMAP_SECURE=true                      # default: true
      - SMTP_PASSWORD=supersafesmptpassword
      - SMTP_HOST=smtp.mailprovider.com
      - SMTP_PORT=587                        # default: 587
      - SMTP_SECURE=true                     # default: true
      - CHECK_INTERVAL=5                     # default: 5 (in Minutes)
      - FORWARD_RULE_1=foo@example.com=foooooo@another.com
      - FORWARD_RULE_2=bar@example.com=baaaaaaar@anotheranother.de
      - FORWARD_RULE_AS_MANY_AS_YOU_NEED=baz@example.com=baaaaaaaaaaz@another.com
      - FORWARD_DEFAULT=mailboxIfNothingElseMatched@something.com
    restart: unless-stopped
```
