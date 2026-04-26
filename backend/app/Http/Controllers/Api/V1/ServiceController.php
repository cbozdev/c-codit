<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceOrderResource;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Services\ServicePurchaseService;
use App\Services\Sms\ServiceUnavailableException;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function __construct(private readonly ServicePurchaseService $purchases) {}

    public function index()
    {
        $services = Service::where('is_active', true)
            ->orderBy('category')
            ->orderBy('name')
            ->get();
        return ApiResponse::ok(ServiceResource::collection($services));
    }

    public function show(string $code)
    {
        $service = Service::where('code', $code)->firstOrFail();
        return ApiResponse::ok(new ServiceResource($service));
    }

    /**
     * Unified purchase endpoint — handles virtual numbers, utility bills, gift cards.
     */
    public function purchase(Request $request)
    {
        $request->validate([
            'service_code'    => ['required', 'string', 'exists:services,code'],
            // Virtual number fields
            'service'         => ['nullable', 'string', 'max:40'],
            'country'         => ['nullable', 'string', 'max:20'],
            // Utility bill fields
            'amount'          => ['nullable', 'numeric', 'min:1', 'max:1000000'],
            'network'         => ['nullable', 'string', 'max:30'],
            'phone_number'    => ['nullable', 'string', 'max:20'],
            'meter_number'    => ['nullable', 'string', 'max:30'],
            'smartcard_number'=> ['nullable', 'string', 'max:30'],
            'plan'            => ['nullable', 'string', 'max:50'],
            'plan_code'       => ['nullable', 'string', 'max:20'],
            // Gift card fields
            'denomination'    => ['nullable', 'numeric', 'min:1', 'max:500'],
            // eSIM fields
            'package_id'      => ['nullable', 'string', 'max:120'],
        ]);

        $service = Service::where('code', $request->input('service_code'))
            ->where('is_active', true)
            ->firstOrFail();

        $idempotencyKey = (string) $request->header('Idempotency-Key', \Illuminate\Support\Str::uuid());

        try {
            $order = $this->purchases->purchase(
                user: $request->user(),
                service: $service,
                request: $request->except(['service_code']),
                idempotencyKey: $idempotencyKey,
            );
        } catch (ServiceUnavailableException $e) {
            return ApiResponse::fail($e->getMessage(), null, 409);
        } catch (\App\Services\Ledger\InsufficientFundsException $e) {
            return ApiResponse::fail('Insufficient wallet balance. Please top up first.', null, 402);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ApiResponse::fail('Provider is temporarily unreachable. Please try again in a moment.', null, 503);
        } catch (\RuntimeException $e) {
            return ApiResponse::fail($e->getMessage(), null, 422);
        }

        $order->loadMissing('service');
        return ApiResponse::ok(new ServiceOrderResource($order), 'Order placed successfully.');
    }

    // Keep old method as alias for backward compatibility
    public function purchaseVirtualNumber(Request $request)
    {
        return $this->purchase($request);
    }

    /**
     * List available Airalo eSIM packages for the plan selector.
     * GET /services/esim-packages?type=global|local|regional&country=US
     */
    public function esimPackages(Request $request)
    {
        $request->validate([
            'type'    => ['nullable', 'in:local,global,regional'],
            'country' => ['nullable', 'string', 'size:2'],
        ]);

        try {
            $airalo   = app(\App\Services\Esim\AiraloService::class);
            $type     = $request->input('type', 'global');
            $country  = $request->input('country');
            $packages = $airalo->getPackages($type, $country ? strtoupper($country) : null);

            // Get service markup so frontend can show the real price
            $service = \App\Models\Service::where('code', 'esim_travel')->first();
            $markup  = $service ? ((float) $service->markup_percent ?? 15) : 15;

            $formatted = array_map(function (array $pkg) use ($markup) {
                $base      = (float) ($pkg['price'] ?? $pkg['net_price'] ?? 0);
                $finalUsd  = round($base * (1 + $markup / 100), 2);

                return [
                    'package_id'   => $pkg['id'] ?? $pkg['package_id'] ?? $pkg['slug'],
                    'title'        => $pkg['title'] ?? ($pkg['data'] . ' – ' . $pkg['day'] . ' day' . ($pkg['day'] > 1 ? 's' : '')),
                    'data'         => $pkg['data'] ?? null,
                    'days'         => (int) ($pkg['day'] ?? $pkg['validity'] ?? 0),
                    'base_price'   => $base,
                    'price'        => $finalUsd,
                    'countries'    => collect($pkg['operators'] ?? [])->pluck('countries')->flatten(1)
                                          ->pluck('title')->unique()->values()->all(),
                    'operator'     => $pkg['operators'][0]['title'] ?? null,
                ];
            }, $packages);

            return ApiResponse::ok($formatted);
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not load eSIM plans: ' . $e->getMessage(), null, 503);
        }
    }

    /**
     * List available countries + prices for a virtual number provider/service.
     * GET /services/virtual-number-prices?provider=5sim|smsactivate&service=telegram
     */
    public function virtualNumberPrices(Request $request)
    {
        $request->validate([
            'provider' => ['required', 'in:5sim,smsactivate'],
            'service'  => ['required', 'string', 'max:40'],
        ]);

        $provider = $request->input('provider');
        $service  = $request->input('service');

        try {
            if ($provider === '5sim') {
                $raw     = app(\App\Services\Sms\FiveSimService::class)->getCountryPrices($service);
                $display = self::fiveSimDisplayMap();
            } else {
                $raw     = app(\App\Services\Sms\SmsActivateService::class)->getCountryPrices($service);
                $display = self::smsActivateDisplayMap();
            }

            $svc     = \App\Models\Service::where('provider', $provider)->where('category', 'virtual_number')->first();
            $markup  = $svc ? ((float) ($svc->markup_percent ?? 20)) : 20;

            $items = array_map(function (array $row) use ($display, $markup) {
                $info  = $display[$row['country_code']] ?? null;
                $price = round($row['price_usd'] * (1 + $markup / 100), 4);
                return [
                    'country_code'  => $row['country_code'],
                    'country_label' => $info['label'] ?? ucwords(str_replace(['-', '_'], ' ', $row['country_code'])),
                    'flag'          => $info['flag'] ?? '🌍',
                    'count'         => $row['count'],
                    'price_usd'     => $price,
                ];
            }, $raw);

            return ApiResponse::ok(['items' => $items]);
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not load prices: ' . $e->getMessage(), null, 503);
        }
    }

    private static function fiveSimDisplayMap(): array
    {
        return [
            'russia'            => ['label' => 'Russia',             'flag' => '🇷🇺'],
            'ukraine'           => ['label' => 'Ukraine',            'flag' => '🇺🇦'],
            'kazakhstan'        => ['label' => 'Kazakhstan',         'flag' => '🇰🇿'],
            'usa'               => ['label' => 'United States',      'flag' => '🇺🇸'],
            'england'           => ['label' => 'United Kingdom',     'flag' => '🇬🇧'],
            'india'             => ['label' => 'India',              'flag' => '🇮🇳'],
            'indonesia'         => ['label' => 'Indonesia',          'flag' => '🇮🇩'],
            'china'             => ['label' => 'China',              'flag' => '🇨🇳'],
            'nigeria'           => ['label' => 'Nigeria',            'flag' => '🇳🇬'],
            'brazil'            => ['label' => 'Brazil',             'flag' => '🇧🇷'],
            'germany'           => ['label' => 'Germany',            'flag' => '🇩🇪'],
            'france'            => ['label' => 'France',             'flag' => '🇫🇷'],
            'philippines'       => ['label' => 'Philippines',        'flag' => '🇵🇭'],
            'vietnam'           => ['label' => 'Vietnam',            'flag' => '🇻🇳'],
            'malaysia'          => ['label' => 'Malaysia',           'flag' => '🇲🇾'],
            'thailand'          => ['label' => 'Thailand',           'flag' => '🇹🇭'],
            'myanmar'           => ['label' => 'Myanmar',            'flag' => '🇲🇲'],
            'kenya'             => ['label' => 'Kenya',              'flag' => '🇰🇪'],
            'tanzania'          => ['label' => 'Tanzania',           'flag' => '🇹🇿'],
            'ghana'             => ['label' => 'Ghana',              'flag' => '🇬🇭'],
            'ethiopia'          => ['label' => 'Ethiopia',           'flag' => '🇪🇹'],
            'cambodia'          => ['label' => 'Cambodia',           'flag' => '🇰🇭'],
            'canada'            => ['label' => 'Canada',             'flag' => '🇨🇦'],
            'mexico'            => ['label' => 'Mexico',             'flag' => '🇲🇽'],
            'colombia'          => ['label' => 'Colombia',           'flag' => '🇨🇴'],
            'argentina'         => ['label' => 'Argentina',          'flag' => '🇦🇷'],
            'southafrica'       => ['label' => 'South Africa',       'flag' => '🇿🇦'],
            'egypt'             => ['label' => 'Egypt',              'flag' => '🇪🇬'],
            'poland'            => ['label' => 'Poland',             'flag' => '🇵🇱'],
            'netherlands'       => ['label' => 'Netherlands',        'flag' => '🇳🇱'],
            'sweden'            => ['label' => 'Sweden',             'flag' => '🇸🇪'],
            'pakistan'          => ['label' => 'Pakistan',           'flag' => '🇵🇰'],
            'bangladesh'        => ['label' => 'Bangladesh',         'flag' => '🇧🇩'],
            'uzbekistan'        => ['label' => 'Uzbekistan',         'flag' => '🇺🇿'],
            'kyrgyzstan'        => ['label' => 'Kyrgyzstan',         'flag' => '🇰🇬'],
            'tajikistan'        => ['label' => 'Tajikistan',         'flag' => '🇹🇯'],
            'israel'            => ['label' => 'Israel',             'flag' => '🇮🇱'],
            'turkey'            => ['label' => 'Turkey',             'flag' => '🇹🇷'],
            'saudiarabia'       => ['label' => 'Saudi Arabia',       'flag' => '🇸🇦'],
            'uae'               => ['label' => 'UAE',                'flag' => '🇦🇪'],
            'iraq'              => ['label' => 'Iraq',               'flag' => '🇮🇶'],
            'iran'              => ['label' => 'Iran',               'flag' => '🇮🇷'],
            'spain'             => ['label' => 'Spain',              'flag' => '🇪🇸'],
            'italy'             => ['label' => 'Italy',              'flag' => '🇮🇹'],
            'romania'           => ['label' => 'Romania',            'flag' => '🇷🇴'],
            'belarus'           => ['label' => 'Belarus',            'flag' => '🇧🇾'],
            'moldova'           => ['label' => 'Moldova',            'flag' => '🇲🇩'],
            'azerbaijan'        => ['label' => 'Azerbaijan',         'flag' => '🇦🇿'],
            'georgia'           => ['label' => 'Georgia',            'flag' => '🇬🇪'],
            'armenia'           => ['label' => 'Armenia',            'flag' => '🇦🇲'],
            'hongkong'          => ['label' => 'Hong Kong',          'flag' => '🇭🇰'],
            'taiwan'            => ['label' => 'Taiwan',             'flag' => '🇹🇼'],
            'peru'              => ['label' => 'Peru',               'flag' => '🇵🇪'],
            'chile'             => ['label' => 'Chile',              'flag' => '🇨🇱'],
            'venezuela'         => ['label' => 'Venezuela',          'flag' => '🇻🇪'],
            'bolivia'           => ['label' => 'Bolivia',            'flag' => '🇧🇴'],
            'ecuador'           => ['label' => 'Ecuador',            'flag' => '🇪🇨'],
            'guinea'            => ['label' => 'Guinea',             'flag' => '🇬🇳'],
            'senegal'           => ['label' => 'Senegal',            'flag' => '🇸🇳'],
            'cameroon'          => ['label' => 'Cameroon',           'flag' => '🇨🇲'],
            'uganda'            => ['label' => 'Uganda',             'flag' => '🇺🇬'],
            'angola'            => ['label' => 'Angola',             'flag' => '🇦🇴'],
            'mozambique'        => ['label' => 'Mozambique',         'flag' => '🇲🇿'],
            'zambia'            => ['label' => 'Zambia',             'flag' => '🇿🇲'],
            'zimbabwe'          => ['label' => 'Zimbabwe',           'flag' => '🇿🇼'],
            'algeria'           => ['label' => 'Algeria',            'flag' => '🇩🇿'],
            'morocco'           => ['label' => 'Morocco',            'flag' => '🇲🇦'],
            'tunisia'           => ['label' => 'Tunisia',            'flag' => '🇹🇳'],
            'czech'             => ['label' => 'Czech Republic',     'flag' => '🇨🇿'],
            'portugal'          => ['label' => 'Portugal',           'flag' => '🇵🇹'],
            'austria'           => ['label' => 'Austria',            'flag' => '🇦🇹'],
            'hungary'           => ['label' => 'Hungary',            'flag' => '🇭🇺'],
            'norway'            => ['label' => 'Norway',             'flag' => '🇳🇴'],
            'denmark'           => ['label' => 'Denmark',            'flag' => '🇩🇰'],
            'finland'           => ['label' => 'Finland',            'flag' => '🇫🇮'],
            'switzerland'       => ['label' => 'Switzerland',        'flag' => '🇨🇭'],
            'bulgaria'          => ['label' => 'Bulgaria',           'flag' => '🇧🇬'],
            'croatia'           => ['label' => 'Croatia',            'flag' => '🇭🇷'],
            'lithuania'         => ['label' => 'Lithuania',          'flag' => '🇱🇹'],
            'latvia'            => ['label' => 'Latvia',             'flag' => '🇱🇻'],
            'estonia'           => ['label' => 'Estonia',            'flag' => '🇪🇪'],
            'slovakia'          => ['label' => 'Slovakia',           'flag' => '🇸🇰'],
            'mongolia'          => ['label' => 'Mongolia',           'flag' => '🇲🇳'],
            'laos'              => ['label' => 'Laos',               'flag' => '🇱🇦'],
            'srilanka'          => ['label' => 'Sri Lanka',          'flag' => '🇱🇰'],
            'nepal'             => ['label' => 'Nepal',              'flag' => '🇳🇵'],
            'cuba'              => ['label' => 'Cuba',               'flag' => '🇨🇺'],
            'dominicanrepublic' => ['label' => 'Dominican Republic', 'flag' => '🇩🇴'],
            'puertorico'        => ['label' => 'Puerto Rico',        'flag' => '🇵🇷'],
            'jamaica'           => ['label' => 'Jamaica',            'flag' => '🇯🇲'],
            'haiti'             => ['label' => 'Haiti',              'flag' => '🇭🇹'],
            'newzealand'        => ['label' => 'New Zealand',        'flag' => '🇳🇿'],
            'singapore'         => ['label' => 'Singapore',          'flag' => '🇸🇬'],
            'costarica'         => ['label' => 'Costa Rica',         'flag' => '🇨🇷'],
            'guatemala'         => ['label' => 'Guatemala',          'flag' => '🇬🇹'],
            'honduras'          => ['label' => 'Honduras',           'flag' => '🇭🇳'],
            'nicaragua'         => ['label' => 'Nicaragua',          'flag' => '🇳🇮'],
            'elsalvador'        => ['label' => 'El Salvador',        'flag' => '🇸🇻'],
            'serbia'            => ['label' => 'Serbia',             'flag' => '🇷🇸'],
            'belgium'           => ['label' => 'Belgium',            'flag' => '🇧🇪'],
            'bahrain'           => ['label' => 'Bahrain',            'flag' => '🇧🇭'],
            'kuwait'            => ['label' => 'Kuwait',             'flag' => '🇰🇼'],
            'afghanistan'       => ['label' => 'Afghanistan',        'flag' => '🇦🇫'],
            'ivorycoast'        => ['label' => 'Ivory Coast',        'flag' => '🇨🇮'],
            'mali'              => ['label' => 'Mali',               'flag' => '🇲🇱'],
            'sudan'             => ['label' => 'Sudan',              'flag' => '🇸🇩'],
            'togo'              => ['label' => 'Togo',               'flag' => '🇹🇬'],
            'jordan'            => ['label' => 'Jordan',             'flag' => '🇯🇴'],
        ];
    }

    private static function smsActivateDisplayMap(): array
    {
        return [
            '0'   => ['label' => 'Russia',             'flag' => '🇷🇺'],
            '1'   => ['label' => 'Ukraine',            'flag' => '🇺🇦'],
            '2'   => ['label' => 'Kazakhstan',         'flag' => '🇰🇿'],
            '3'   => ['label' => 'China',              'flag' => '🇨🇳'],
            '4'   => ['label' => 'Philippines',        'flag' => '🇵🇭'],
            '5'   => ['label' => 'Myanmar',            'flag' => '🇲🇲'],
            '6'   => ['label' => 'Indonesia',          'flag' => '🇮🇩'],
            '7'   => ['label' => 'Malaysia',           'flag' => '🇲🇾'],
            '8'   => ['label' => 'Kenya',              'flag' => '🇰🇪'],
            '9'   => ['label' => 'Tanzania',           'flag' => '🇹🇿'],
            '10'  => ['label' => 'Vietnam',            'flag' => '🇻🇳'],
            '11'  => ['label' => 'Kyrgyzstan',         'flag' => '🇰🇬'],
            '12'  => ['label' => 'United States',      'flag' => '🇺🇸'],
            '13'  => ['label' => 'Israel',             'flag' => '🇮🇱'],
            '14'  => ['label' => 'Hong Kong',          'flag' => '🇭🇰'],
            '15'  => ['label' => 'Poland',             'flag' => '🇵🇱'],
            '16'  => ['label' => 'United Kingdom',     'flag' => '🇬🇧'],
            '17'  => ['label' => 'Madagascar',         'flag' => '🇲🇬'],
            '18'  => ['label' => 'Congo',              'flag' => '🇨🇬'],
            '19'  => ['label' => 'Nigeria',            'flag' => '🇳🇬'],
            '20'  => ['label' => 'Macau',              'flag' => '🇲🇴'],
            '21'  => ['label' => 'Egypt',              'flag' => '🇪🇬'],
            '22'  => ['label' => 'India',              'flag' => '🇮🇳'],
            '23'  => ['label' => 'Ireland',            'flag' => '🇮🇪'],
            '24'  => ['label' => 'Cambodia',           'flag' => '🇰🇭'],
            '25'  => ['label' => 'Laos',               'flag' => '🇱🇦'],
            '26'  => ['label' => 'Haiti',              'flag' => '🇭🇹'],
            '27'  => ['label' => 'Ivory Coast',        'flag' => '🇨🇮'],
            '28'  => ['label' => 'Gambia',             'flag' => '🇬🇲'],
            '29'  => ['label' => 'Serbia',             'flag' => '🇷🇸'],
            '30'  => ['label' => 'Yemen',              'flag' => '🇾🇪'],
            '31'  => ['label' => 'South Africa',       'flag' => '🇿🇦'],
            '32'  => ['label' => 'Romania',            'flag' => '🇷🇴'],
            '33'  => ['label' => 'Colombia',           'flag' => '🇨🇴'],
            '34'  => ['label' => 'Estonia',            'flag' => '🇪🇪'],
            '35'  => ['label' => 'Azerbaijan',         'flag' => '🇦🇿'],
            '36'  => ['label' => 'Canada',             'flag' => '🇨🇦'],
            '37'  => ['label' => 'Morocco',            'flag' => '🇲🇦'],
            '38'  => ['label' => 'Ghana',              'flag' => '🇬🇭'],
            '39'  => ['label' => 'Argentina',          'flag' => '🇦🇷'],
            '40'  => ['label' => 'Uzbekistan',         'flag' => '🇺🇿'],
            '41'  => ['label' => 'Cameroon',           'flag' => '🇨🇲'],
            '42'  => ['label' => 'Chad',               'flag' => '🇹🇩'],
            '43'  => ['label' => 'Germany',            'flag' => '🇩🇪'],
            '44'  => ['label' => 'Lithuania',          'flag' => '🇱🇹'],
            '45'  => ['label' => 'Croatia',            'flag' => '🇭🇷'],
            '46'  => ['label' => 'Sweden',             'flag' => '🇸🇪'],
            '47'  => ['label' => 'Iraq',               'flag' => '🇮🇶'],
            '48'  => ['label' => 'Netherlands',        'flag' => '🇳🇱'],
            '49'  => ['label' => 'Latvia',             'flag' => '🇱🇻'],
            '50'  => ['label' => 'Austria',            'flag' => '🇦🇹'],
            '51'  => ['label' => 'Belarus',            'flag' => '🇧🇾'],
            '52'  => ['label' => 'Thailand',           'flag' => '🇹🇭'],
            '53'  => ['label' => 'Saudi Arabia',       'flag' => '🇸🇦'],
            '54'  => ['label' => 'Mexico',             'flag' => '🇲🇽'],
            '55'  => ['label' => 'Taiwan',             'flag' => '🇹🇼'],
            '56'  => ['label' => 'Spain',              'flag' => '🇪🇸'],
            '57'  => ['label' => 'Iran',               'flag' => '🇮🇷'],
            '58'  => ['label' => 'Algeria',            'flag' => '🇩🇿'],
            '59'  => ['label' => 'Slovenia',           'flag' => '🇸🇮'],
            '60'  => ['label' => 'Bangladesh',         'flag' => '🇧🇩'],
            '61'  => ['label' => 'Senegal',            'flag' => '🇸🇳'],
            '62'  => ['label' => 'Turkey',             'flag' => '🇹🇷'],
            '63'  => ['label' => 'Czech Republic',     'flag' => '🇨🇿'],
            '64'  => ['label' => 'Sri Lanka',          'flag' => '🇱🇰'],
            '65'  => ['label' => 'Peru',               'flag' => '🇵🇪'],
            '66'  => ['label' => 'Pakistan',           'flag' => '🇵🇰'],
            '67'  => ['label' => 'New Zealand',        'flag' => '🇳🇿'],
            '68'  => ['label' => 'Guinea',             'flag' => '🇬🇳'],
            '69'  => ['label' => 'Mali',               'flag' => '🇲🇱'],
            '70'  => ['label' => 'Venezuela',          'flag' => '🇻🇪'],
            '71'  => ['label' => 'Ethiopia',           'flag' => '🇪🇹'],
            '72'  => ['label' => 'Mongolia',           'flag' => '🇲🇳'],
            '73'  => ['label' => 'Brazil',             'flag' => '🇧🇷'],
            '74'  => ['label' => 'Afghanistan',        'flag' => '🇦🇫'],
            '75'  => ['label' => 'Uganda',             'flag' => '🇺🇬'],
            '76'  => ['label' => 'Angola',             'flag' => '🇦🇴'],
            '77'  => ['label' => 'Cyprus',             'flag' => '🇨🇾'],
            '78'  => ['label' => 'France',             'flag' => '🇫🇷'],
            '79'  => ['label' => 'Papua New Guinea',   'flag' => '🇵🇬'],
            '80'  => ['label' => 'Mozambique',         'flag' => '🇲🇿'],
            '81'  => ['label' => 'Nepal',              'flag' => '🇳🇵'],
            '82'  => ['label' => 'Belgium',            'flag' => '🇧🇪'],
            '83'  => ['label' => 'Bulgaria',           'flag' => '🇧🇬'],
            '84'  => ['label' => 'Hungary',            'flag' => '🇭🇺'],
            '85'  => ['label' => 'Moldova',            'flag' => '🇲🇩'],
            '86'  => ['label' => 'Italy',              'flag' => '🇮🇹'],
            '87'  => ['label' => 'Paraguay',           'flag' => '🇵🇾'],
            '88'  => ['label' => 'Honduras',           'flag' => '🇭🇳'],
            '89'  => ['label' => 'Tunisia',            'flag' => '🇹🇳'],
            '90'  => ['label' => 'Nicaragua',          'flag' => '🇳🇮'],
            '91'  => ['label' => 'Timor-Leste',        'flag' => '🇹🇱'],
            '92'  => ['label' => 'Bolivia',            'flag' => '🇧🇴'],
            '93'  => ['label' => 'Costa Rica',         'flag' => '🇨🇷'],
            '94'  => ['label' => 'Guatemala',          'flag' => '🇬🇹'],
            '95'  => ['label' => 'UAE',                'flag' => '🇦🇪'],
            '96'  => ['label' => 'Zimbabwe',           'flag' => '🇿🇼'],
            '97'  => ['label' => 'Puerto Rico',        'flag' => '🇵🇷'],
            '98'  => ['label' => 'Sudan',              'flag' => '🇸🇩'],
            '99'  => ['label' => 'Togo',               'flag' => '🇹🇬'],
            '100' => ['label' => 'Kuwait',             'flag' => '🇰🇼'],
            '101' => ['label' => 'El Salvador',        'flag' => '🇸🇻'],
            '102' => ['label' => 'Libya',              'flag' => '🇱🇾'],
            '103' => ['label' => 'Jamaica',            'flag' => '🇯🇲'],
            '104' => ['label' => 'Trinidad & Tobago',  'flag' => '🇹🇹'],
            '105' => ['label' => 'Ecuador',            'flag' => '🇪🇨'],
            '106' => ['label' => 'Malawi',             'flag' => '🇲🇼'],
            '107' => ['label' => 'Zambia',             'flag' => '🇿🇲'],
            '108' => ['label' => 'Georgia',            'flag' => '🇬🇪'],
            '109' => ['label' => 'Bahrain',            'flag' => '🇧🇭'],
            '110' => ['label' => 'Botswana',           'flag' => '🇧🇼'],
            '111' => ['label' => 'Armenia',            'flag' => '🇦🇲'],
            '112' => ['label' => 'Cuba',               'flag' => '🇨🇺'],
            '113' => ['label' => 'Dominican Rep.',     'flag' => '🇩🇴'],
            '114' => ['label' => 'Chile',              'flag' => '🇨🇱'],
            '115' => ['label' => 'Norway',             'flag' => '🇳🇴'],
            '116' => ['label' => 'Finland',            'flag' => '🇫🇮'],
            '117' => ['label' => 'Denmark',            'flag' => '🇩🇰'],
            '118' => ['label' => 'Switzerland',        'flag' => '🇨🇭'],
            '119' => ['label' => 'Portugal',           'flag' => '🇵🇹'],
            '120' => ['label' => 'Slovakia',           'flag' => '🇸🇰'],
            '121' => ['label' => 'Tajikistan',         'flag' => '🇹🇯'],
        ];
    }

    public function orders(Request $request)
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        $page = ServiceOrder::with('service')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate((int) ($request->input('per_page') ?? 20));

        return ApiResponse::ok([
            'items' => ServiceOrderResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function order(Request $request, string $publicId)
    {
        $order = ServiceOrder::with('service')
            ->where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        return ApiResponse::ok(new ServiceOrderResource($order));
    }

    public function validateMeter(Request $request)
    {
        $request->validate([
            'meter_number' => ['required', 'string'],
            'disco'        => ['required', 'string'],
            'meter_type'   => ['nullable', 'in:prepaid,postpaid'],
        ]);

        try {
            $result = app(\App\Services\FlutterwaveBillsService::class)->validateMeter(
                meterNumber: $request->input('meter_number'),
                disco:       $request->input('disco'),
                meterType:   $request->input('meter_type', 'prepaid'),
            );
            return ApiResponse::ok([
                'customer_name'   => $result['name'] ?? $result['customer_name'] ?? null,
                'customer_number' => $result['address'] ?? $result['meter_number'] ?? $request->input('meter_number'),
                'meter_type'      => $request->input('meter_type', 'prepaid'),
            ]);
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not validate meter: ' . $e->getMessage(), null, 422);
        }
    }

    public function cancel(Request $request, string $publicId)
    {
        $order = ServiceOrder::where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($order->status === 'refunded') {
            return ApiResponse::fail('Already refunded.', null, 422);
        }
        if (! in_array($order->status, ['completed', 'provisioning', 'pending'])) {
            return ApiResponse::fail('This order cannot be cancelled.', null, 422);
        }

        $holdTx = $order->transaction;
        if (! $holdTx) {
            return ApiResponse::fail('No transaction found for this order.', null, 422);
        }

        // Try to cancel with provider first (best-effort)
        try {
            if ($order->provider_order_id) {
                $provider = $order->service->provider ?? '';
                if ($provider === '5sim') {
                    app(\App\Services\Sms\FiveSimService::class)->cancel($order->provider_order_id);
                } elseif ($provider === 'smsactivate') {
                    app(\App\Services\Sms\SmsActivateService::class)->cancel($order->provider_order_id);
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('cancel.provider_cancel_failed', ['order' => $publicId, 'error' => $e->getMessage()]);
        }

        // Refund the wallet — handle both PROCESSING (hold) and SUCCESS (settled) states
        $wallets = app(\App\Services\Wallet\WalletService::class);
        \Illuminate\Support\Facades\DB::transaction(function () use ($wallets, $holdTx, $order) {
            $freshTx   = $holdTx->fresh();
            $txStatus  = $freshTx->status;
            // Normalise to string whether it's an enum or a plain string
            $statusStr = $txStatus instanceof \BackedEnum ? $txStatus->value : (string) $txStatus;

            if ($statusStr === 'processing') {
                // Transaction still in suspense — use normal refund path
                $wallets->refundSuspense(
                    $freshTx,
                    'cancel_refund:' . $order->public_id,
                    'Number cancelled by user',
                );
            } else {
                // Transaction already settled — credit wallet directly
                $wallet = $freshTx->wallet;
                $amount = \App\Support\Money::minor($freshTx->amount_minor, $freshTx->currency);
                $wallets->fundFromPayment(
                    wallet: $wallet,
                    amount: $amount,
                    cashAccountCode: \App\Services\Ledger\ChartOfAccounts::SUSPENSE,
                    idempotencyKey: 'cancel_refund:' . $order->public_id,
                    description: 'Refund: number cancelled by user',
                );
            }

            $order->update([
                'status'         => 'refunded',
                'failure_reason' => 'Cancelled by user',
                'refunded_at'    => now(),
            ]);
        });

        \App\Support\Audit::log('service.cancelled', $order);

        return ApiResponse::ok(
            new \App\Http\Resources\ServiceOrderResource($order->fresh()->loadMissing('service')),
            'Order cancelled and wallet refunded.'
        );
    }

    public function fetchCode(Request $request, string $publicId)
    {
        $order = ServiceOrder::where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($order->status !== 'completed') {
            return ApiResponse::fail('Order is not active.', null, 422);
        }

        if (! $order->provider_order_id) {
            return ApiResponse::fail('No provider order ID.', null, 422);
        }

        $code = null;
        try {
            $provider = $order->service->provider;
            if ($provider === '5sim') {
                $code = app(\App\Services\Sms\FiveSimService::class)->fetchCode($order->provider_order_id);
            } elseif ($provider === 'smsactivate') {
                $code = app(\App\Services\Sms\SmsActivateService::class)->fetchCode($order->provider_order_id);
            }
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not check for code: ' . $e->getMessage(), null, 500);
        }

        if ($code) {
            $delivery = array_merge((array) $order->delivery, ['sms_code' => $code]);
            $order->update(['delivery' => $delivery]);
            \App\Support\Audit::log('service.code_received', $order);
        }

        return ApiResponse::ok([
            'code'     => $code,
            'delivery' => $order->fresh()->delivery,
        ], $code ? 'Code received!' : 'No code yet.');
    }
}
