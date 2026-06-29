<?php
/**
 * NS Videos — Yandex Object Storage для приложения-менеджера.
 * ============================================================
 *
 * Назначение: позволяет статичному Next-приложению (nstkani.ru/manager_app/)
 * загружать видео в бакет ns-tkani-video по имени артикула и узнавать,
 * есть ли уже видео. Секретный ключ Yandex хранится ТОЛЬКО на сервере WP.
 *
 * Как это работает:
 *   • POST /wp-json/ns/v1/videos/sign  → возвращает presigned PUT-ссылку.
 *     Браузер грузит файл напрямую в бакет по этой ссылке (PUT).
 *   • GET  /wp-json/ns/v1/videos/list  → список ключей объектов бакета.
 *     Ответ кэшируется транзиентом 120с; ?refresh=1 обходит кэш.
 *
 * Файл именуется по артикулу:  <артикул>.<расширение>   (напр. 14373.mp4).
 * Если объект с таким ключом уже есть — он перезаписывается (поведение S3 PUT).
 *
 * ---------------------------------------------------------------------------
 *  УСТАНОВКА
 *  1. Создать СТАТИЧЕСКИЙ КЛЮЧ доступа для сервисного аккаунта бакета
 *     (Yandex Cloud → сервисный аккаунт → Создать статический ключ доступа).
 *     Даст: access key id (YCAJE…) и secret (YCN…).
 *  2. В wp-config.php (выше строки /* That's all… */) добавить:
 *
 *         define('YS3_KEY',    'YCAJE... Access Key ID');
 *         define('YS3_SECRET', 'YCN...   Secret');
 *         // бакет и регион можно не задавать — значения по умолчанию ниже
 *         define('YS3_BUCKET', 'ns-tkani-video');
 *         define('YS3_REGION', 'ru-central1');
 *
 *  3. Вставить код этого файла:
 *       — через плагин «Code Snippets» (тип сниппета — Functions PHP),
 *         либо подключить файл из functions.php дочерней темы:
 *           require_once __DIR__ . '/ns-videos-snippet.php';
 *
 *  4. ОБЯЗАТЕЛЬНО настроить CORS бакета (один раз) — иначе браузер не даст
 *     сделать PUT на storage.yandexcloud.net. См. блок CORS ниже.
 *
 * ---------------------------------------------------------------------------
 *  CORS бакета (один раз). Сохранить в cors.json и применить:
 *
 *  cors.json:
 *  {
 *    "CORSRules": [
 *      {
 *        "AllowedOrigins": ["https://nstkani.ru"],
 *        "AllowedMethods": ["PUT", "GET"],
 *        "AllowedHeaders": ["*"],
 *        "ExposeHeaders": ["ETag"],
 *        "MaxAgeSeconds": 3000
 *      }
 *    ]
 *  }
 *
 *  Применить через AWS CLI (статический ключ из п.1):
 *    pip install awscli
 *    # ~/.aws/credentials:
 *    #   [default]
 *    #   aws_access_key_id = YCAJE...
 *    #   aws_secret_access_key = YCN...
 *    #   region = ru-central1
 *    aws --endpoint-url=https://storage.yandexcloud.net \
 *        s3api put-bucket-cors \
 *        --bucket ns-tkani-video \
 *        --cors-configuration file://cors.json
 *
 *  (Если origin приложения другой — укажите его в AllowedOrigins.)
 * ---------------------------------------------------------------------------
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Запрет прямого доступа.
}

// Значения по умолчанию (перекрываются константами из wp-config.php).
if ( ! defined( 'YS3_KEY' ) )    { define( 'YS3_KEY', '' ); }
if ( ! defined( 'YS3_SECRET' ) ) { define( 'YS3_SECRET', '' ); }
if ( ! defined( 'YS3_BUCKET' ) ) { define( 'YS3_BUCKET', 'ns-tkani-video' ); }
if ( ! defined( 'YS3_REGION' ) ) { define( 'YS3_REGION', 'ru-central1' ); }

