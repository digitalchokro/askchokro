<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register settings menu and fields
 */
function askchokro_register_settings() {
    add_options_page(
        'AskChokro Settings',
        'AskChokro',
        'manage_options',
        'askchokro-settings',
        'askchokro_settings_page_html'
    );

    register_setting('askchokro_settings_group', 'askchokro_microservice_url');
    register_setting('askchokro_settings_group', 'askchokro_jwt_secret');

    add_settings_section(
        'askchokro_main_section',
        'Main Configuration',
        'askchokro_main_section_cb',
        'askchokro-settings'
    );

    add_settings_field(
        'askchokro_microservice_url',
        'Microservice URL',
        'askchokro_microservice_url_cb',
        'askchokro-settings',
        'askchokro_main_section'
    );

    add_settings_field(
        'askchokro_jwt_secret',
        'JWT Secret',
        'askchokro_jwt_secret_cb',
        'askchokro-settings',
        'askchokro_main_section'
    );
}
add_action('admin_menu', 'askchokro_register_settings');

function askchokro_main_section_cb() {
    echo '<p>Configure the connection to your AskChokro microservice backend.</p>';
}

function askchokro_microservice_url_cb() {
    $val = get_option('askchokro_microservice_url', 'http://localhost:3000');
    echo '<input type="url" name="askchokro_microservice_url" value="' . esc_attr($val) . '" class="regular-text" required />';
    echo '<p class="description">The URL where your AskChokro microservice is running (e.g. <code>https://api.yourdomain.com</code>).</p>';
}

function askchokro_jwt_secret_cb() {
    $val = get_option('askchokro_jwt_secret', '');
    echo '<input type="password" name="askchokro_jwt_secret" value="' . esc_attr($val) . '" class="regular-text" required />';
    echo '<p class="description">The JWT Secret configured in your AskChokro microservice (<code>JWT_SECRET</code>). Required for generating secure access tokens for your vendors/users.</p>';
}

function askchokro_settings_page_html() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>AskChokro Settings</h1>
        <form action="options.php" method="post">
            <?php
            settings_fields('askchokro_settings_group');
            do_settings_sections('askchokro-settings');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}
