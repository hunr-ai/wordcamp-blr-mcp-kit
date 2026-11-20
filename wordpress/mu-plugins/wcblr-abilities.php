<?php
/**
 * Plugin Name: WordCamp Bengaluru Demo Abilities
 * Description: Practical abilities for the "Connecting WordPress and MCP" workshop (WordCamp Bengaluru 2026).
 *              Registered with the Abilities API (WP 6.9+) and exposed to AI agents through the MCP Adapter.
 * Version:     1.1.0
 *
 * What each ability teaches:
 *   wcblr/content-audit     read-only, no input, real site data          -> "audit my content"
 *   wcblr/seo-check         read-only, typed input (post_id)             -> "check post 5 for SEO issues"
 *   wcblr/create-draft      write, typed input, drafts only              -> "draft a post about ..."
 *   wcblr/delete-all-posts  destructive, NOT exposed (mcp.public=false)  -> the AI cannot even see it
 *
 * The three switches you control:
 *   meta.mcp.public      what the AI can SEE
 *   permission_callback  what it may DO (runs on every call, as the connected user)
 *   Application Password WHO it acts as (revoke it and access ends)
 */

defined( 'ABSPATH' ) || exit;

/* -------------------------------------------------------------------------
 * Category
 * ---------------------------------------------------------------------- */
add_action( 'wp_abilities_api_categories_init', function () {
	wp_register_ability_category(
		'wcblr',
		array(
			'label'       => 'Content Operations',
			'description' => 'Content audit, SEO checks and drafting for editors.',
		)
	);
} );

/**
 * Helper: plain-text word count of post content.
 */
function wcblr_word_count( $content ) {
	return str_word_count( wp_strip_all_tags( strip_shortcodes( $content ) ) );
}

/* -------------------------------------------------------------------------
 * Abilities
 * ---------------------------------------------------------------------- */
