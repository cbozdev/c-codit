<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('proxy_listings', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->char('country_code', 2)->index();
            $t->string('country_name', 80);
            $t->char('state_code', 5)->nullable()->index();
            $t->string('state_name', 80)->nullable();
            $t->string('city', 80)->nullable();
            $t->string('isp', 100)->nullable();
            $t->string('zip', 20)->nullable();
            $t->string('ip_display', 20)->nullable();
            $t->enum('connection_type', ['wifi', 'cell'])->default('wifi');
            $t->enum('protocol', ['http', 'socks5'])->default('http');
            $t->unsignedInteger('speed_ms')->default(120);
            $t->unsignedInteger('price_minor')->default(9700);
            $t->boolean('is_available')->default(true)->index();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();

            $t->index(['country_code', 'state_code', 'is_available']);
            $t->index(['connection_type', 'protocol']);
        });

        Schema::create('user_ip_whitelists', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('ip_address', 45);
            $t->timestamps();

            $t->unique(['user_id', 'ip_address']);
            $t->index('user_id');
        });

        $this->seedListings();
    }

    private function seedListings(): void
    {
        $wifiIsps = ['Comcast Xfinity', 'AT&T Internet', 'Verizon Fios', 'Charter Spectrum', 'Cox Communications', 'CenturyLink', 'Frontier', 'Mediacom'];
        $cellIsps = ['AT&T', 'Verizon', 'T-Mobile', 'Dish Wireless'];

        // US States: [code, name, city, zip_prefix]
        $usStates = [
            ['AK', 'Alaska',          'Anchorage',       '99501'],
            ['AL', 'Alabama',         'Birmingham',      '35203'],
            ['AR', 'Arkansas',        'Little Rock',     '72201'],
            ['AZ', 'Arizona',         'Phoenix',         '85001'],
            ['CA', 'California',      'Los Angeles',     '90001'],
            ['CO', 'Colorado',        'Denver',          '80201'],
            ['CT', 'Connecticut',     'Hartford',        '06101'],
            ['DC', 'District of Columbia','Washington',  '20001'],
            ['DE', 'Delaware',        'Wilmington',      '19801'],
            ['FL', 'Florida',         'Miami',           '33101'],
            ['GA', 'Georgia',         'Atlanta',         '30301'],
            ['HI', 'Hawaii',          'Honolulu',        '96801'],
            ['IA', 'Iowa',            'Des Moines',      '50301'],
            ['ID', 'Idaho',           'Boise',           '83701'],
            ['IL', 'Illinois',        'Chicago',         '60601'],
            ['IN', 'Indiana',         'Indianapolis',    '46201'],
            ['KS', 'Kansas',          'Wichita',         '67201'],
            ['KY', 'Kentucky',        'Louisville',      '40201'],
            ['LA', 'Louisiana',       'New Orleans',     '70112'],
            ['MA', 'Massachusetts',   'Boston',          '02101'],
            ['MD', 'Maryland',        'Baltimore',       '21201'],
            ['ME', 'Maine',           'Portland',        '04101'],
            ['MI', 'Michigan',        'Detroit',         '48201'],
            ['MN', 'Minnesota',       'Minneapolis',     '55401'],
            ['MO', 'Missouri',        'St. Louis',       '63101'],
            ['MS', 'Mississippi',     'Jackson',         '39201'],
            ['MT', 'Montana',         'Billings',        '59101'],
            ['NC', 'North Carolina',  'Charlotte',       '28201'],
            ['ND', 'North Dakota',    'Fargo',           '58102'],
            ['NE', 'Nebraska',        'Omaha',           '68101'],
            ['NH', 'New Hampshire',   'Manchester',      '03101'],
            ['NJ', 'New Jersey',      'Newark',          '07101'],
            ['NM', 'New Mexico',      'Albuquerque',     '87101'],
            ['NV', 'Nevada',          'Las Vegas',       '89101'],
            ['NY', 'New York',        'New York City',   '10001'],
            ['OH', 'Ohio',            'Columbus',        '43201'],
            ['OK', 'Oklahoma',        'Oklahoma City',   '73101'],
            ['OR', 'Oregon',          'Portland',        '97201'],
            ['PA', 'Pennsylvania',    'Philadelphia',    '19101'],
            ['RI', 'Rhode Island',    'Providence',      '02901'],
            ['SC', 'South Carolina',  'Columbia',        '29201'],
            ['SD', 'South Dakota',    'Sioux Falls',     '57101'],
            ['TN', 'Tennessee',       'Nashville',       '37201'],
            ['TX', 'Texas',           'Houston',         '77001'],
            ['UT', 'Utah',            'Salt Lake City',  '84101'],
            ['VA', 'Virginia',        'Richmond',        '23218'],
            ['VT', 'Vermont',         'Burlington',      '05401'],
            ['WA', 'Washington',      'Seattle',         '98101'],
            ['WI', 'Wisconsin',       'Milwaukee',       '53201'],
            ['WV', 'West Virginia',   'Charleston',      '25301'],
            ['WY', 'Wyoming',         'Cheyenne',        '82001'],
        ];

        // World countries: [code, name, city, isp_wifi, isp_cell]
        $worldCountries = [
            ['GB', 'United Kingdom',  'London',          'BT Group',        'EE'],
            ['DE', 'Germany',         'Berlin',          'Deutsche Telekom','Vodafone DE'],
            ['FR', 'France',          'Paris',           'Orange',          'SFR'],
            ['CA', 'Canada',          'Toronto',         'Rogers',          'Bell Canada'],
            ['AU', 'Australia',       'Sydney',          'Telstra',         'Optus'],
            ['IN', 'India',           'Mumbai',          'Jio Fiber',       'Airtel'],
            ['BR', 'Brazil',          'São Paulo',       'Claro',           'Vivo'],
            ['SG', 'Singapore',       'Singapore',       'Singtel',         'StarHub'],
            ['JP', 'Japan',           'Tokyo',           'NTT',             'SoftBank'],
            ['NL', 'Netherlands',     'Amsterdam',       'KPN',             'T-Mobile NL'],
            ['NG', 'Nigeria',         'Lagos',           'MTN Nigeria',     'Airtel NG'],
            ['ZA', 'South Africa',    'Johannesburg',    'Telkom',          'Vodacom'],
            ['KE', 'Kenya',           'Nairobi',         'Safaricom',       'Airtel KE'],
            ['GH', 'Ghana',           'Accra',           'MTN Ghana',       'Vodafone GH'],
            ['PH', 'Philippines',     'Manila',          'PLDT',            'Globe'],
            ['MX', 'Mexico',          'Mexico City',     'Telmex',          'Telcel'],
            ['AR', 'Argentina',       'Buenos Aires',    'Telecom',         'Movistar AR'],
            ['TR', 'Turkey',          'Istanbul',        'Turk Telekom',    'Turkcell'],
            ['PL', 'Poland',          'Warsaw',          'Orange PL',       'Play'],
            ['ES', 'Spain',           'Madrid',          'Movistar',        'Orange ES'],
            ['IT', 'Italy',           'Rome',            'TIM',             'Vodafone IT'],
            ['SE', 'Sweden',          'Stockholm',       'Telia',           '3'],
            ['NO', 'Norway',          'Oslo',            'Telenor',         'Ice'],
            ['UA', 'Ukraine',         'Kyiv',            'Ukrtelecom',      'Kyivstar'],
            ['PK', 'Pakistan',        'Karachi',         'PTCL',            'Jazz'],
            ['BD', 'Bangladesh',      'Dhaka',           'BTCL',            'Grameenphone'],
            ['ID', 'Indonesia',       'Jakarta',         'IndiHome',        'Telkomsel'],
            ['VN', 'Vietnam',         'Ho Chi Minh City','VNPT',            'Viettel'],
            ['TH', 'Thailand',        'Bangkok',         'True Online',     'AIS'],
            ['MY', 'Malaysia',        'Kuala Lumpur',    'TM',              'Maxis'],
            ['AE', 'UAE',             'Dubai',           'Etisalat',        'du'],
            ['EG', 'Egypt',           'Cairo',           'TE Data',         'Vodafone EG'],
            ['IL', 'Israel',          'Tel Aviv',        'Bezeq',           'Cellcom'],
            ['CH', 'Switzerland',     'Zurich',          'Swisscom',        'Salt'],
            ['BE', 'Belgium',         'Brussels',        'Proximus',        'Orange BE'],
            ['PT', 'Portugal',        'Lisbon',          'MEO',             'NOS'],
            ['RO', 'Romania',         'Bucharest',       'RCS & RDS',       'Orange RO'],
            ['CZ', 'Czech Republic',  'Prague',          'O2 CZ',           'T-Mobile CZ'],
            ['HU', 'Hungary',         'Budapest',        'Magyar Telekom',  'Telenor HU'],
            ['AT', 'Austria',         'Vienna',          'A1',              'Magenta'],
        ];

        $rows    = [];
        $now     = now()->toDateTimeString();
        $order   = 0;

        // US state listings
        foreach ($usStates as $i => [$stCode, $stName, $city, $zip]) {
            $wifiIsp = $wifiIsps[$i % count($wifiIsps)];
            $cellIsp = $cellIsps[$i % count($cellIsps)];
            $ipA     = rand(100, 200);
            $ipB     = rand(10, 250);

            $variants = [
                ['wifi', 'http',   7200, rand(80, 150)],
                ['wifi', 'socks5', 8200, rand(80, 150)],
                ['cell', 'http',   9700, rand(60, 130)],
                ['cell', 'socks5', 11700, rand(60, 130)],
            ];

            foreach ($variants as [$type, $proto, $price, $speed]) {
                $isp = $type === 'wifi' ? $wifiIsp : $cellIsp;
                $rows[] = [
                    'public_id'       => \Illuminate\Support\Str::uuid(),
                    'country_code'    => 'US',
                    'country_name'    => 'United States',
                    'state_code'      => $stCode,
                    'state_name'      => $stName,
                    'city'            => $city,
                    'isp'             => $isp,
                    'zip'             => $zip,
                    'ip_display'      => "{$ipA}.{$ipB}.xxx.xxx",
                    'connection_type' => $type,
                    'protocol'        => $proto,
                    'speed_ms'        => $speed,
                    'price_minor'     => $price,
                    'is_available'    => true,
                    'sort_order'      => $order++,
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ];
            }
        }

        // World country listings
        foreach ($worldCountries as $i => [$cc, $cname, $city, $wifiIsp, $cellIsp]) {
            $ipA = rand(100, 200);
            $ipB = rand(10, 250);

            $variants = [
                ['wifi', 'http',   7200, rand(90, 200)],
                ['wifi', 'socks5', 8200, rand(90, 200)],
                ['cell', 'http',   9700, rand(70, 160)],
                ['cell', 'socks5', 11700, rand(70, 160)],
            ];

            foreach ($variants as [$type, $proto, $price, $speed]) {
                $isp = $type === 'wifi' ? $wifiIsp : $cellIsp;
                $rows[] = [
                    'public_id'       => \Illuminate\Support\Str::uuid(),
                    'country_code'    => $cc,
                    'country_name'    => $cname,
                    'state_code'      => null,
                    'state_name'      => null,
                    'city'            => $city,
                    'isp'             => $isp,
                    'zip'             => null,
                    'ip_display'      => "{$ipA}.{$ipB}.xxx.xxx",
                    'connection_type' => $type,
                    'protocol'        => $proto,
                    'speed_ms'        => $speed,
                    'price_minor'     => $price,
                    'is_available'    => true,
                    'sort_order'      => $order++,
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ];
            }
        }

        // Chunk inserts to avoid query size limits
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('proxy_listings')->insert($chunk);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_ip_whitelists');
        Schema::dropIfExists('proxy_listings');
    }
};
