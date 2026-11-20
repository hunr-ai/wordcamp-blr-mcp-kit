<?php
/**
 * Seeds the demo site with realistic WordPress + AI content (deliberately imperfect,
 * so the audit and SEO abilities have something real to find), then creates a
 * DETERMINISTIC Application Password for the MCP client.
 *
 * Run by blueprint.json inside WordPress Playground (local only). scripts/start.mjs
 * writes /kit-state/runtime.json (from kit.config.json) before boot and waits for
 * /kit-state/ready.json, which this file writes at the very end.
 */

update_option( 'blogname', 'WordCamp Bengaluru Demo' );
update_option( 'blogdescription', 'Notes on WordPress, AI and the open web' );
update_option( 'permalink_structure', '/%postname%/' );

$p  = fn( $t ) => "<!-- wp:paragraph -->\n<p>{$t}</p>\n<!-- /wp:paragraph -->\n";
$h2 = fn( $t ) => "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">{$t}</h2>\n<!-- /wp:heading -->\n";

$posts = array(
	array(
		'cat'     => 'AI',
		'status'  => 'publish',
		'days'    => 2,
		'title'   => 'What is the Abilities API, and why should site owners care?',
		'excerpt' => 'WordPress 6.9 introduced the Abilities API: a single registry of what your site can do, with permissions built in. Here is why it matters for AI.',
		'content' => $p( 'Before WordPress 6.9, every plugin described its features in its own way: REST routes here, AJAX handlers there, admin screens everywhere. An AI agent had no reliable way to know what a site could do, or whether it was allowed to do it.' )
			. $h2( 'One registry for every capability' )
			. $p( 'The Abilities API gives core, plugins and themes one place to register an ability: a unique name, a human label, a description the AI reads, an input schema, an output schema, an execute callback and a permission callback. Because the shape is the same everywhere, any client can discover abilities and call them safely.' )
			. $p( 'WordPress ships with core abilities such as get-site-info, get-user-info and get-environment-info. WordPress 7.2 adds content, user and settings queries. Plugins like WooCommerce and form builders register their own.' )
			. $h2( 'Permissions are not optional' )
			. $p( 'Every ability carries a permission callback that runs on every single call, as the connected WordPress user. If an editor connects an AI client, the AI can do what an editor can do, and nothing more. Read our guide on <a href="/securing-ai-access-with-application-passwords/">securing AI access with Application Passwords</a> before you connect a production site.' )
			. $p( 'For site owners, this means AI integrations stop being a black box. You can see every ability in the Abilities Explorer, decide which ones are exposed to agents, and switch them off again in seconds.' ),
	),
	array(
		'cat'     => 'AI',
		'status'  => 'publish',
		'days'    => 5,
		'title'   => 'Getting started with the MCP Adapter plugin',
		'excerpt' => 'The official MCP Adapter turns WordPress abilities into tools that Claude, ChatGPT, Gemini, Cursor and VS Code can use.',
		'content' => $p( 'The Model Context Protocol (MCP) is an open standard that lets AI applications connect to outside tools and data. The MCP Adapter is the official WordPress plugin that speaks MCP, and since version 0.7.0 it is available in the WordPress.org plugin directory.' )
			. $h2( 'Install and connect' )
			. $p( 'Install MCP Adapter from Plugins, Add New. Create an Application Password under Users, Profile. Then point your AI client at the endpoint /wp-json/mcp/mcp-adapter-default-server, either directly over HTTP or through the @automattic/mcp-wordpress-remote proxy. Local sites can also connect over STDIO with WP-CLI using wp mcp-adapter serve.' )
			. $h2( 'Discover, inspect, execute' )
			. $p( 'The default server exposes three tools: discover-abilities, get-ability-info and execute-ability. The AI first lists what your site can do, reads the schema of the ability it needs, and then runs it. Abilities are private by default, so only those marked public for MCP appear.' )
			. $p( 'Start on a staging or local site, connect with a non-admin user, and keep your client on ask-before-acting until you trust the workflow. See also <a href="/what-is-the-abilities-api-and-why-should-site-owners-care/">what the Abilities API is</a>.' ),
	),
	array(
		'cat'     => 'Security',
		'status'  => 'publish',
		'days'    => 9,
		'title'   => 'Securing AI access with Application Passwords',
		'excerpt' => '',
		'content' => $p( 'Application Passwords let an external app sign in as a WordPress user without knowing that user\'s real password. Each one can be revoked individually from the user profile.' )
			. $p( 'For AI agents, create a dedicated user with the lowest role that still does the job, for example Author for drafting posts. Give the Application Password a clear name such as Claude Desktop, laptop. If something looks wrong, revoke it and the agent is disconnected immediately.' )
			. $p( 'WordPress 7.2 also introduces the Secrets API, which encrypts plugin credentials such as AI provider keys at rest instead of storing them as plain text in the options table.' ),
	),
	array(
		'cat'     => 'WordPress',
		'status'  => 'publish',
		'days'    => 12,
		'title'   => 'WordPress 7.2 is almost here',
		'excerpt' => 'Release candidate 1 arrived on 17 November. The final release is scheduled for 8 December 2026.',
		'content' => $p( 'WordPress 7.2 brings the Secrets API, SVG icons in the admin bar and menu, random content URLs, and prefetching instead of script concatenation in the admin. Gutenberg also moved to React 19 by default.' )
			. $h2( 'What to test' )
			. $p( 'Plugin authors should test anything that links to load-scripts.php or load-styles.php, any CSS that styles admin menu icons with ::before, and any code that compares sanitized HTML, since wp_kses now runs on the HTML API.' )
			. $p( 'You can test with the WordPress Beta Tester plugin, with WP-CLI, or instantly in WordPress Playground.' )
			. '<!-- wp:image --><figure class="wp-block-image"><img src="https://s.w.org/images/core/emoji/15.0.3/svg/1f680.svg" /></figure><!-- /wp:image -->',
	),
	array(
		'cat'     => 'Community',
		'status'  => 'publish',
		'days'    => 1,
		'title'   => 'WordCamp Bengaluru 2026',
		'excerpt' => 'Two days of talks, workshops and contributor work on 21 and 22 November 2026.',
		'content' => $p( 'WordCamp Bengaluru returns for its fourth year with talks on AI search visibility, security in the AI era, WordPress education, and a hands-on workshop on connecting WordPress and MCP.' ),
	),
	array(
		'cat'     => 'WordPress',
		'status'  => 'publish',
		'days'    => 20,
		'title'   => 'Block themes',
		'excerpt' => '',
		'content' => $p( 'Block themes use theme.json and HTML templates. In 7.2 you can style text input states such as focus and placeholder directly in theme.json.' ),
	),
	array(
		'cat'     => 'AI',
		'status'  => 'draft',
		'days'    => 45,
		'title'   => 'WebMCP: AI agents inside the block editor',
		'excerpt' => '',
		'content' => $p( 'Draft notes: the AI plugin 1.5 WebMCP experiment lets compatible AI browsers read the current post, insert and move blocks, and save, using the editor\'s own data stores. Add screenshots and a short demo.' ),
	),
	array(
		'cat'     => 'Performance',
		'status'  => 'draft',
		'days'    => 60,
		'title'   => 'Core Web Vitals checklist for WordPress sites',
		'excerpt' => '',
		'content' => $p( 'TODO: images, fonts, caching, third-party scripts, INP. Link to the performance team handbook.' ),
	),
);

