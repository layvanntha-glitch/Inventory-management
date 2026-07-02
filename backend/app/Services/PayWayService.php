<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * ABA PayWay integration (KHQR / ABA Pay), built to the official spec:
 *   Generate QR:       POST {base}/api/payment-gateway/v1/payments/generate-qr
 *   Check transaction: POST {base}/api/payment-gateway/v1/payments/check-transaction-2
 *
 * Credentials come from .env — never hardcode them:
 *   PAYWAY_BASE_URL     https://checkout.payway.com.kh          (production)
 *                       https://checkout-sandbox.payway.com.kh  (sandbox)
 *   PAYWAY_MERCHANT_ID  merchant id from ABA
 *   PAYWAY_API_KEY      API key / public key (secret)
 *   PAYWAY_RETURN_URL   public callback, e.g. https://yourdomain/api/payway/callback
 */
class PayWayService
{
    private const QR_TEMPLATE = 'template3_color';
    private const LIFETIME_MINUTES = 30;

    public function isConfigured(): bool
    {
        return (bool) env('PAYWAY_MERCHANT_ID') && (bool) env('PAYWAY_API_KEY');
    }

    private function baseUrl(): string
    {
        return rtrim(env('PAYWAY_BASE_URL', 'https://checkout.payway.com.kh'), '/');
    }

    private function reqTime(): string
    {
        return now()->utc()->format('YmdHis');
    }

    /** KHR has no decimals, USD has 2. Same string is used in the body and the hash. */
    private function formatAmount(float $amount, string $currency): string
    {
        return $currency === 'KHR' ? (string) round($amount) : number_format($amount, 2, '.', '');
    }

    private function makeHash(string $data): string
    {
        return base64_encode(hash_hmac('sha512', $data, env('PAYWAY_API_KEY'), true));
    }

    /**
     * Generate a KHQR for a checkout.
     * Returns ['ok','qr_string','qr_image','deeplink','message','raw'].
     */
    public function createKhqr(string $tranId, float $amount, string $currency, array $items, array $customer = []): array
    {
        $currency = strtoupper($currency);

        // Hash field order per the Generate-QR spec:
        // req_time, merchant_id, tran_id, amount, items, first_name, last_name, email,
        // phone, purchase_type, payment_option, callback_url, return_deeplink, currency,
        // custom_fields, return_params, payout, lifetime, qr_image_template
        $f = [
            'req_time' => $this->reqTime(),
            'merchant_id' => env('PAYWAY_MERCHANT_ID'),
            'tran_id' => $tranId,
            'amount' => $this->formatAmount($amount, $currency),
            'items' => base64_encode(json_encode(array_map(fn ($i) => [
                'name' => $i['name'] ?? 'Item',
                'quantity' => (int) ($i['quantity'] ?? 1),
                'price' => (float) ($i['price'] ?? 0),
            ], $items))),
            'first_name' => $customer['firstname'] ?? '',
            'last_name' => $customer['lastname'] ?? '',
            'email' => $customer['email'] ?? '',
            'phone' => $customer['phone'] ?? '',
            'purchase_type' => '',
            'payment_option' => 'abapay_khqr',
            'callback_url' => env('PAYWAY_RETURN_URL', ''),
            'return_deeplink' => '',
            'currency' => $currency,
            'custom_fields' => '',
            'return_params' => '',
            'payout' => '',
            'lifetime' => (string) self::LIFETIME_MINUTES,
            'qr_image_template' => self::QR_TEMPLATE,
        ];

        $f['hash'] = $this->makeHash(
            $f['req_time'] . $f['merchant_id'] . $f['tran_id'] . $f['amount'] . $f['items']
            . $f['first_name'] . $f['last_name'] . $f['email'] . $f['phone'] . $f['purchase_type']
            . $f['payment_option'] . $f['callback_url'] . $f['return_deeplink'] . $f['currency']
            . $f['custom_fields'] . $f['return_params'] . $f['payout'] . $f['lifetime'] . $f['qr_image_template']
        );

        try {
            $response = Http::acceptJson()
                ->post($this->baseUrl() . '/api/payment-gateway/v1/payments/generate-qr', $f);

            $data = $response->json() ?? [];
            $code = $data['status']['code'] ?? null;

            return [
                'ok' => ($code === '0' || $code === 0),
                'qr_string' => $data['qrString'] ?? null,
                'qr_image' => $data['qrImage'] ?? null,
                'deeplink' => $data['abapay_deeplink'] ?? null,
                'message' => $data['status']['message'] ?? null,
                'raw' => $data,
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => 'Gateway error: ' . $e->getMessage(), 'raw' => null];
        }
    }

    /**
     * Server-to-server confirmation. Hash = HMAC-SHA512(req_time + merchant_id + tran_id).
     * Approved when payment_status === "APPROVED".
     * Returns ['approved','status','raw'].
     */
    public function checkTransaction(string $tranId): array
    {
        $reqTime = $this->reqTime();
        $merchantId = env('PAYWAY_MERCHANT_ID');

        $body = [
            'req_time' => $reqTime,
            'merchant_id' => $merchantId,
            'tran_id' => $tranId,
            'hash' => $this->makeHash($reqTime . $merchantId . $tranId),
        ];

        try {
            $response = Http::acceptJson()
                ->post($this->baseUrl() . '/api/payment-gateway/v1/payments/check-transaction-2', $body);

            $data = $response->json() ?? [];
            $paymentStatus = strtoupper($data['payment_status'] ?? ($data['data']['payment_status'] ?? ''));

            return [
                'approved' => $paymentStatus === 'APPROVED',
                'status' => $paymentStatus ?: 'PENDING',
                'raw' => $data,
            ];
        } catch (\Throwable $e) {
            return ['approved' => false, 'status' => 'ERROR', 'raw' => ['message' => $e->getMessage()]];
        }
    }
}