add_action( 'wp_abilities_api_init', function () {

	// --- 1. Content audit: read-only, no input. --------------------------
	wp_register_ability(
		'wcblr/content-audit',
		array(
			'label'               => 'Content Audit',
			'description'         => 'Audits all posts: counts by status and category, and lists posts missing a featured image, missing an excerpt, under 150 words, or drafts older than 30 days. Use for content health checks and editorial planning.',
			'category'            => 'wcblr',
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => function () {
				$posts = get_posts(
					array(
						'post_type'      => 'post',
						'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
						'posts_per_page' => 200,
					)
				);
				$status = array();
				$cats   = array();
				$issues = array(
					'missing_featured_image' => array(),
					'missing_excerpt'        => array(),
					'thin_content'           => array(),
					'stale_drafts'           => array(),
				);
				foreach ( $posts as $p ) {
					$status[ $p->post_status ] = ( $status[ $p->post_status ] ?? 0 ) + 1;
					foreach ( wp_get_post_categories( $p->ID, array( 'fields' => 'names' ) ) as $c ) {
						$cats[ $c ] = ( $cats[ $c ] ?? 0 ) + 1;
					}
					$ref   = array( 'id' => $p->ID, 'title' => $p->post_title, 'status' => $p->post_status );
					$words = wcblr_word_count( $p->post_content );
					if ( ! has_post_thumbnail( $p ) ) {
						$issues['missing_featured_image'][] = $ref;
					}
					if ( '' === trim( $p->post_excerpt ) ) {
						$issues['missing_excerpt'][] = $ref;
					}
					if ( $words < 150 ) {
						$issues['thin_content'][] = $ref + array( 'words' => $words );
					}
					if ( 'draft' === $p->post_status && strtotime( $p->post_modified_gmt ) < time() - 30 * DAY_IN_SECONDS ) {
						$issues['stale_drafts'][] = $ref + array( 'last_modified' => $p->post_modified );
					}
				}
				return array(
					'total_posts' => count( $posts ),
					'by_status'   => $status,
					'by_category' => $cats,
					'issues'      => $issues,
				);
			},
			'permission_callback' => fn() => current_user_can( 'edit_posts' ),
			'meta'                => array(
				'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				'show_in_rest' => true,
				'mcp'          => array( 'public' => true ),
			),
		)
	);

	// --- 2. SEO check: read-only, typed input. ---------------------------
	wp_register_ability(
		'wcblr/seo-check',
		array(
			'label'               => 'SEO Check',
			'description'         => 'Runs on-page SEO checks on one post: title length, excerpt (meta description), word count, H2/H3 headings, internal and external links, and images without alt text. Returns a 0-100 score with a list of issues to fix.',
			'category'            => 'wcblr',
			'input_schema'        => array(
				'type'                 => 'object',
				'required'             => array( 'post_id' ),
				'properties'           => array(
					'post_id' => array( 'type' => 'integer', 'minimum' => 1, 'description' => 'ID of the post to check.' ),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'post_id' => array( 'type' => 'integer' ),
					'title'   => array( 'type' => 'string' ),
					'score'   => array( 'type' => 'integer' ),
					'metrics' => array( 'type' => 'object' ),
					'issues'  => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
				),
			),
			'execute_callback'    => function ( $input ) {
				$post = get_post( (int) $input['post_id'] );
				if ( ! $post || 'post' !== $post->post_type ) {
					return new WP_Error( 'not_found', 'No post with that ID.' );
				}
				$html      = $post->post_content;
				$title_len = mb_strlen( $post->post_title );
				$words     = wcblr_word_count( $html );
				$headings  = preg_match_all( '/<h[23][\s>]/i', $html );
				preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $html, $m );
				$home      = wp_parse_url( home_url(), PHP_URL_HOST );
				$internal  = 0;
				$external  = 0;
				foreach ( $m[1] as $href ) {
					$host = wp_parse_url( $href, PHP_URL_HOST );
					( ! $host || $host === $home ) ? $internal++ : $external++;
				}
				preg_match_all( '/<img\b(?![^>]*\balt=["\'][^"\']+["\'])[^>]*>/i', $html, $no_alt );

				$issues = array();
				$score  = 100;
				if ( $title_len < 30 || $title_len > 65 ) {
					$issues[] = "Title is {$title_len} characters; aim for 30-65.";
					$score   -= 15;
				}
				if ( '' === trim( $post->post_excerpt ) ) {
					$issues[] = 'No excerpt set; search engines and social cards will guess the description.';
					$score   -= 15;
				}
				if ( $words < 300 ) {
					$issues[] = "Only {$words} words; aim for at least 300 for an article.";
					$score   -= 20;
				}
				if ( 0 === $headings ) {
					$issues[] = 'No H2/H3 subheadings; long text is hard to scan.';
					$score   -= 10;
				}
				if ( 0 === $internal ) {
					$issues[] = 'No internal links to other posts on this site.';
					$score   -= 10;
				}
				if ( count( $no_alt[0] ) > 0 ) {
					$issues[] = count( $no_alt[0] ) . ' image(s) without alt text (accessibility and SEO).';
					$score   -= 15;
				}
				if ( ! has_post_thumbnail( $post ) ) {
					$issues[] = 'No featured image.';
					$score   -= 5;
				}
				return array(
					'post_id' => $post->ID,
					'title'   => $post->post_title,
					'score'   => max( 0, $score ),
					'metrics' => array(
						'title_length'      => $title_len,
						'word_count'        => $words,
						'subheadings'       => $headings,
						'internal_links'    => $internal,
						'external_links'    => $external,
						'images_missing_alt' => count( $no_alt[0] ),
					),
					'issues'  => $issues,
				);
			},
			'permission_callback' => fn( $input = null ) => current_user_can( 'edit_post', (int) ( $input['post_id'] ?? 0 ) ),
			'meta'                => array(
				'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
				'show_in_rest' => true,
				'mcp'          => array( 'public' => true ),
			),
		)
	);

	// --- 3. Create draft: write, typed input, never publishes. ------------
	wp_register_ability(
		'wcblr/create-draft',
		array(
			'label'               => 'Create Draft Post',
			'description'         => 'Creates a DRAFT post with title, content, optional excerpt and category. It never publishes: a human reviews and publishes. Returns the post ID and edit link.',
			'category'            => 'wcblr',
			'input_schema'        => array(
				'type'                 => 'object',
				'required'             => array( 'title', 'content' ),
				'properties'           => array(
					'title'    => array( 'type' => 'string', 'minLength' => 3, 'description' => 'Post title.' ),
					'content'  => array( 'type' => 'string', 'description' => 'Post body as HTML or plain paragraphs.' ),
					'excerpt'  => array( 'type' => 'string', 'description' => 'Optional one or two sentence summary.' ),
					'category' => array( 'type' => 'string', 'description' => 'Optional category name; created if it does not exist.' ),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'id'        => array( 'type' => 'integer' ),
					'status'    => array( 'type' => 'string' ),
					'edit_link' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => function ( $input ) {
				$cat_ids = array();
				if ( ! empty( $input['category'] ) ) {
					$term = term_exists( $input['category'], 'category' );
					if ( ! $term ) {
						$term = wp_insert_term( $input['category'], 'category' );
					}
					if ( ! is_wp_error( $term ) ) {
						$cat_ids[] = (int) ( is_array( $term ) ? $term['term_id'] : $term );
					}
				}
				$id = wp_insert_post(
					array(
						'post_title'    => sanitize_text_field( $input['title'] ),
						'post_content'  => wp_kses_post( wpautop( $input['content'] ) ),
						'post_excerpt'  => sanitize_textarea_field( $input['excerpt'] ?? '' ),
						'post_status'   => 'draft', // Agents draft. Humans publish.
						'post_category' => $cat_ids,
					),
					true
				);
				if ( is_wp_error( $id ) ) {
					return $id;
				}
				return array(
					'id'        => $id,
					'status'    => 'draft',
					'edit_link' => admin_url( 'post.php?post=' . $id . '&action=edit' ),
				);
			},
			'permission_callback' => fn() => current_user_can( 'edit_posts' ),
			'meta'                => array(
				'annotations'  => array( 'readonly' => false, 'destructive' => false, 'idempotent' => false ),
				'show_in_rest' => true,
				'mcp'          => array( 'public' => true ),
			),
		)
	);

	// --- 4. Safety demo: registered, but NOT exposed to MCP. -------------
	// Ask the agent to "delete all posts": it will not find any way to do it.
	// (The callback is intentionally a no-op as well.)
	wp_register_ability(
		'wcblr/delete-all-posts',
		array(
			'label'               => 'Delete All Posts',
			'description'         => 'Bulk-deletes every post. Registered only to demonstrate that abilities without meta.mcp.public are invisible to AI agents.',
			'category'            => 'wcblr',
			'execute_callback'    => fn() => new WP_Error( 'disabled', 'This ability is intentionally disabled in the demo.' ),
			'permission_callback' => fn() => current_user_can( 'manage_options' ),
			'meta'                => array(
				'annotations' => array( 'readonly' => false, 'destructive' => true ),
				'mcp'         => array( 'public' => false ), // <- the visibility switch
			),
		)
	);
} );
