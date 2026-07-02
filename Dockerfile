FROM node:22-bookworm-slim AS base

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
RUN npx prisma generate --schema=backend/prisma/schema.prisma
ENV NODE_ENV=development
ENV NITRO_HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS test
COPY . .
RUN npx prisma generate --schema=backend/prisma/schema.prisma
ENV NODE_ENV=test
CMD ["npm", "run", "test"]

FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV PORT=5300

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/.output ./.output
COPY --from=build /app/backend/prisma ./backend/prisma
RUN npx prisma generate --schema=backend/prisma/schema.prisma

EXPOSE 5300
CMD ["node", ".output/server/index.mjs"]
