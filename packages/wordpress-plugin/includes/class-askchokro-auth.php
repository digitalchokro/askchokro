<?php
use \Firebase\JWT\JWT;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AskChokro_Auth {

    /**
     * Generate a short-lived JWT for the current logged-in user with WooCommerce/Dokan multi-tenant context.
     * Returns false if user is not logged in or JWT secret is missing.
     */
    public static function generate_token() {
        if ( ! is_user_logged_in() ) {
            return false;
        }

        $options = get_option( 'askchokro_options' );
        $secret = isset( $options['jwt_secret'] ) ? $options['jwt_secret'] : '';

        if ( empty( $secret ) ) {
            return false;
        }

        $user = wp_get_current_user();
        $roles = (array) $user->roles;

        // Multi-Vendor Detection (Dokan, WCFM, WC Marketplace)
        $is_vendor = false;
        if ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( $user->ID ) ) {
            $is_vendor = true;
        } elseif ( function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor( $user->ID ) ) {
            $is_vendor = true;
        } elseif ( in_array( 'seller', $roles, true ) || in_array( 'wcfm_vendor', $roles, true ) || in_array( 'dc_vendor', $roles, true ) ) {
            $is_vendor = true;
        }

        // Add roles and multi-tenant scoping context
        $payload = array(
            'iss'             => get_site_url(),
            'iat'             => time(),
            'exp'             => time() + 3600, // 1 hour expiration
            'wp_user_id'      => $user->ID,
            'wp_roles'        => $roles,
            'wp_email'        => $user->user_email,
            'is_vendor'       => $is_vendor,
            'tenant_id'       => $is_vendor ? (string) $user->ID : 'admin',
            'dokan_vendor_id' => $is_vendor ? (string) $user->ID : null,
        );

        try {
            return JWT::encode( $payload, $secret, 'HS256' );
        } catch ( Exception $e ) {
            return false;
        }
    }
}
