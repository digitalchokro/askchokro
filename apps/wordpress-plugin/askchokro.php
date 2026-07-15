<?php
/**
 * Plugin Name: AskChokro
 * Plugin URI: https://digitalchokro.com/askchokro
 * Description: An AI-powered natural language SQL analytics and chat widget for WordPress, tailored for multi-tenant environments like Dokan and WCFM.
 * Version: 1.0.0
 * Author: Digital Chokro
 * Author URI: https://digitalchokro.com
 * License: GPLv2 or later
 * Text Domain: askchokro
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

// Define plugin constants
define('ASKCHOKRO_VERSION', '1.0.0');
define('ASKCHOKRO_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ASKCHOKRO_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include necessary files
require_once ASKCHOKRO_PLUGIN_DIR . 'includes/settings.php';
require_once ASKCHOKRO_PLUGIN_DIR . 'includes/shortcodes.php';

/**
 * Enqueue scripts and styles for the frontend chat widget
 */
function askchokro_enqueue_scripts() {
    // Only enqueue if the shortcode is present on the page, or globally if preferred.
    // For now, we will let the shortcode function itself enqueue the assets or enqueue globally.
    // We will enqueue them here and conditionally load them inside the shortcode.
    
    wp_register_style(
        'askchokro-chat-style',
        ASKCHOKRO_PLUGIN_URL . 'assets/chat.css',
        array(),
        ASKCHOKRO_VERSION
    );

    wp_register_script(
        'askchokro-chat-script',
        ASKCHOKRO_PLUGIN_URL . 'assets/chat.js',
        array(),
        ASKCHOKRO_VERSION,
        true
    );

    // Pass the microservice URL to the frontend JS
    $microservice_url = get_option('askchokro_microservice_url', 'http://localhost:3000');
    // If the site uses Dokan/WCFM, we might want to generate a short-lived token here
    // But for a simple plugin, we assume the user might have to authenticate, or the JWT is generated securely.
    // For now, we just pass the URL. A real implementation would generate a JWT token securely on the server side using the secret.
    
    // Generate JWT if user is logged in
    $token = askchokro_generate_jwt();

    wp_localize_script('askchokro-chat-script', 'AskChokroConfig', array(
        'apiUrl' => rtrim($microservice_url, '/'),
        'token'  => $token,
        'nonce'  => wp_create_nonce('askchokro_nonce')
    ));
}
add_action('wp_enqueue_scripts', 'askchokro_enqueue_scripts');

/**
 * Basic JWT Generation (Header.Payload.Signature)
 * For demonstration purposes. Requires the JWT secret from settings.
 */
function askchokro_generate_jwt() {
    $secret = get_option('askchokro_jwt_secret', '');
    if (empty($secret)) {
        return '';
    }

    $user_id = get_current_user_id();
    if (!$user_id) {
        return '';
    }

    // Example logic for Dokan vendor ID (Dokan uses user ID as vendor ID)
    // We will set the vendor_id in the payload
    $vendor_id = $user_id; 

    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $user_id,
        'vendor_id' => $vendor_id,
        'iat' => time(),
        'exp' => time() + 3600 // 1 hour expiration
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}
