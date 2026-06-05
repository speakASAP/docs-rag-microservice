# Helpdesk ticket body encoding

## Decoding fixes (2026-03)

Ticket display and ingestion were updated to prevent decoding errors (e.g. German "März" showing as "Mrz", misplaced punctuation ", Iryna!").

### Code changes

- **`helpdesk/views._decode_body_bytes`**: Tries `cp1252` and `iso-8859-1` in addition to utf-8, iso-8859-2, cp1250, cp1251, latin-1 so Western European text (e.g. German) decodes correctly from raw MIME.
- **`helpdesk/views.extract_body_from_raw_mime`**: Tries **`email.message_from_bytes`** (`email` + `policy.default`) first so nested multipart and parts with many headers (e.g. `Content-Transfer-Encoding`) decode correctly. The previous regex-only path assumed at most two header lines after each boundary, which often produced empty bodies or boundary debris (e.g. `——=`). The regex path remains as fallback.
- **`helpdesk/views.decode_email_body`**: Uses `_decode_body_bytes()` for both quoted-printable and base64 paths instead of hardcoded `utf-8`, so the best charset is chosen (fewest replacement characters).
- **`helpdesk/tasks.py`**: Typo fix: use `raw_content_base64` when calling `extract_body_from_raw_mime` in the short-body recovery path.
- **`helpdesk/models.py`**: In `Ticket.create`, body is normalized before save: bytes are decoded as UTF-8, then `try_fix_mojibake_utf8` is applied so contact-form and other user-submitted bodies are stored in correct encoding.

### Recovering already-corrupted tickets

If a ticket was stored with wrong decoding (e.g. [ticket 221229](https://speakasap.com/helpdesk/tickets/221229/)), re-extract the body from the notifications service raw MIME. After deploying the above fixes, run:

```bash
python manage.py recover_ticket_body 221229
```

This fetches the original email from the notifications DB/API and re-extracts the body using the improved decoding. Requires notifications DB connection or `NOTIFICATION_SERVICE_URL`. If the API returns 401, set `NOTIFICATION_SERVICE_AUTH_TOKEN` in the environment.

**Contact-form tickets (e.g. 221229, `message_id` starts with `support_`):** They are not in the notifications inbound API. The command will still run a **repair** step: apply mojibake fix and decode_email_body to the stored body and save if improved. Use `--repair` to force repair for any ticket when API/DB recovery fails.
