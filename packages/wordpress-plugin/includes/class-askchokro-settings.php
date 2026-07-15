<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AskChokro Settings Page.
 */
class AskChokro_Settings {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function add_settings_page() {
		add_options_page(
			'AskChokro Settings',
			'AskChokro',
			'manage_options',
			'askchokro',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting( 'askchokro_settings_group', 'askchokro_microservice_url' );
		register_setting( 'askchokro_settings_group', 'askchokro_api_token' );

		add_settings_section(
			'askchokro_main_section',
			'Microservice Connection',
			array( $this, 'render_section_intro' ),
			'askchokro'
		);

		add_settings_field(
			'askchokro_microservice_url',
			'Microservice URL',
			array( $this, 'render_url_field' ),
			'askchokro',
			'askchokro_main_section'
		);

		add_settings_field(
			'askchokro_api_token',
			'API Token',
			array( $this, 'render_token_field' ),
			'askchokro',
			'askchokro_main_section'
		);
	}

	public function render_section_intro() {
		echo '<p>Configure the connection to your AskChokro Node.js Microservice.</p>';
	}

	public function render_url_field() {
		$url = get_option( 'askchokro_microservice_url', '' );
		echo '<input type="url" name="askchokro_microservice_url" value="' . esc_attr( $url ) . '" class="regular-text" placeholder="https://your-api.com/api/ask" />';
	}

	public function render_token_field() {
		$token = get_option( 'askchokro_api_token', '' );
		echo '<input type="password" name="askchokro_api_token" value="' . esc_attr( $token ) . '" class="regular-text" placeholder="Your secret API token" />';
	}

	public function render_settings_page() {
		?>
		<div class="wrap">
			<h1>AskChokro Configuration</h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'askchokro_settings_group' );
				do_settings_sections( 'askchokro' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}
}

new AskChokro_Settings();
