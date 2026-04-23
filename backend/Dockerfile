# syntax=docker/dockerfile:1.6
#
# Single-container production image for the C-codit Laravel backend.
# Uses nginx + PHP-FPM under supervisord, binding to $PORT (Render-compatible).
#
# Build order is deliberately staged so composer install can use the lock file
# and benefit from Docker layer caching while final source comes in last.

############################
# Stage 1: composer install
############################
FROM composer:2.7 AS vendor

WORKDIR /app

COPY composer.json composer.lock* ./

# Install only production dependencies; defer artisan scripts until source is present.
RUN composer install \
        --no-dev \
        --no-interaction \
        --no-progress \
        --no-scripts \
        --prefer-dist \
        --optimize-autoloader

############################
# Stage 2: runtime
############################
FROM php:8.3-fpm-alpine AS runtime

ENV PHP_OPCACHE_VALIDATE_TIMESTAMPS=0 \
    PHP_OPCACHE_MEMORY_CONSUMPTION=192 \
    PHP_OPCACHE_MAX_ACCELERATED_FILES=20000 \
    PHP_MEMORY_LIMIT=256M \
    PORT=8080

# System deps + PHP extensions for Postgres, Redis, intl, bcmath.
RUN apk add --no-cache \
        bash \
        nginx \
        supervisor \
        postgresql-libs \
        icu-libs \
        oniguruma \
        libzip \
        tzdata \
        curl \
        ca-certificates \
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        postgresql-dev \
        icu-dev \
        oniguruma-dev \
        libzip-dev \
        autoconf \
        linux-headers \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_pgsql \
        pgsql \
        intl \
        bcmath \
        mbstring \
        opcache \
        zip \
        sockets \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps \
    && rm -rf /tmp/* /var/cache/apk/*

# Install Composer binary (used inside container for `composer install` on rebuild scenarios)
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy vendor first (cache layer), then source.
COPY --from=vendor /app/vendor ./vendor
COPY . .

# Now run the deferred composer scripts that need the full source tree.
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative \
    && mkdir -p storage/framework/{cache/data,sessions,views,testing} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

# PHP / FPM / nginx / supervisor config
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-app.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# OPcache preload-friendly opcache settings
RUN { \
        echo "opcache.enable=1"; \
        echo "opcache.enable_cli=0"; \
        echo "opcache.memory_consumption=${PHP_OPCACHE_MEMORY_CONSUMPTION}"; \
        echo "opcache.max_accelerated_files=${PHP_OPCACHE_MAX_ACCELERATED_FILES}"; \
        echo "opcache.validate_timestamps=${PHP_OPCACHE_VALIDATE_TIMESTAMPS}"; \
        echo "opcache.interned_strings_buffer=16"; \
        echo "opcache.jit=tracing"; \
        echo "opcache.jit_buffer_size=64M"; \
    } > /usr/local/etc/php/conf.d/opcache.ini

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