// Разрешённые видео-расширения.
if ( ! defined( 'YS3_VIDEO_EXTS' ) ) {
	define( 'YS3_VIDEO_EXTS', array( 'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'ogv' ) );
}

add_action( 'rest_api_init', 'ns_videos_register_routes' );

function ns_videos_register_routes() {
	register_rest_route(
		'ns/v1',
		'/videos/sign',
		array(
			'methods'             => 'POST',
			'permission_callback' => 'ns_videos_can',
			'callback'            => 'ns_videos_sign',
		)
	);

	register_rest_route(
		'ns/v1',
		'/videos/list',
		array(
			'methods'             => 'GET',
			'permission_callback' => 'ns_videos_can',
			'callback'            => 'ns_videos_list',
		)
	);
}

/** Доступ только у авторизованных пользователей с правом редактирования записей. */
function ns_videos_can() {
	return current_user_can( 'edit_posts' );
}

/**
 * Очистка артикула под безопасный S3-ключ: только буквы/цифры/._-.
 */
function ns_videos_sanitize_article( $article ) {
	$article = sanitize_text_field( (string) $article );
	$article = preg_replace( '/[^\w.\-]+/u', '_', $article );
	$article = trim( (string) $article, "._- \t\n\r\0\x0B" );
	return $article;
}

/**
 * POST /ns/v1/videos/sign
 * Тело JSON: { "article": "14373", "ext": "mp4" }
 * Ответ:    { "url": "https://storage.yandexcloud.net/...", "key": "14373.mp4" }
 */
function ns_videos_sign( WP_REST_Request $request ) {
	if ( ! YS3_KEY || ! YS3_SECRET ) {
		return new WP_Error(
			'ys3_not_configured',
			'Yandex Object Storage: ключи не заданы (YS3_KEY/YS3_SECRET в wp-config.php).',
			array( 'status' => 500 )
		);
	}

	$article = ns_videos_sanitize_article( $request->get_param( 'article' ) );
	if ( $article === '' ) {
		return new WP_Error( 'bad_article', 'Артикул не задан.', array( 'status' => 400 ) );
	}

	$ext = strtolower( sanitize_text_field( (string) $request->get_param( 'ext' ) ) );
	if ( ! in_array( $ext, YS3_VIDEO_EXTS, true ) ) {
		$ext = 'mp4';
	}

	$key = $article . '.' . $ext;
	$url = ns_ys3_presigned_url( 'PUT', $key, array(), 900 );

	return rest_ensure_response(
		array(
			'url' => $url,
			'key' => $key,
		)
	);
}

/**
 * GET /ns/v1/videos/list?refresh=1
 * Ответ: { "keys": ["14373.mp4", "9876.mov", ...] }
 */
function ns_videos_list( WP_REST_Request $request ) {
	if ( ! YS3_KEY || ! YS3_SECRET ) {
		return new WP_Error(
			'ys3_not_configured',
			'Yandex Object Storage: ключи не заданы (YS3_KEY/YS3_SECRET в wp-config.php).',
			array( 'status' => 500 )
		);
	}

	$refresh = (string) $request->get_param( 'refresh' ) === '1';

	if ( ! $refresh ) {
		$cached = get_transient( 'ns_ys3_video_keys' );
		if ( is_array( $cached ) ) {
			return rest_ensure_response( array( 'keys' => array_values( $cached ) ) );
		}
	}

	$keys = ns_ys3_list_keys();
	set_transient( 'ns_ys3_video_keys', $keys, 120 );

	return rest_ensure_response( array( 'keys' => $keys ) );
}

/**
 * Список ключей объектов бакета (ListObjectsV2) с пагинацией.
 */
function ns_ys3_list_keys() {
	$all  = array();
	$token = null;
	$guard = 0;

	do {
		$extra = array( 'list-type' => '2' );
		if ( $token ) {
			$extra['continuation-token'] = $token;
		}

		$url    = ns_ys3_presigned_url( 'GET', '', $extra, 120 );
		$resp   = wp_remote_get( $url, array( 'timeout' => 30 ) );

		if ( is_wp_error( $resp ) ) {
			break;
		}

		$body = wp_remote_retrieve_body( $resp );

		if ( preg_match_all( '#<Key>([^<]*)</Key>#', $body, $m ) && ! empty( $m[1] ) ) {
			$all = array_merge( $all, $m[1] );
		}

		$token = null;
		if ( preg_match( '#<IsTruncated>true</IsTruncated>#', $body )
			&& preg_match( '#<NextContinuationToken>([^<]*)</NextContinuationToken>#', $body, $tm ) ) {
			$token = $tm[1];
		}

		$guard++;
	} while ( $token && $guard < 20 ); // не больше 20 страниц (~20000 объектов)

	return array_values( array_unique( $all ) );
}

/**
 * Presigned URL для Yandex Object Storage (S3, SigV4).
 * Используется и для загрузки (PUT ключа), и для листинга (GET бакета).
 *
 * @param string $method       'PUT' или 'GET'.
 * @param string $key          Ключ объекта (для листинга — пустая строка).
 * @param array  $extra_query  Доп. параметры запроса (напр. list-type=2).
 * @param int    $expires      Срок действия ссылки в секундах.
 * @return string
 */
function ns_ys3_presigned_url( $method, $key = '', $extra_query = array(), $expires = 900 ) {
	$host    = 'storage.yandexcloud.net';
	$service = 's3';
	$region  = YS3_REGION;
	$bucket  = YS3_BUCKET;

	$now        = time();
	$amz_date   = gmdate( 'Ymd\THis\Z', $now );
	$date_stamp = gmdate( 'Ymd', $now );

	// Канонический URI: path-style  /bucket/  или  /bucket/key
	$key_segment = ( $key === '' ) ? '' : implode( '/', array_map( 'rawurlencode', explode( '/', $key ) ) );
	$canonical_uri = '/' . $bucket . '/' . $key_segment;

	$credential = YS3_KEY . '/' . $date_stamp . '/' . $region . '/' . $service . '/aws4_request';

	$query = array_merge(
		$extra_query,
		array(
			'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
			'X-Amz-Credential'    => $credential,
			'X-Amz-Date'          => $amz_date,
			'X-Amz-Expires'       => (string) $expires,
			'X-Amz-SignedHeaders' => 'host',
		)
	);

	// Каноническая строка запроса: ключи отсортированы, RFC3986-кодированы.
	$enc = array();
	foreach ( $query as $k => $v ) {
		$enc[] = rawurlencode( $k ) . '=' . rawurlencode( $v );
	}
	sort( $enc, SORT_STRING );
	$canonical_query = implode( '&', $enc );

	$canonical_request =
		$method . "\n" .
		$canonical_uri . "\n" .
		$canonical_query . "\n" .
		"host:" . $host . "\n" .
		"\n" .
		"host\n" .
		'UNSIGNED-PAYLOAD';

	$scope = $date_stamp . '/' . $region . '/' . $service . '/aws4_request';
	$string_to_sign =
		"AWS4-HMAC-SHA256\n" .
		$amz_date . "\n" .
		$scope . "\n" .
		hash( 'sha256', $canonical_request );

	$k_date    = hash_hmac( 'sha256', $date_stamp, 'AWS4' . YS3_SECRET, true );
	$k_region  = hash_hmac( 'sha256', $region, $k_date, true );
	$k_service = hash_hmac( 'sha256', $service, $k_region, true );
	$k_signing = hash_hmac( 'sha256', 'aws4_request', $k_service, true );
	$signature = hash_hmac( 'sha256', $string_to_sign, $k_signing );

	return 'https://' . $host . $canonical_uri . '?' . $canonical_query . '&X-Amz-Signature=' . $signature;
}
