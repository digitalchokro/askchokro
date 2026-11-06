=== AskChokro ===
Contributors: digitalchokro
Donate link: https://digitalchokro.com
Tags: ai, database, analytics, natural language, sql
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 8.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI Natural Language Data Assistant for WordPress and WooCommerce.

== Description ==

AskChokro transforms your WordPress and WooCommerce database into an interactive, conversational analytics engine. Powered by AST-level SQL validation, AskChokro lets store owners and administrators query sales, orders, customers, and inventory using natural language without writing SQL.

= Key Features =

* **Strict AST-Level Security**: Structural parsing guarantees queries are restricted to non-destructive SELECT operations. No SQL injection, no table dropping.
* **WooCommerce & Multi-Vendor Ready**: Native support for Dokan, WCFM, and standard WooCommerce reporting.
* **Multi-Model Intelligence**: Works seamlessly with local Ollama models (offline & private) or cloud APIs (OpenAI, Claude, Gemini).
* **Interactive Visualizations**: Generates charts, summaries, and tabular analytics on the fly.
* **Modern Block & Shortcode**: Embed with the `[askchokro]` shortcode or the AskChokro Gutenberg block.

== Installation ==

1. Upload the `askchokro` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress Plugins screen.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Navigate to Settings -> AskChokro to configure your microservice URL and authentication token.
4. Add the `[askchokro]` shortcode to any page, or insert the AskChokro Chat block in Gutenberg.

== Frequently Asked Questions ==

= Does AskChokro modify my database? =
No. AskChokro enforces read-only query execution. All mutation commands (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE) are rejected before execution.

= Can vendors see other vendors' data in Dokan or WCFM? =
No. The plugin includes cryptographic JWT signing that binds each query to the vendor's user ID, enforcing row-level tenant isolation in the backend microservice.

= What PHP and WordPress versions are supported? =
PHP 8.0 or higher and WordPress 6.0 or higher.

== Screenshots ==

1. screenshot-1.png - Admin settings configuration screen.
2. screenshot-2.png - Frontend conversational analytics shortcode in action.

== Changelog ==

= 1.0.0 =
* Initial public release.
* Natural language querying with AST-level security.
* Dokan and WCFM multi-vendor scoping support.
* Gutenberg block and [askchokro] shortcode.

== Upgrade Notice ==

= 1.0.0 =
Initial release for WordPress.org directory.
