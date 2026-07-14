FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Copy package files from root to manage workspaces
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/

# Install dependencies for the entire project
RUN npm ci

# Copy all source files
COPY . .

# Build the API workspace application
RUN npm run build --workspace=apps/api

# Production runner environment
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 4000

# Copy over the built files and node_modules directly
COPY --from=builder /app ./

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 4000

# Using start:prod maps directly to node dist/main and inherits Render environment variables perfectly
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]