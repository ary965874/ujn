FROM oven/bun:1

WORKDIR /app

COPY . .

ARG PORT

EXPOSE ${PORT:-3000}

CMD bun install && bun run server