foreach ( $posts as $post ) {
	$term = term_exists( $post['cat'], 'category' );
	if ( ! $term ) {
		$term = wp_insert_term( $post['cat'], 'category' );
	}
	$date = gmdate( 'Y-m-d H:i:s', strtotime( '2026-11-20 09:00:00' ) - $post['days'] * DAY_IN_SECONDS );
	$id   = wp_insert_post(
		array(
			'post_title'    => $post['title'],
			'post_name'     => sanitize_title( $post['title'] ),
			'post_content'  => $post['content'],
			'post_excerpt'  => $post['excerpt'],
			'post_status'   => $post['status'],
			'post_category' => array( (int) $term['term_id'] ),
			'post_date'     => $date,
			'post_date_gmt' => $date,
		)
	);
	// Make "stale drafts" really stale.
	global $wpdb;
	$wpdb->update( $wpdb->posts, array( 'post_modified' => $date, 'post_modified_gmt' => $date ), array( 'ID' => $id ) );
}

wp_insert_post(
	array(
		'post_title'   => 'About',
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_content' => $p( 'A demo site for the Connecting WordPress and MCP workshop at WordCamp Bengaluru 2026.' ),
	)
);

wp_delete_post( 1, true ); // "Hello world!"
wp_delete_post( 2, true ); // "Sample Page"

