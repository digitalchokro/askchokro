<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AskChokro Shortcode.
 */
class AskChokro_Shortcode {

	public function __construct() {
		add_shortcode( 'askchokro_chat', array( $this, 'render_shortcode' ) );
	}

	public function render_shortcode( $atts ) {
		// Output a simple container for our vanilla JS chat UI to mount on.
		ob_start();
		?>
		<div id="askchokro-chat-container" class="askchokro-chat-wrapper">
			<div class="askchokro-chat-messages" id="askchokro-messages">
				<!-- Messages will be injected here via JS -->
			</div>
			<div class="askchokro-chat-input-area">
				<input type="text" id="askchokro-input" placeholder="Ask a question about your data..." />
				<button id="askchokro-send-btn">Send</button>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}
}

new AskChokro_Shortcode();
