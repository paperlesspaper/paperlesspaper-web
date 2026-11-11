# Telegram Open Integration

Telegram bot logic, settings, pairing, webhook registration and deployment now
live in the private `paperlesspaper/paperlesspaper-telegram` repository.

The host provides the provider-independent [paper content push protocol](./open-integration-content-push.md).
The Telegram integration connects to a **paper**, shared by its assigned frames.
All users use the same bot and configure their connection inside their own paper.

Deploy both host changes and the Telegram service, configure the bot's credentials
only on that service, register its `/api/telegram/webhook`, and connect each paper
through the integration's settings page.
