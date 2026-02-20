if (!defined('ABSPATH'))
    exit;
define('INSTANANO_XRD_DB_VERSION', '2.0.1');
function instanano_table_accounts()
{
    global $wpdb;
    return $wpdb->prefix . 'instanano_xrd_accounts';
}
function instanano_table_access()
{
    global $wpdb;
    return $wpdb->prefix . 'instanano_xrd_access';
}
function instanano_table_sha()
{
    global $wpdb;
    return $wpdb->prefix . 'instanano_xrd_sha';
}
add_action('init', 'instanano_maybe_create_tables', 5);
function instanano_maybe_create_tables()
{
    if (get_option('instanano_xrd_db_version') === INSTANANO_XRD_DB_VERSION)
        return;
    if (!function_exists('dbDelta'))
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    global $wpdb;
    $c = $wpdb->get_charset_collate();
    $t1 = instanano_table_accounts();
    $t2 = instanano_table_access();
    $t3 = instanano_table_sha();
    dbDelta("CREATE TABLE {$t1} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		order_id bigint(20) unsigned NOT NULL,
		plan_label varchar(191) NOT NULL DEFAULT '',
		credits_total int(11) NOT NULL DEFAULT 0,
		credits_used int(11) NOT NULL DEFAULT 0,
		expires_at datetime NOT NULL,
		monthly_division tinyint(1) NOT NULL DEFAULT 0,
		per_email_monthly_limit int(11) NOT NULL DEFAULT 0,
		notes text NULL,
		created_at datetime NOT NULL,
		updated_at datetime NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY order_id (order_id),
		KEY expires_at (expires_at)
	) {$c};");
    dbDelta("CREATE TABLE {$t2} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		account_id bigint(20) unsigned NOT NULL,
		access_type varchar(10) NOT NULL,
		access_value varchar(191) NOT NULL,
		is_unlimited tinyint(1) NOT NULL DEFAULT 0,
		PRIMARY KEY  (id),
		UNIQUE KEY unique_access (account_id, access_type, access_value),
		KEY lookup (access_type, access_value),
		KEY account_id (account_id)
	) {$c};");
    dbDelta("CREATE TABLE {$t3} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		account_id bigint(20) unsigned NOT NULL,
		sha256 binary(32) NOT NULL,
		user_email varchar(191) NOT NULL DEFAULT '',
		credits_used int(11) NOT NULL DEFAULT 1,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY uniq_account_hash (account_id, sha256),
		KEY idx_email_monthly (account_id, user_email, created_at),
		KEY account_id (account_id)
	) {$c};");
    update_option('instanano_xrd_db_version', INSTANANO_XRD_DB_VERSION);
}
add_action('woocommerce_product_options_general_product_data', 'instanano_product_fields');
function instanano_product_fields()
{
    echo '<div class="options_group"><h4 style="padding-left:12px;color:#0073aa;">InstaNano Credit Settings</h4>';
    woocommerce_wp_text_input(array('id' => '_instanano_credits_amount', 'label' => 'Credits Amount', 'type' => 'number', 'custom_attributes' => array('min' => '1', 'step' => '1')));
    woocommerce_wp_select(array('id' => '_instanano_plan_tier', 'label' => 'Plan Tier', 'options' => array('individual' => 'Individual', 'lab' => 'Lab', 'department' => 'Department', 'university' => 'University')));
    woocommerce_wp_text_input(array('id' => '_instanano_validity_days', 'label' => 'Validity (days)', 'type' => 'number', 'placeholder' => '365', 'custom_attributes' => array('min' => '1')));
    echo '</div>';
}
add_action('woocommerce_process_product_meta', 'instanano_save_product_fields');
function instanano_save_product_fields($post_id)
{
    foreach (array('_instanano_credits_amount', '_instanano_plan_tier', '_instanano_validity_days') as $f) {
        if (isset($_POST[$f]))
            update_post_meta($post_id, $f, sanitize_text_field($_POST[$f]));
    }
}
add_filter('woocommerce_payment_complete_order_status', function ($status, $order_id) {
    $order = wc_get_order($order_id);
    if (!$order)
        return $status;
    foreach ($order->get_items() as $item) {
        if ((int) get_post_meta($item->get_product_id(), '_instanano_credits_amount', true) > 0)
            return 'completed';
    }
    return $status;
}, 10, 2);
add_action('woocommerce_order_status_completed', 'instanano_order_completed', 10, 1);
function instanano_make_bucket_order_id($order_id, $bucket_index)
{
    $order_id = max(0, (int) $order_id);
    $bucket_index = max(1, (int) $bucket_index);
    return (int) (7000000000000000000 + ($order_id * 1000) + $bucket_index);
}
function instanano_order_completed($order_id)
{
    $existing = instanano_get_account_by_order($order_id);
    if ($existing && (int) $existing->credits_total > 0)
        return;
    $order = wc_get_order($order_id);
    if (!$order)
        return;
    $groups = array();
    foreach ($order->get_items() as $item) {
        $pid = $item->get_product_id();
        $cr = (int) get_post_meta($pid, '_instanano_credits_amount', true);
        $ti = get_post_meta($pid, '_instanano_plan_tier', true);
        $da = (int) get_post_meta($pid, '_instanano_validity_days', true);
        if ($cr <= 0)
            continue;
        $days = $da > 0 ? $da : 365;
        if (!isset($groups[$days])) {
            $groups[$days] = array(
                'credits_total' => 0,
                'plan_label' => '',
            );
        }
        $groups[$days]['credits_total'] += $cr * $item->get_quantity();
        if ($ti)
            $groups[$days]['plan_label'] = get_the_title($pid);
    }
    if (!$groups)
        return;
    ksort($groups, SORT_NUMERIC);
    $created_at = gmdate('Y-m-d H:i:s');
    if ($order->get_date_created())
        $created_at = gmdate('Y-m-d H:i:s', $order->get_date_created()->getTimestamp());
    $billing_email = strtolower(trim((string) $order->get_billing_email()));
    $bucket_index = 0;
    foreach ($groups as $days => $group) {
        $bucket_order_id = (0 === $bucket_index) ? (int) $order_id : instanano_make_bucket_order_id((int) $order_id, $bucket_index);
        $aid = instanano_upsert_account($bucket_order_id, array(
            'plan_label' => (string) $group['plan_label'],
            'credits_total' => (int) $group['credits_total'],
            'credits_used' => 0,
            'expires_at' => gmdate('Y-m-d 23:59:59', strtotime($created_at . " +{$days} days")),
            'monthly_division' => 0,
            'per_email_monthly_limit' => 0,
            'notes' => '',
            'created_at' => $created_at,
        ));
        if ($aid > 0 && '' !== $billing_email) {
            instanano_sync_access($aid, 'email', array($billing_email), array());
        }
        $bucket_index++;
    }
}
function instanano_parse_list($raw)
{
    $raw = str_replace(array("\r", "\n", ';'), ',', (string) $raw);
    $parts = array_map('trim', explode(',', strtolower($raw)));
    return array_values(array_unique(array_filter($parts, function ($v) {
        return '' !== $v;
    })));
}
function instanano_sanitize_emails($raw)
{
    $out = array();
    foreach (instanano_parse_list($raw) as $v) {
        $e = sanitize_email($v);
        if ($e && is_email($e))
            $out[] = $e;
    }
    return array_values(array_unique($out));
}
function instanano_sanitize_domains($raw)
{
    $out = array();
    foreach (instanano_parse_list($raw) as $v) {
        $d = ltrim(trim($v), '@');
        $d = preg_replace('#^https?://#', '', $d);
        $d = trim($d, " \t\n\r\0\x0B./");
        if (preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', $d))
            $out[] = $d;
    }
    return array_values(array_unique($out));
}
function instanano_sanitize_date($s)
{
    $s = trim((string) $s);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s))
        return '';
    $dt = DateTimeImmutable::createFromFormat('Y-m-d', $s, new DateTimeZone('UTC'));
    return $dt ? $dt->format('Y-m-d') : '';
}
function instanano_normalize_sha($hex)
{
    $hex = strtolower(trim((string) $hex));
    return preg_match('/^[a-f0-9]{64}$/', $hex) ? $hex : '';
}
function instanano_xrd_lock_secret()
{
    return wp_salt('instanano_xrd_lock');
}
function instanano_xrd_fetch_secret()
{
    return wp_salt('instanano_xrd_fetch');
}
function instanano_xrd_fetch_ttl()
{
    return 15 * MINUTE_IN_SECONDS;
}
function instanano_xrd_fetch_rate_limits()
{
    return array(
        'window' => 60,
        'account' => 30,
        'day_window' => DAY_IN_SECONDS,
        'account_day' => 300,
    );
}
function instanano_rate_limit_hit($key, $limit, $window)
{
    $now = time();
    $limit = max(1, (int) $limit);
    $window = max(1, (int) $window);
    $state = get_transient($key);
    if (!is_array($state) || !isset($state['count'], $state['reset']) || (int) $state['reset'] <= $now) {
        $state = array('count' => 1, 'reset' => $now + $window);
    } else {
        $state['count'] = (int) $state['count'] + 1;
    }
    $ttl = max(1, (int) $state['reset'] - $now);
    set_transient($key, $state, $ttl);
    return array(
        'count' => (int) $state['count'],
        'limit' => $limit,
        'reset' => (int) $state['reset'],
        'remaining' => max(0, $limit - (int) $state['count']),
        'allowed' => ((int) $state['count'] <= $limit),
    );
}
function instanano_maybe_log_fetch_anomaly($account_id, $lock_hash, $account_hit)
{
    $a_near = (int) $account_hit['count'] >= (int) floor((int) $account_hit['limit'] * 0.9);
    if (!$a_near)
        return;
    $once_key = 'instanano_xrd_alert_' . md5((int) $account_id . '|' . gmdate('YmdH'));
    if (get_transient($once_key))
        return;
    set_transient($once_key, 1, HOUR_IN_SECONDS);
    error_log(sprintf(
        '[InstaNano XRD] High fetch rate: account=%d lock=%s account=%d/%d',
        (int) $account_id,
        substr((string) $lock_hash, 0, 12),
        (int) $account_hit['count'],
        (int) $account_hit['limit']
    ));
}
function instanano_xrd_issue_fetch_token($account_id, $lock_hash)
{
    $account_id = (int) $account_id;
    $lock_hash = instanano_normalize_sha($lock_hash);
    if ($account_id <= 0 || !$lock_hash)
        return array('token' => '', 'expires' => 0);
    $exp = time() + instanano_xrd_fetch_ttl();
    $sig = hash_hmac('sha256', $account_id . '|' . $lock_hash . '|' . $exp, instanano_xrd_fetch_secret());
    return array('token' => $exp . '.' . $sig, 'expires' => $exp);
}
function instanano_xrd_verify_fetch_token($token, $account_id, $lock_hash, &$reason = '')
{
    $reason = 'invalid';
    $account_id = (int) $account_id;
    $lock_hash = instanano_normalize_sha($lock_hash);
    $token = trim((string) $token);
    if ($account_id <= 0 || !$lock_hash || !preg_match('/^(\d{10})\.([a-f0-9]{64})$/', $token, $m))
        return false;
    $exp = (int) $m[1];
    if ($exp < time()) {
        $reason = 'expired';
        return false;
    }
    $expected = hash_hmac('sha256', $account_id . '|' . $lock_hash . '|' . $exp, instanano_xrd_fetch_secret());
    if (!hash_equals($expected, $m[2]))
        return false;
    $reason = 'ok';
    return true;
}
function instanano_xrd_sign_lock($lock_hash, $account_id)
{
    $lock_hash = instanano_normalize_sha($lock_hash);
    if (!$lock_hash)
        return '';
    $account_id = (int) $account_id;
    if ($account_id <= 0)
        return '';
    return hash_hmac('sha256', $account_id . '|' . $lock_hash, instanano_xrd_lock_secret());
}
function instanano_xrd_verify_lock($lock_hash, $signature, $account_id)
{
    $lock_hash = instanano_normalize_sha($lock_hash);
    $signature = strtolower(trim((string) $signature));
    if (!$lock_hash || !preg_match('/^[a-f0-9]{64}$/', $signature))
        return false;
    $expected = instanano_xrd_sign_lock($lock_hash, $account_id);
    return $expected && hash_equals($expected, $signature);
}
function instanano_get_account_by_order($order_id)
{
    global $wpdb;
    $account = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . instanano_table_accounts() . " WHERE order_id = %d LIMIT 1", $order_id));
    return instanano_sync_account_usage($account);
}
function instanano_get_account_by_id($id)
{
    global $wpdb;
    $account = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . instanano_table_accounts() . " WHERE id = %d LIMIT 1", $id));
    return instanano_sync_account_usage($account);
}
function instanano_sync_account_usage($account)
{
    if (!$account || empty($account->id))
        return $account;
    global $wpdb;
    $account_id = (int) $account->id;
    if ($account_id <= 0)
        return $account;
    $sha_used = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(credits_used),0) FROM " . instanano_table_sha() . " WHERE account_id = %d",
        $account_id
    ));
    $current_used = max(0, (int) $account->credits_used);
    if ($sha_used > $current_used) {
        $wpdb->query($wpdb->prepare(
            "UPDATE " . instanano_table_accounts() . " SET credits_used = %d, updated_at = UTC_TIMESTAMP() WHERE id = %d",
            $sha_used,
            $account_id
        ));
        $account->credits_used = $sha_used;
    }
    return $account;
}
function instanano_upsert_account($order_id, $data)
{
    global $wpdb;
    $table = instanano_table_accounts();
    $existing = instanano_get_account_by_order($order_id);
    $now = gmdate('Y-m-d H:i:s');
    $payload = array(
        'plan_label' => (string) $data['plan_label'],
        'credits_total' => (int) $data['credits_total'],
        'credits_used' => (int) $data['credits_used'],
        'expires_at' => (string) $data['expires_at'],
        'monthly_division' => (int) $data['monthly_division'],
        'per_email_monthly_limit' => (int) $data['per_email_monthly_limit'],
        'notes' => (string) $data['notes'],
        'updated_at' => $now,
    );
    $fmt = array('%s', '%d', '%d', '%s', '%d', '%d', '%s', '%s');
    if ($existing) {
        $wpdb->update($table, $payload, array('id' => (int) $existing->id), $fmt, array('%d'));
        return (int) $existing->id;
    }
    $payload['order_id'] = (int) $order_id;
    $payload['created_at'] = !empty($data['created_at']) ? (string) $data['created_at'] : $now;
    $wpdb->insert($table, $payload);
    return (int) $wpdb->insert_id;
}
function instanano_get_access_values($account_id, $type, $unlimited_only = false)
{
    global $wpdb;
    $table = instanano_table_access();
    $sql = $wpdb->prepare("SELECT access_value FROM {$table} WHERE account_id = %d AND access_type = %s", $account_id, $type);
    if ($unlimited_only)
        $sql .= ' AND is_unlimited = 1';
    $sql .= ' ORDER BY access_value ASC';
    return array_values(array_filter(array_map('strval', (array) $wpdb->get_col($sql))));
}
function instanano_sync_access($account_id, $type, $regular_values, $vip_values = array())
{
    global $wpdb;
    $table = instanano_table_access();
    $wpdb->delete($table, array('account_id' => (int) $account_id, 'access_type' => $type), array('%d', '%s'));
    foreach ($regular_values as $val) {
        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$table} (account_id, access_type, access_value, is_unlimited) VALUES (%d, %s, %s, 0)", (int) $account_id, $type, $val));
    }
    if ('email' === $type) {
        foreach ($vip_values as $val) {
            $wpdb->query($wpdb->prepare("INSERT INTO {$table} (account_id, access_type, access_value, is_unlimited) VALUES (%d, %s, %s, 1) ON DUPLICATE KEY UPDATE is_unlimited = 1", (int) $account_id, $type, $val));
        }
    }
}
function instanano_check_email_access($account_id, $email)
{
    $email = strtolower(trim((string) $email));
    if ('' === $email)
        return 'allowed';
    $email = sanitize_email($email);
    if (!$email || !is_email($email))
        return 'denied';
    global $wpdb;
    $table = instanano_table_access();
    $domain = substr(strrchr($email, '@'), 1);
    $rule_count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE account_id = %d", $account_id));
    if (0 === $rule_count)
        return 'allowed';
    $row = $wpdb->get_row($wpdb->prepare("SELECT is_unlimited FROM {$table} WHERE account_id = %d AND access_type = 'email' AND access_value = %s LIMIT 1", $account_id, $email));
    if ($row)
        return ((int) $row->is_unlimited === 1) ? 'vip' : 'allowed';
    if ($domain) {
        $dm = (int) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM {$table} WHERE account_id = %d AND access_type = 'domain' AND access_value = %s LIMIT 1", $account_id, $domain));
        if ($dm)
            return 'allowed';
    }
    return 'denied';
}
function instanano_get_monthly_budget($account)
{
    if (!(int) $account->monthly_division)
        return 0;
    $total = max(0, (int) $account->credits_total);
    if ($total <= 0)
        return 0;
    try {
        $start = new DateTimeImmutable((string) $account->created_at, new DateTimeZone('UTC'));
        $end = new DateTimeImmutable((string) $account->expires_at, new DateTimeZone('UTC'));
        $diff = $start->diff($end);
        $tm = max(1, ($diff->y * 12) + $diff->m + ($diff->d > 0 ? 1 : 0));
    } catch (Exception $e) {
        $tm = 12;
    }
    return (int) ceil($total / $tm);
}
function instanano_get_pool_cap($account)
{
    $total = max(0, (int) $account->credits_total);
    if (!(int) $account->monthly_division)
        return $total;
    $pm = instanano_get_monthly_budget($account);
    if ($pm <= 0)
        return 0;
    try {
        $start = new DateTimeImmutable((string) $account->created_at, new DateTimeZone('UTC'));
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $diff = $start->diff($now);
        $me = ($diff->y * 12) + $diff->m + 1;
    } catch (Exception $e) {
        $me = 1;
    }
    return min($total, $me * $pm);
}
function instanano_get_available_credits($account)
{
    return max(0, instanano_get_pool_cap($account) - max(0, (int) $account->credits_used));
}
function instanano_check_per_email_limit($account, $email, $access_status = 'allowed', $count = 1)
{
    $limit = (int) $account->per_email_monthly_limit;
    if ($limit <= 0)
        return true;
    if ('vip' === $access_status)
        return true;
    global $wpdb;
    $used = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COALESCE(SUM(credits_used),0) FROM " . instanano_table_sha() . " WHERE account_id = %d AND user_email = %s AND created_at >= %s",
        (int) $account->id,
        strtolower($email),
        gmdate('Y-m-01 00:00:00')
    ));
    $count = max(1, (int) $count);
    return ($used + $count) <= $limit;
}
function instanano_is_expired($account)
{
    $ts = strtotime((string) $account->expires_at . ' UTC');
    return !$ts || time() > $ts;
}
function instanano_get_sha_count($account_id)
{
    global $wpdb;
    return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM " . instanano_table_sha() . " WHERE account_id = %d", $account_id));
}
function instanano_sha_exists($account_id, $sha_hex)
{
    $sha_hex = instanano_normalize_sha($sha_hex);
    if (!$sha_hex)
        return false;
    global $wpdb;
    return (bool) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM " . instanano_table_sha() . " WHERE account_id = %d AND sha256 = UNHEX(%s) LIMIT 1", $account_id, $sha_hex));
}
function instanano_register_analysis($order_id, $sha_hex, $request_email = '', $count = 1)
{
    $account = instanano_get_account_by_order($order_id);
    return instanano_register_analysis_for_account($account, $sha_hex, $request_email, $count);
}
function instanano_register_analysis_for_account($account, $sha_hex, $request_email = '', $count = 1)
{
    $sha_hex = instanano_normalize_sha($sha_hex);
    $email = strtolower(trim($request_email));
    $count = max(1, (int) $count);
    if (!$sha_hex)
        return array('ok' => false, 'code' => 'invalid_sha', 'charged' => false, 'remaining' => 0, 'message' => 'Invalid SHA-256 hash format.');
    if (!$account)
        return array('ok' => false, 'code' => 'no_account', 'charged' => false, 'remaining' => 0, 'message' => 'No credit account found.');
    if (instanano_is_expired($account))
        return array('ok' => false, 'code' => 'expired', 'charged' => false, 'remaining' => 0, 'message' => 'Your credit plan has expired.');
    $access_status = instanano_check_email_access((int) $account->id, $email);
    if ('denied' === $access_status)
        return array('ok' => false, 'code' => 'email_denied', 'charged' => false, 'remaining' => instanano_get_available_credits($account), 'message' => 'Your email is not authorized.');
    if (!instanano_check_per_email_limit($account, $email, $access_status, $count))
        return array('ok' => false, 'code' => 'email_monthly_limit', 'charged' => false, 'remaining' => instanano_get_available_credits($account), 'message' => 'Monthly usage limit reached for your email.');
    global $wpdb;
    $at = instanano_table_accounts();
    $st = instanano_table_sha();
    $wpdb->query('START TRANSACTION');
    $locked = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$at} WHERE id = %d FOR UPDATE", (int) $account->id));
    if (!$locked) {
        $wpdb->query('ROLLBACK');
        return array('ok' => false, 'code' => 'lock_failed', 'charged' => false, 'remaining' => 0, 'message' => 'Temporarily unavailable. Try again.');
    }
    if (instanano_is_expired($locked)) {
        $wpdb->query('ROLLBACK');
        return array('ok' => false, 'code' => 'expired', 'charged' => false, 'remaining' => 0, 'message' => 'Your credit plan has expired.');
    }
    $inserted = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$st} (account_id, sha256, user_email, credits_used, created_at) VALUES (%d, UNHEX(%s), %s, %d, UTC_TIMESTAMP())", (int) $locked->id, $sha_hex, $email, $count));
    if (false === $inserted) {
        $wpdb->query('ROLLBACK');
        return array('ok' => false, 'code' => 'db_error', 'charged' => false, 'remaining' => instanano_get_available_credits($locked), 'message' => 'Database error. Try again.');
    }
    if (0 === (int) $inserted) {
        $alt = hash('sha256', $sha_hex . '|' . microtime(true) . '|' . wp_rand());
        $wpdb->query($wpdb->prepare("INSERT INTO {$st} (account_id, sha256, user_email, credits_used, created_at) VALUES (%d, UNHEX(%s), %s, %d, UTC_TIMESTAMP())", (int) $locked->id, $alt, $email, $count));
    }
    $available = instanano_get_available_credits($locked);
    if ($available < $count) {
        $wpdb->query('ROLLBACK');
        return array('ok' => false, 'code' => 'no_credits', 'charged' => false, 'remaining' => $available, 'message' => "Need {$count} credits, only {$available} available.");
    }
    $updated = $wpdb->query($wpdb->prepare("UPDATE {$at} SET credits_used = credits_used + %d, updated_at = UTC_TIMESTAMP() WHERE id = %d", $count, (int) $locked->id));
    if (1 !== (int) $updated) {
        $wpdb->query('ROLLBACK');
        return array('ok' => false, 'code' => 'deduct_failed', 'charged' => false, 'remaining' => $available, 'message' => 'Deduction failed. Try again.');
    }
    $wpdb->query('COMMIT');
    return array('ok' => true, 'code' => 'charged', 'charged' => true, 'remaining' => max(0, $available - $count), 'message' => "{$count} credit(s) used successfully.");
}
add_action('add_meta_boxes', 'instanano_add_order_metabox');
function instanano_add_order_metabox()
{
    foreach (array('shop_order', 'woocommerce_page_wc-orders') as $s) {
        add_meta_box('instanano_xrd_credit_controls', '🔬 InstaNano XRD Credit Controls', 'instanano_render_order_metabox', $s, 'normal', 'high');
    }
}
function instanano_resolve_order_id($p)
{
    if ($p instanceof WC_Order)
        return absint($p->get_id());
    if (is_object($p) && isset($p->ID))
        return absint($p->ID);
    if (is_numeric($p))
        return absint($p);
    return 0;
}
function instanano_render_order_metabox($post_or_order)
{
    $order_id = instanano_resolve_order_id($post_or_order);
    if (!$order_id) {
        echo '<p>Order not detected.</p>';
        return;
    }
    $order = wc_get_order($order_id);
    $account = instanano_get_account_by_order($order_id);
    $d = array(
        'plan_label' => '',
        'credits_total' => 0,
        'credits_used' => 0,
        'expires_date' => '',
        'monthly_division' => 0,
        'per_email_monthly_limit' => 0,
        'notes' => '',
        'allowed_emails' => '',
        'vip_emails' => '',
        'allowed_domains' => ''
    );
    if ($account) {
        $d['plan_label'] = (string) $account->plan_label;
        $d['credits_total'] = (int) $account->credits_total;
        $d['credits_used'] = (int) $account->credits_used;
        $d['expires_date'] = gmdate('Y-m-d', strtotime($account->expires_at . ' UTC'));
        $d['monthly_division'] = (int) $account->monthly_division;
        $d['per_email_monthly_limit'] = (int) $account->per_email_monthly_limit;
        $d['notes'] = (string) $account->notes;
        $all_e = instanano_get_access_values((int) $account->id, 'email');
        $vip_e = instanano_get_access_values((int) $account->id, 'email', true);
        $d['allowed_emails'] = implode(', ', array_diff($all_e, $vip_e));
        $d['vip_emails'] = implode(', ', $vip_e);
        $d['allowed_domains'] = implode(', ', instanano_get_access_values((int) $account->id, 'domain'));
    } else {
        $ca = gmdate('Y-m-d H:i:s');
        if ($order && $order->get_date_created())
            $ca = $order->get_date_created()->date('Y-m-d H:i:s');
        $d['expires_date'] = gmdate('Y-m-d', strtotime($ca . ' +1 year'));
    }
    $days_left = $d['expires_date'] ? max(0, (int) ((strtotime($d['expires_date'] . ' UTC') - time()) / 86400)) : 0;
    wp_nonce_field('instanano_xrd_save_' . $order_id, 'instanano_xrd_nonce');
    ?>
    <h4>Plan & Status</h4>
    <p><strong>Plan Label</strong><br><input type="text" name="in_plan_label" class="widefat"
            value="<?php echo esc_attr($d['plan_label']); ?>" placeholder="e.g. Researcher, PhD Bundle, Campus" /></p>
    <p><strong>Expiry Date</strong><br><input type="date" name="in_expires_date" class="widefat"
            value="<?php echo esc_attr($d['expires_date']); ?>" /><br><small><?php echo esc_html($days_left . ' days remaining'); ?></small>
    </p>
    <hr>
    <h4>Credits</h4>
    <p><strong>Total Credits</strong><br><input type="number" name="in_credits_total" class="widefat" min="0" step="1"
            value="<?php echo esc_attr($d['credits_total']); ?>" /></p>
    <p><strong>Used Credits:</strong> <?php echo esc_html((int) $d['credits_used']); ?></p>
    <hr>
    <h4>Monthly Division</h4>
    <p><label><input type="checkbox" name="in_monthly_division" value="1" <?php checked($d['monthly_division'], 1); ?> />
            Enable Monthly Division</label><br><small>Auto-calculates: total_credits / plan_months released per
            month.</small></p>
    <p><strong>Per-Email Monthly Limit</strong><br><input type="number" name="in_per_email_monthly_limit" class="widefat"
            min="0" step="1" value="<?php echo esc_attr($d['per_email_monthly_limit']); ?>"
            placeholder="0 = no limit" /><br><small>Max analyses per email per month. VIP emails bypass this.</small></p>
    <hr>
    <h4>Access Control</h4>
    <p><strong>Allowed Emails (comma-separated)</strong><br><textarea name="in_allowed_emails" class="widefat" rows="3"
            placeholder="student1@iitd.ac.in, student2@iitd.ac.in"><?php echo esc_textarea($d['allowed_emails']); ?></textarea>
    </p>
    <p><strong>VIP Emails — Unlimited Monthly Usage (comma-separated)</strong><br><textarea name="in_vip_emails"
            class="widefat" rows="2"
            placeholder="professor@iitd.ac.in"><?php echo esc_textarea($d['vip_emails']); ?></textarea><br><small>Bypass
            per-email monthly limits. Share the same credit pool.</small></p>
    <p><strong>Allowed Domains (comma-separated, without @)</strong><br><textarea name="in_allowed_domains" class="widefat"
            rows="2" placeholder="iitd.ac.in, iitb.ac.in"><?php echo esc_textarea($d['allowed_domains']); ?></textarea></p>
    <hr>
    <h4>Admin Notes</h4>
    <p><textarea name="in_notes" class="widefat" rows="3"
            placeholder="Negotiation details, special terms..."><?php echo esc_textarea($d['notes']); ?></textarea></p>
    <?php
}
add_action('woocommerce_process_shop_order_meta', 'instanano_save_order_metabox', 20, 2);
function instanano_save_order_metabox($order_id, $order = null)
{
    if (empty($_POST['instanano_xrd_nonce']))
        return;
    if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['instanano_xrd_nonce'])), 'instanano_xrd_save_' . $order_id))
        return;
    if (!current_user_can('manage_woocommerce') && !current_user_can('edit_shop_orders'))
        return;
    $plan_label = isset($_POST['in_plan_label']) ? sanitize_text_field(wp_unslash($_POST['in_plan_label'])) : '';
    $credits_total = isset($_POST['in_credits_total']) ? max(0, (int) $_POST['in_credits_total']) : 0;
    $account = instanano_get_account_by_order($order_id);
    $credits_used = $account ? (int) $account->credits_used : 0;
    $expires_date = isset($_POST['in_expires_date']) ? instanano_sanitize_date(wp_unslash($_POST['in_expires_date'])) : '';
    $monthly_div = !empty($_POST['in_monthly_division']) ? 1 : 0;
    $per_email_lim = isset($_POST['in_per_email_monthly_limit']) ? max(0, (int) $_POST['in_per_email_monthly_limit']) : 0;
    $notes = isset($_POST['in_notes']) ? sanitize_textarea_field(wp_unslash($_POST['in_notes'])) : '';
    $allowed_emails = instanano_sanitize_emails(isset($_POST['in_allowed_emails']) ? wp_unslash($_POST['in_allowed_emails']) : '');
    $vip_emails = instanano_sanitize_emails(isset($_POST['in_vip_emails']) ? wp_unslash($_POST['in_vip_emails']) : '');
    $allowed_doms = instanano_sanitize_domains(isset($_POST['in_allowed_domains']) ? wp_unslash($_POST['in_allowed_domains']) : '');
    $created_at = gmdate('Y-m-d H:i:s');
    if (!$order)
        $order = wc_get_order($order_id);
    if ($order instanceof WC_Order && $order->get_date_created())
        $created_at = gmdate('Y-m-d H:i:s', $order->get_date_created()->getTimestamp());
    if ('' === $expires_date)
        $expires_date = gmdate('Y-m-d', strtotime($created_at . ' +1 year'));
    $aid = instanano_upsert_account($order_id, array(
        'plan_label' => $plan_label,
        'credits_total' => $credits_total,
        'credits_used' => $credits_used,
        'expires_at' => $expires_date . ' 23:59:59',
        'monthly_division' => $monthly_div,
        'per_email_monthly_limit' => $per_email_lim,
        'notes' => $notes,
        'created_at' => $created_at,
    ));
    if ($aid > 0) {
        instanano_sync_access($aid, 'email', $allowed_emails, $vip_emails);
        instanano_sync_access($aid, 'domain', $allowed_doms);
    }
}
function instanano_account_matches_user($acct, $email, $domain, $user_id = 0)
{
    global $wpdb;
    $xt = instanano_table_access();
    $aid = (int) $acct->id;
    $rc = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$xt} WHERE account_id = %d", $aid));
    if (0 === $rc) {
        if ($user_id > 0) {
            $o = wc_get_order((int) $acct->order_id);
            return $o && (int) $o->get_user_id() === (int) $user_id;
        }
        return false;
    }
    if ($email) {
        $em = (int) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM {$xt} WHERE account_id = %d AND access_type = 'email' AND access_value = %s LIMIT 1", $aid, $email));
        if ($em)
            return true;
    }
    if ($domain) {
        $dm = (int) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM {$xt} WHERE account_id = %d AND access_type = 'domain' AND access_value = %s LIMIT 1", $aid, $domain));
        if ($dm)
            return true;
    }
    return false;
}
function instanano_find_accounts_for_user($user_email, $user_id = 0, $ignore_credits = false)
{
    global $wpdb;
    $at = instanano_table_accounts();
    $email = strtolower(trim((string) $user_email));
    $domain = $email ? substr(strrchr($email, '@'), 1) : '';
    $accounts = $wpdb->get_results("SELECT * FROM {$at} WHERE expires_at > UTC_TIMESTAMP() ORDER BY expires_at ASC, id ASC");
    if (!$accounts)
        return array();
    $out = array();
    foreach ($accounts as $acct) {
        $acct = instanano_sync_account_usage($acct);
        if (!$ignore_credits && instanano_get_available_credits($acct) <= 0)
            continue;
        if (!instanano_account_matches_user($acct, $email, $domain, $user_id))
            continue;
        $out[] = $acct;
    }
    return $out;
}
function instanano_find_account_for_user($user_email, $user_id = 0, $ignore_credits = false)
{
    $accounts = instanano_find_accounts_for_user($user_email, $user_id, $ignore_credits);
    return $accounts ? $accounts[0] : null;
}
function instanano_get_credit_snapshot($accounts)
{
    $out = array(
        'remaining_total' => 0,
        'total' => 0,
        'used' => 0,
        'current_remaining' => 0,
        'current_total' => 0,
        'current_used' => 0,
        'current_expires_at' => '',
        'current_plan_label' => '',
        'current_order_id' => 0,
        'current_account_id' => 0,
        'accounts_count' => 0,
    );
    if (!$accounts)
        return $out;
    $fallback_current = null;
    foreach ($accounts as $acct) {
        $rem = instanano_get_available_credits($acct);
        $out['remaining_total'] += $rem;
        $out['total'] += max(0, (int) $acct->credits_total);
        $out['used'] += max(0, (int) $acct->credits_used);
        $out['accounts_count']++;
        if (!$fallback_current)
            $fallback_current = $acct;
        if (!$out['current_account_id'] && $rem > 0) {
            $out['current_remaining'] = $rem;
            $out['current_total'] = max(0, (int) $acct->credits_total);
            $out['current_used'] = max(0, (int) $acct->credits_used);
            $out['current_expires_at'] = (string) $acct->expires_at;
            $out['current_plan_label'] = (string) $acct->plan_label;
            $out['current_order_id'] = (int) $acct->order_id;
            $out['current_account_id'] = (int) $acct->id;
        }
    }
    if (!$out['current_account_id'] && $fallback_current) {
        $out['current_remaining'] = instanano_get_available_credits($fallback_current);
        $out['current_total'] = max(0, (int) $fallback_current->credits_total);
        $out['current_used'] = max(0, (int) $fallback_current->credits_used);
        $out['current_expires_at'] = (string) $fallback_current->expires_at;
        $out['current_plan_label'] = (string) $fallback_current->plan_label;
        $out['current_order_id'] = (int) $fallback_current->order_id;
        $out['current_account_id'] = (int) $fallback_current->id;
    }
    return $out;
}
function instanano_get_user_account_by_id($account_id, $user_email, $user_id = 0)
{
    $account_id = (int) $account_id;
    if ($account_id <= 0)
        return null;
    $acct = instanano_get_account_by_id($account_id);
    if (!$acct || instanano_is_expired($acct))
        return null;
    $email = strtolower(trim((string) $user_email));
    $domain = $email ? substr(strrchr($email, '@'), 1) : '';
    if (!instanano_account_matches_user($acct, $email, $domain, $user_id))
        return null;
    return $acct;
}
add_action('wp_ajax_instanano_check_credit', 'instanano_ajax_check_credit');
function instanano_ajax_check_credit()
{
    if (!check_ajax_referer('instanano_credit_nonce', 'nonce', false))
        wp_send_json_error(array('message' => 'Security check failed.'), 403);
    if (!is_user_logged_in())
        wp_send_json_error(array('message' => 'Login required.'), 401);
    $user = wp_get_current_user();
    $accounts = instanano_find_accounts_for_user($user->user_email, $user->ID, true);
    if (!$accounts)
        wp_send_json_error(array('message' => 'No active credit plan found.', 'remaining' => 0));
    $credits = instanano_get_credit_snapshot($accounts);
    $current = $credits['current_account_id'] > 0 ? instanano_get_account_by_id((int) $credits['current_account_id']) : null;
    $access = $current ? instanano_check_email_access((int) $current->id, $user->user_email) : 'denied';
    wp_send_json_success(array(
        'remaining' => (int) $credits['remaining_total'],
        'remaining_total' => (int) $credits['remaining_total'],
        'total' => (int) $credits['total'],
        'used' => (int) $credits['used'],
        'current_remaining' => (int) $credits['current_remaining'],
        'current_total' => (int) $credits['current_total'],
        'current_used' => (int) $credits['current_used'],
        'expires_at' => (string) $credits['current_expires_at'],
        'plan_label' => (string) $credits['current_plan_label'],
        'order_id' => (int) $credits['current_order_id'],
        'account_id' => (int) $credits['current_account_id'],
        'accounts_count' => (int) $credits['accounts_count'],
        'is_vip' => ('vip' === $access),
    ));
}
add_action('wp_ajax_instanano_use_credit', 'instanano_ajax_use_credit');
function instanano_ajax_use_credit()
{
    if (!check_ajax_referer('instanano_credit_nonce', 'nonce', false))
        wp_send_json_error(array('message' => 'Security check failed.'), 403);
    if (!is_user_logged_in())
        wp_send_json_error(array('message' => 'Login required.'), 401);
    $lock_hash = instanano_normalize_sha(isset($_POST['lock_hash']) ? sanitize_text_field($_POST['lock_hash']) : '');
    if (!$lock_hash)
        $lock_hash = instanano_normalize_sha(isset($_POST['sha_hash']) ? sanitize_text_field($_POST['sha_hash']) : '');
    if (!$lock_hash)
        wp_send_json_error(array('message' => 'Invalid lock hash.'), 400);
    $user = wp_get_current_user();
    $accounts = instanano_find_accounts_for_user($user->user_email, $user->ID);
    if (!$accounts)
        wp_send_json_error(array('message' => 'No active credit plan. Purchase credits.', 'remaining' => 0));
    $count = isset($_POST['sample_count']) ? max(1, (int) $_POST['sample_count']) : 1;
    $retryable = array('email_monthly_limit', 'no_credits', 'expired', 'email_denied');
    $result = null;
    $charged_account = null;
    foreach ($accounts as $account) {
        $attempt = instanano_register_analysis_for_account($account, $lock_hash, $user->user_email, $count);
        if (!empty($attempt['ok'])) {
            $result = $attempt;
            $charged_account = $account;
            break;
        }
        $result = $attempt;
        if (!in_array((string) ($attempt['code'] ?? ''), $retryable, true))
            break;
    }
    if (!$charged_account) {
        if (!$result)
            $result = array('message' => 'No active credit plan. Purchase credits.', 'remaining' => 0, 'code' => 'no_account');
        wp_send_json_error(array('message' => $result['message'], 'remaining' => max(0, (int) ($result['remaining'] ?? 0)), 'code' => (string) ($result['code'] ?? 'failed')));
    }
    $snapshot_accounts = instanano_find_accounts_for_user($user->user_email, $user->ID, true);
    $credits = instanano_get_credit_snapshot($snapshot_accounts);
    if ($result['ok']) {
        $sig = instanano_xrd_sign_lock($lock_hash, (int) $charged_account->id);
        if (!$sig)
            wp_send_json_error(array('message' => 'Lock signing failed.', 'remaining' => (int) $credits['remaining_total']), 500);
        $fetch = instanano_xrd_issue_fetch_token((int) $charged_account->id, $lock_hash);
        if (!$fetch['token'])
            wp_send_json_error(array('message' => 'Fetch session issue.', 'remaining' => (int) $credits['remaining_total']), 500);
        wp_send_json_success(array(
            'message' => $result['message'],
            'deducted' => $result['charged'],
            'remaining' => (int) $credits['remaining_total'],
            'remaining_total' => (int) $credits['remaining_total'],
            'current_remaining' => (int) $credits['current_remaining'],
            'current_total' => (int) $credits['current_total'],
            'current_used' => (int) $credits['current_used'],
            'current_expires_at' => (string) $credits['current_expires_at'],
            'current_plan_label' => (string) $credits['current_plan_label'],
            'already_done' => false,
            'signature' => $sig,
            'lock_hash' => $lock_hash,
            'lock_version' => 1,
            'account_id' => (int) $charged_account->id,
            'fetch_token' => $fetch['token'],
            'fetch_token_expires' => (int) $fetch['expires']
        ));
    } else {
        wp_send_json_error(array('message' => $result['message'], 'remaining' => max(0, (int) ($result['remaining'] ?? 0)), 'code' => $result['code']));
    }
}
add_action('wp_ajax_instanano_verify_sha', 'instanano_ajax_verify_sha');
function instanano_ajax_verify_sha()
{
    if (!check_ajax_referer('instanano_credit_nonce', 'nonce', false))
        wp_send_json_error(array('message' => 'Security check failed.'), 403);
    if (!is_user_logged_in())
        wp_send_json_error(array('message' => 'Login required.'), 401);
    $sha_hex = instanano_normalize_sha(isset($_POST['sha_hash']) ? sanitize_text_field($_POST['sha_hash']) : '');
    if (!$sha_hex)
        wp_send_json_error(array('message' => 'Invalid SHA-256 hash.'), 400);
    $user = wp_get_current_user();
    $account = instanano_find_account_for_user($user->user_email, $user->ID);
    if (!$account)
        wp_send_json_error(array('message' => 'No active credit plan.'));
    $exists = instanano_sha_exists((int) $account->id, $sha_hex);
    wp_send_json_success(array('exists' => $exists, 'message' => $exists ? 'Already analyzed.' : 'New data — will use 1 credit.'));
}
add_action('wp_ajax_instanano_verify_lock', 'instanano_ajax_verify_lock');
function instanano_ajax_verify_lock()
{
    if (!check_ajax_referer('instanano_credit_nonce', 'nonce', false))
        wp_send_json_error(array('message' => 'Security check failed.'), 403);
    if (!is_user_logged_in())
        wp_send_json_error(array('message' => 'Login required.'), 401);
    $lock_hash = instanano_normalize_sha(isset($_POST['lock_hash']) ? sanitize_text_field($_POST['lock_hash']) : '');
    $signature = isset($_POST['signature']) ? sanitize_text_field($_POST['signature']) : '';
    $account_id = isset($_POST['account_id']) ? (int) $_POST['account_id'] : 0;
    if (!$lock_hash || !preg_match('/^[a-f0-9]{64}$/', strtolower($signature)))
        wp_send_json_error(array('message' => 'Invalid lock signature.'), 400);
    if ($account_id <= 0)
        wp_send_json_error(array('message' => 'Invalid account.'), 400);
    $user = wp_get_current_user();
    $account = instanano_get_user_account_by_id($account_id, $user->user_email, $user->ID);
    if (!$account)
        wp_send_json_error(array('message' => 'No active credit plan.'));
    $valid = instanano_xrd_verify_lock($lock_hash, $signature, (int) $account->id) && instanano_sha_exists((int) $account->id, $lock_hash);
    if (!$valid)
        wp_send_json_success(array('valid' => false));
    $fetch = instanano_xrd_issue_fetch_token((int) $account->id, $lock_hash);
    if (!$fetch['token'])
        wp_send_json_error(array('message' => 'Fetch session issue.'), 500);
    wp_send_json_success(array(
        'valid' => true,
        'account_id' => (int) $account->id,
        'fetch_token' => $fetch['token'],
        'fetch_token_expires' => (int) $fetch['expires']
    ));
}
add_action('wp_ajax_instanano_xrd_fetch_refs', 'instanano_ajax_xrd_fetch_refs');
function instanano_ajax_xrd_fetch_refs()
{
    if (!check_ajax_referer('instanano_credit_nonce', 'nonce', false))
        wp_send_json_error(array('message' => 'Security check failed.'), 403);
    if (!is_user_logged_in())
        wp_send_json_error(array('message' => 'Login required.'), 401);
    $lock_hash = instanano_normalize_sha(isset($_POST['lock_hash']) ? sanitize_text_field($_POST['lock_hash']) : '');
    $fetch_token = isset($_POST['fetch_token']) ? sanitize_text_field($_POST['fetch_token']) : '';
    $account_id = isset($_POST['account_id']) ? (int) $_POST['account_id'] : 0;
    if ($account_id <= 0)
        wp_send_json_error(array('message' => 'Invalid account.'), 400);
    $user = wp_get_current_user();
    $account = instanano_get_user_account_by_id($account_id, $user->user_email, $user->ID);
    if (!$account)
        wp_send_json_error(array('message' => 'No active credit plan.'), 403);
    if (!$lock_hash || !instanano_sha_exists((int) $account->id, $lock_hash))
        wp_send_json_error(array('message' => 'Access denied.'), 403);
    $reason = '';
    if (!instanano_xrd_verify_fetch_token($fetch_token, (int) $account->id, $lock_hash, $reason))
        wp_send_json_error(array(
            'message' => ('expired' === $reason) ? 'Session expired. Please retry.' : 'Invalid fetch session.',
            'code' => ('expired' === $reason) ? 'fetch_token_expired' : 'invalid_fetch_token'
        ), 403);
    $limits = instanano_xrd_fetch_rate_limits();
    $acct_hit = instanano_rate_limit_hit('instanano_xrd_rl_a_' . (int) $account->id, (int) $limits['account'], (int) $limits['window']);
    if (!$acct_hit['allowed'])
        wp_send_json_error(array(
            'message' => 'Too many requests. Please slow down.',
            'code' => 'rate_limited_account',
            'retry_after' => max(1, (int) $acct_hit['reset'] - time())
        ), 429);
    $acct_day_hit = instanano_rate_limit_hit('instanano_xrd_rl_ad_' . (int) $account->id, (int) $limits['account_day'], (int) $limits['day_window']);
    if (!$acct_day_hit['allowed'])
        wp_send_json_error(array(
            'message' => 'Daily limit reached. Please retry later.',
            'code' => 'rate_limited_account_daily',
            'retry_after' => max(1, (int) $acct_day_hit['reset'] - time())
        ), 429);
    instanano_maybe_log_fetch_anomaly((int) $account->id, $lock_hash, $acct_hit);
    $raw = isset($_POST['ref_ids']) ? $_POST['ref_ids'] : '';
    $ids = is_array($raw) ? array_map('sanitize_text_field', $raw) : array_filter(array_map('trim', explode(',', sanitize_text_field($raw))));
    $ids = array_values(array_unique(array_filter($ids)));
    if (count($ids) !== 1)
        wp_send_json_error(array('message' => 'Invalid request.'), 400);
    global $wpdb;
    $placeholders = implode(',', array_fill(0, count($ids), '%s'));
    $sql = $wpdb->prepare("SELECT ref, ChF, MnN, json FROM {$wpdb->prefix}xrd_references WHERE ref IN ({$placeholders})", $ids);
    $rows = $wpdb->get_results($sql, ARRAY_A);
    $out = array();
    foreach ($rows as $r) {
        $out[$r['ref']] = array('formula' => $r['ChF'], 'mineral' => $r['MnN'], 'data' => json_decode($r['json'], true));
    }
    wp_send_json_success($out);
}
add_action('wp_head', 'instanano_enqueue_credit_nonce');
function instanano_enqueue_credit_nonce()
{
    if (is_admin() || !is_user_logged_in())
        return;
    echo '<script>var instananoCredits={ajaxUrl:"' . esc_url(admin_url('admin-ajax.php')) . '",nonce:"' . wp_create_nonce('instanano_credit_nonce') . '"};</script>';
}
add_action('admin_init', 'instanano_schedule_cron');
function instanano_schedule_cron()
{
    if (!wp_next_scheduled('instanano_daily_maintenance'))
        wp_schedule_event(time(), 'daily', 'instanano_daily_maintenance');
}
add_action('instanano_daily_maintenance', function () {
    global $wpdb;
    $table = instanano_table_sha();
    $wpdb->query("DELETE FROM {$table} WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)");
});
add_action('switch_theme', function () {
    $ts = wp_next_scheduled('instanano_daily_maintenance');
    if ($ts)
        wp_unschedule_event($ts, 'instanano_daily_maintenance');
});
add_filter('manage_edit-shop_order_columns', 'instanano_add_orders_column');
add_filter('manage_woocommerce_page_wc-orders_columns', 'instanano_add_orders_column');
function instanano_add_orders_column($columns)
{
    $new = array();
    foreach ($columns as $k => $l) {
        $new[$k] = $l;
        if ('order_status' === $k)
            $new['instanano_credits'] = 'Credits';
    }
    return $new;
}
add_action('manage_shop_order_posts_custom_column', 'instanano_render_orders_column', 10, 2);
add_action('manage_woocommerce_page_wc-orders_custom_column', 'instanano_render_orders_column', 10, 2);
function instanano_render_orders_column($column, $p)
{
    if ('instanano_credits' !== $column)
        return;
    $oid = is_object($p) && method_exists($p, 'get_id') ? $p->get_id() : $p;
    $a = instanano_get_account_by_order($oid);
    if (!$a) {
        echo '—';
        return;
    }
    $r = max(0, (int) $a->credits_total - (int) $a->credits_used);
    $c = $r > 0 ? '#00a32a' : '#d63638';
    $x = instanano_is_expired($a) ? ' ⏰' : '';
    printf('<span style="font-weight:600;color:%s;">%d</span> / %d%s', esc_attr($c), $r, (int) $a->credits_total, $x);
}
