<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AskChokro JWT Generator.
 * A lightweight, zero-dependency class to generate signed JWTs.
 */
class AskChokro_JWT {

	/**
	 * Base64Url encode a string.
	 *
	 * @param string $data Data to encode.
	 * @return string
	 */
	private static function base64url_encode( $data ) {
		return str_replace( array( '+', '/', '=' ), array( '-', '_', '' ), base64_encode( $data ) );
	}

	/**
	 * Generate a signed JWT.
	 *
	 * @param array  $payload The JWT payload (e.g., vendor_id, iat, exp).
	 * @param string $secret  The secret key used for HMAC SHA256 signing.
	 * @return string The signed JWT string.
	 */
	public static function generate( $payload, $secret ) {
		// Create token header
		$header = wp_json_encode( array(
			'typ' => 'JWT',
			'alg' => 'HS256'
		) );

		// Encode Header and Payload
		$base64UrlHeader  = self::base64url_encode( $header );
		$base64UrlPayload = self::base64url_encode( wp_json_encode( $payload ) );

		// Create Signature Hash
		$signature = hash_hmac( 'sha256', $base64UrlHeader . '.' . $base64UrlPayload, $secret, true );

		// Encode Signature to Base64Url
		$base64UrlSignature = self::base64url_encode( $signature );

		// Return JWT
		return $base64UrlHeader . '.' . $base64UrlPayload . '.' . $base64UrlSignature;
	}
}
