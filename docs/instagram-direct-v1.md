# Instagram Direct V1

This increment prepares Instagram Direct as a `CHATWOOT` integration inside the existing eChat Inbox. It does not create a second provider, scrape Instagram, store provider credentials in the browser, or enable outbound delivery globally.

## Supported path

```text
Instagram Professional -> Meta API -> Chatwoot Instagram Inbox -> Chatwoot webhook -> eChat API -> PostgreSQL -> Inbox/CRM
```

The connection is configured under **Canais** by selecting `Instagram`, the Chatwoot account and the exact Instagram inbox. The read-only check must validate the account, inbox ID, inbox channel type, accessible conversations and the expected eChat webhook before the integration can be considered connected.

The eChat webhook is distinct from Meta's callback into Chatwoot. Chatwoot's documented Instagram Business Login setup uses `/webhooks/instagram` for the Meta webhook callback and `/instagram/callback` for the login redirect; it also documents the `messages`, `messaging_seen` and `message_reactions` subscriptions and requires a live Meta app mode for delivery. See the [Chatwoot Instagram Business Login guide](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/instagram-via-instagram-business-login/).

## V1 behavior

- Instagram messages are routed by organization, Chatwoot account, inbox ID and channel type.
- Text and media-only messages are retained; media metadata is stored without downloading provider files.
- Images, video, audio and generic files are rendered only when the provider supplies an HTTP(S) URL. Unsupported or expired URLs show a safe unavailable state.
- Provider/inbox-specific identities are used for contacts; a global Instagram identifier is never used as a tenant-wide key.
- Webhook delivery IDs, external message IDs and channel connection scope preserve idempotency.
- Synchronization uses provider pagination metadata, has a hard page limit, and preserves prior data when a run fails.
- External sending remains controlled by `ECHAT_OUTBOUND_MODE` and the pilot conversation allowlist. The default remains disabled.

## Human setup still required

No Meta or Chatwoot credentials are committed or fabricated. A real qualification requires a dedicated Instagram Professional test account, a Meta app, the Instagram product and current permissions, authorized testers/app roles, Chatwoot Instagram app configuration, a reachable HTTPS callback and the exact Chatwoot account/inbox IDs.

The current official Meta Instagram Login collection lists `instagram_business_basic` and `instagram_business_manage_messages` for the messaging path; it also documents that the Instagram Login setup does not require a linked Facebook Page. Confirm current access level and review requirements in the Meta dashboard before requesting production access. See the [official Meta Instagram API collection](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

Real inbound and outbound gates are therefore reported as `NOT_TESTED_NO_CREDENTIALS` until those human prerequisites are supplied. Do not use a customer account, enable global outbound, or register callbacks against production during the lab qualification.

## Qualification checklist

1. Configure the dedicated Meta/Chatwoot test assets and HTTPS callbacks.
2. Save the Chatwoot Instagram inbox in **Canais** and run the read-only test.
3. Confirm a signed Chatwoot webhook is accepted only for the configured account and inbox.
4. Send one authorized inbound test message and verify persistence, contact identity, media metadata and Inbox display.
5. Replay the delivery and verify no duplicate message.
6. Enable outbound only for the explicit pilot conversation, send one neutral reply, verify delivery, and restore the safe mode.
7. Run the complete typecheck, unit, PostgreSQL integration, build and browser QA gates.