// -------------------------------------------------------------------------
// Application Password for the MCP client (local Playground only).
//
// The Playground site lives in memory and is re-created on every boot, so a normal
// (random) Application Password would change every time and break the AI app configs.
// Instead we create one the normal way, then swap its stored hash for the hash of a
// FIXED password from kit.config.json. It is a throwaway credential for a site that
// only listens on 127.0.0.1. Never do this on a real site.
// -------------------------------------------------------------------------
$state_dir = '/kit-state';
$runtime   = json_decode( (string) @file_get_contents( $state_dir . '/runtime.json' ), true );
$result    = array( 'ok' => false );

try {
	$fixed = preg_replace( '/[^a-z\d]/i', '', (string) ( $runtime['appPassword'] ?? '' ) );
	$login = (string) ( $runtime['username'] ?? 'admin' );
	$user  = get_user_by( 'login', $login );
	if ( ! $user ) {
		throw new Exception( "User '{$login}' not found." );
	}
	if ( 24 !== strlen( $fixed ) ) {
		throw new Exception( 'appPassword in kit.config.json must be 24 letters/digits.' );
	}

	$created = WP_Application_Passwords::create_new_application_password(
		$user->ID,
		array( 'name' => (string) ( $runtime['appName'] ?? 'WordCamp MCP kit' ) )
	);
	if ( is_wp_error( $created ) ) {
		throw new Exception( $created->get_error_message() );
	}
	$uuid = $created[1]['uuid'];

	// WP 6.8+ hashes Application Passwords with wp_fast_hash() via hash_password();
	// older versions used the regular phpass wp_hash_password().
	$hash   = method_exists( 'WP_Application_Passwords', 'hash_password' )
		? WP_Application_Passwords::hash_password( $fixed )
		: wp_hash_password( $fixed );
	$scheme = method_exists( 'WP_Application_Passwords', 'hash_password' ) ? 'hash_password' : 'wp_hash_password';

	// update_application_password() only changes the name, so write the user meta directly.
	$items = WP_Application_Passwords::get_user_application_passwords( $user->ID );
	foreach ( $items as &$item ) {
		if ( $item['uuid'] === $uuid ) {
			$item['password'] = $hash;
		}
	}
	unset( $item );
	update_user_meta( $user->ID, WP_Application_Passwords::USERMETA_KEY_APPLICATION_PASSWORDS, $items );

	// Same check core runs in wp_authenticate_application_password().
	$verified = false;
	foreach ( WP_Application_Passwords::get_user_application_passwords( $user->ID ) as $item ) {
		$verified = $verified || ( method_exists( 'WP_Application_Passwords', 'check_password' )
			? WP_Application_Passwords::check_password( $fixed, $item['password'] )
			: wp_check_password( $fixed, $item['password'], $user->ID ) );
	}
	if ( ! $verified ) {
		throw new Exception( 'Stored hash did not verify.' );
	}

	$result = array(
		'ok'         => true,
		'user'       => $login,
		'uuid'       => $uuid,
		'scheme'     => $scheme,
		'wp_version' => get_bloginfo( 'version' ),
	);
} catch ( Throwable $e ) {
	$result['error'] = $e->getMessage();
}

file_put_contents( $state_dir . '/ready.json', wp_json_encode( $result ) );
