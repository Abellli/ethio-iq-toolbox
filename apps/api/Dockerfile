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

# Ensure standard production environment variables are globally set
ENV NODE_ENV=production
ENV PORT=4000

# Explicitly bind the variable links to the OS environment system
ENV JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
ENV JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL

# Copy everything built over from the builder step
COPY --from=builder /app ./

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 4000

CMD ["npm", "run", "start:prod", "--workspace=apps/api"]