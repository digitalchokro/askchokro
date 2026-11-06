<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AskChokro_Widget {

    public function __construct() {
        add_shortcode( 'askchokro', array( $this, 'render_shortcode' ) );
        add_shortcode( 'askchokro_chat', array( $this, 'render_shortcode' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'dokan_dashboard_content_inside_after', array( $this, 'render_dokan_widget' ) );
    }

    public function render_shortcode( $atts ) {
        return '<div id="askchokro-root"></div>';
    }

    public function render_dokan_widget() {
        echo '<div class="dokan-askchokro-widget-wrapper" style="margin-top:24px;">';
        echo '<h3>' . esc_html__( 'Store AI Business Intelligence', 'askchokro' ) . '</h3>';
        echo '<div id="askchokro-root"></div>';
        echo '</div>';
    }

    public function enqueue_scripts() {
        $asset_file = ASKCHOKRO_PLUGIN_DIR . 'build/index.asset.php';
        
        if ( ! file_exists( $asset_file ) ) {
            return; // Not built yet
        }

        $assets = require $asset_file;
        
        wp_enqueue_script(
            'askchokro-react-app',
            ASKCHOKRO_PLUGIN_URL . 'build/index.js',
            $assets['dependencies'],
            $assets['version'],
            true
        );

        wp_enqueue_style(
            'askchokro-react-style',
            ASKCHOKRO_PLUGIN_URL . 'build/index.css',
            array(),
            $assets['version']
        );

        // Pass settings, JWT token, and WooCommerce/Dokan suggestions to React
        $options = get_option( 'askchokro_options' );
        $url = isset( $options['microservice_url'] ) ? $options['microservice_url'] : 'http://localhost:3000';
        $token = AskChokro_Auth::generate_token();

        $user = wp_get_current_user();
        $is_vendor = false;
        if ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( $user->ID ) ) {
            $is_vendor = true;
        } elseif ( function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor( $user->ID ) ) {
            $is_vendor = true;
        } elseif ( in_array( 'seller', (array) $user->roles, true ) || in_array( 'wcfm_vendor', (array) $user->roles, true ) ) {
            $is_vendor = true;
        }

        $vendor_prompts = array(
            'Show my total sales this month vs last month',
            'Which of my products have the highest order volume?',
            'List my pending orders awaiting fulfillment',
            'What is my average order value this week?',
        );

        $admin_prompts = array(
            'Total store revenue and completed orders today',
            'Top 5 vendors by commission earnings',
            'Most refunded products in the last 30 days',
            'Monthly customer retention rate',
        );

        wp_localize_script( 'askchokro-react-app', 'askChokroSettings', array(
            'apiUrl'     => trailingslashit( $url ) . 'api/ask',
            'streamUrl'  => trailingslashit( $url ) . 'api/ask/stream',
            'token'      => $token ? $token : null,
            'nonce'      => wp_create_nonce( 'wp_rest' ),
            'isVendor'   => $is_vendor,
            'vendorId'   => $is_vendor ? $user->ID : null,
            'prompts'    => $is_vendor ? $vendor_prompts : $admin_prompts,
        ) );
    }
}
