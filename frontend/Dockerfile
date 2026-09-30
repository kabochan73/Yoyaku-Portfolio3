# ローカル開発用の frontend イメージ（next dev）。
# 本番用（Railway）は手順9で Dockerfile.prod として別に作る。

FROM node:22-alpine

WORKDIR /app

# 先に package*.json だけコピーして npm ci する。
# ソースコードを変えても package*.json が同じなら、この層はキャッシュが使われ、
# ビルドのたびに npm ci をやり直さずに済む。
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードは docker-compose.yml でホストの frontend/ をマウントするので、ここではコピーしない

EXPOSE 3000

# --hostname 0.0.0.0: コンテナの外（ホストのブラウザ）から繋げるようにする。
# 既定の localhost のままだと、コンテナの中からしか見えない。
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
