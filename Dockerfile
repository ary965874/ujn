FROM oven/bun:1.1.8

WORKDIR /app
COPY . .

EXPOSE 3000
CMD ["bun", "index.ts"]
