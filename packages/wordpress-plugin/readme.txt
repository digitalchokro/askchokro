=== AskChokro ===
Contributors: digitalchokro
Tags: ai, database, analytics, natural language, sql
Requires at least: 6.0
Tested up to: 6.5
Stable tag: 3.0.0
Requires PHP: 8.0
License: MIT
License URI: https://opensource.org/licenses/MIT

The High-Performance AI Data Engine for WordPress. Add "Ask your data" to your WordPress site in minutes. Engineered for scale, built for enterprise embedding.

== Description ==

AskChokro bridges the gap between Large Language Models and production SQL databases. It translates natural language into Abstract Syntax Trees (AST), rewrites them for strict tenant isolation, and executes them against your database.

Unlike standalone BI tools or external microservices, AskChokro is built natively for seamless integration.

### Core Features

* **AST-Level Security:** Parses AI-generated SQL into an Abstract Syntax Tree. Guaranteed immunity to DROP TABLE, DELETE, or SQL injection.
* **Provider Agnostic:** Supports OpenAI, Anthropic, Google Gemini, Vertex AI, and local Ollama. Avoid vendor lock-in and optimize for cost or latency.
* **High Performance:** Designed to be lightweight and fast for production environments.

### Supported Integrations

* **AI Providers:** OpenAI (gpt-4o), Anthropic (claude-3-5-sonnet), Google Gemini (gemini-1.5-pro), Ollama (qwen2.5-coder:latest).

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/askchokro` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Configure your preferred AI Provider API Keys under Settings -> AskChokro.
4. Use the provided shortcodes or API endpoints to integrate Natural Language data querying into your site.

== Frequently Asked Questions ==

= Is my database secure? =

Yes. AskChokro uses AST-level validation to ensure:
* Only read-only SELECT statements are allowed (no mutations).
* SQL injection attacks are impossible (it uses structural AST parsing, not regex).

= What if the AI generates invalid SQL? =

AskChokro's validator will reject it and return a user-friendly error. The engine uses a fail-closed design: invalid or dangerous queries never reach the database.

= Can I use custom AI models? =

Yes. The underlying engine supports implementing custom AI Providers via the API. 

== Changelog ==

= 3.0.0 =
* Initial release of the enterprise-grade AST-level SQL validation and sanitization engine for WordPress.
* Support for OpenAI, Anthropic, Gemini, and Ollama.
* Comprehensive error handling and security features.
