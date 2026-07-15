<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register the [askchokro] shortcode
 */
function askchokro_shortcode($atts) {
    // Only display for logged-in users, or allow everyone?
    // In multi-tenant environments like Dokan, typically only logged-in vendors should see the true chat
    // For now, if no token can be generated, we can still render the widget but it will fail authentication if JWT is required.
    
    // Ensure scripts and styles are enqueued
    wp_enqueue_style('askchokro-chat-style');
    wp_enqueue_script('askchokro-chat-script');

    // Render the chat widget container
    ob_start();
    ?>
    <div id="askchokro-chat-widget-container">
        <!-- The JS will mount the UI here -->
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('askchokro', 'askchokro_shortcode');
