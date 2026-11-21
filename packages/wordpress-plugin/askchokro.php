<?php
/**
 * Plugin Name: AskChokro
 * Plugin URI:  https://github.com/digitalchokro/askchokro
 * Description: An AI Data Assistant for your WordPress / WooCommerce store. Connects to your AskChokro Node.js microservice.
 * Version:     1.1.0
 * Author:      AskChokro Team
 * Author URI:  https://github.com/digitalchokro
 * License:     GPLv2 or later
 * Text Domain: askchokro
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'ASKCHOKRO_VERSION', '1.1.0' );
define( 'ASKCHOKRO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ASKCHOKRO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Main AskChokro Plugin Class.
 */
class AskChokro_Plugin {

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->includes();
		$this->init_hooks();
	}

	/**
	 * Include required files.
	 */
	private function includes() {
		require_once ASKCHOKRO_PLUGIN_DIR . 'includes/class-askchokro-settings.php';
		require_once ASKCHOKRO_PLUGIN_DIR . 'includes/class-askchokro-shortcode.php';
		require_once ASKCHOKRO_PLUGIN_DIR . 'includes/class-askchokro-jwt.php';
	}

	/**
	 * Initialize WordPress hooks.
	 */
	private function init_hooks() {
		add_action( 'init', array( $this, 'register_blocks' ) );
		add_action( 'init', array( $this, 'register_shortcodes' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'frontend_scripts' ) );
	}

	/**
	 * Register Gutenberg blocks.
	 */
	public function register_blocks() {
		// Register the askchokro-chat block if compiled assets exist.
		if ( file_exists( ASKCHOKRO_PLUGIN_DIR . 'build/block.json' ) ) {
			register_block_type( ASKCHOKRO_PLUGIN_DIR . 'build' );
		}
	}

	/**
	 * Register [askchokro] shortcode.
	 */
	public function register_shortcodes() {
		add_shortcode( 'askchokro', array( $this, 'render_shortcode' ) );
	}

	/**
	 * Render [askchokro] shortcode safely.
	 */
	public function render_shortcode( $atts ) {
		// Strictly protect shortcode rendering: ensure user has appropriate permissions
		if ( ! is_user_logged_in() || ! ( current_user_can( 'manage_options' ) || ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( get_current_user_id() ) ) || ( function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor() ) ) ) {
			return '<div class="askchokro-auth-notice"><p>' . esc_html__( 'Please log in with an authorized account to access AskChokro AI.', 'askchokro' ) . '</p></div>';
		}

		ob_start();
		?>
		<div id="askchokro-chat-container" class="askchokro-chat-wrapper">
			<div class="askchokro-chat-messages" id="askchokro-messages">
				<!-- Messages will be injected here via JS -->
			</div>
			<div class="askchokro-chat-input-area">
				<input type="text" id="askchokro-input" placeholder="<?php esc_attr_e( 'Ask a question about your data...', 'askchokro' ); ?>" />
				<button id="askchokro-send-btn"><?php esc_html_e( 'Send', 'askchokro' ); ?></button>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Admin scripts.
	 */
	public function admin_scripts( $hook ) {
		// Load styles/scripts for settings page if needed.
	}

	/**
	 * Frontend scripts.
	 */
	public function frontend_scripts() {
		// Enqueue chat widget scripts on the frontend.
		wp_enqueue_style( 'askchokro-frontend-style', ASKCHOKRO_PLUGIN_URL . 'assets/css/frontend.css', array(), ASKCHOKRO_VERSION );
		wp_enqueue_script( 'askchokro-frontend-script', ASKCHOKRO_PLUGIN_URL . 'assets/js/frontend.js', array(), ASKCHOKRO_VERSION, true );
		
		$secret = get_option( 'askchokro_api_token', '' );
		$token  = '';
		
		// CRITICAL SECURITY FIX (Rulebook 4.1): Never emit signed JWT tokens to anonymous/unauthenticated visitors.
		// Enforce strict authentication and administrative/vendor capability check.
		if ( is_user_logged_in() && ( current_user_can( 'manage_options' ) || ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( get_current_user_id() ) ) || ( function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor() ) ) ) {
			if ( ! empty( $secret ) ) {
				$user_id = get_current_user_id();
				
				// Standard WP user fallback (can be overridden by Dokan/WCFM checks)
				$vendor_id = $user_id;
				
				// Dokan support
				if ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( $user_id ) ) {
					$vendor_id = $user_id;
				}
				
				// WCFM support
				if ( function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor() ) {
					$vendor_id = $user_id;
				}
				
				$payload = array(
					'iat'       => time(),
					'exp'       => time() + 3600, // 1 hour expiration
					'vendor_id' => $vendor_id,
					'user_id'   => $user_id,
				);
				
				$token = AskChokro_JWT::generate( $payload, $secret );
			}
		}

		// Pass settings to frontend JS. For guests/unauthenticated visitors, apiToken is empty.
		wp_localize_script( 'askchokro-frontend-script', 'askchokroData', array(
			'microserviceUrl' => get_option( 'askchokro_microservice_url', '' ),
			'apiToken'        => $token,
		) );
	}
}

// Initialize plugin.
new AskChokro_Plugin();
