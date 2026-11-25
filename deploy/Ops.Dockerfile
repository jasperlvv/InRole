FROM postgres:17.12-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends nodejs ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /ops
COPY scripts/ops/ ./
COPY prisma/permissions.sql ./permissions.sql
ENTRYPOINT ["node", "backup.mjs"]
