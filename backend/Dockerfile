# ローカル開発用の backend イメージ（php-fpm）。
# docker-compose.yml の backend・queue-worker・scheduler が共通で使う。
# 本番用（Railway）は手順9で Dockerfile.prod として別に作る。

FROM php:8.4-fpm

# ---------------------------------------------------------------------------
# PHP の拡張機能
# ---------------------------------------------------------------------------
# - pdo_pgsql : PostgreSQL に接続する
# - pcntl     : queue:work がシグナル（停止の合図）を受けて、処理中のジョブを終えてから止まるのに使う
# - bcmath    : Laravel の一部の機能（数値計算）が使う
# - zip       : composer がパッケージを展開するのに使う
# - redis     : Redis に接続する（phpredis）。PECL から入れる
#
# libpq-dev は pdo_pgsql の、libzip-dev は zip のビルドに必要なライブラリ。
# git と unzip は composer が使う。
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libpq-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql pcntl bcmath zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# composer 本体は公式イメージからコピーする（インストール手順を書かずに済む）
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# コードは docker-compose.yml でホストの backend/ をここにマウントする
WORKDIR /var/www/html

# 既定の CMD は php-fpm（9000番で nginx からの FastCGI を待つ）。
# queue-worker・scheduler は docker-compose.yml の command で上書きする。
