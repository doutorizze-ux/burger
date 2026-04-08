FROM node:20-alpine AS builder

# --- Stage 1: Build Client ---
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
# Define a URL da API como relativa para funcionar no mesmo domínio
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- Stage 2: Serve ---
FROM node:20-alpine

WORKDIR /app/server

# Instalar dependências de sistema
RUN apk add --no-cache openssl

# Copiar arquivos de dependência do servidor
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Instalar dependências do servidor
RUN npm install

# Gerar cliente Prisma
RUN npx prisma generate

# Copiar código fonte do servidor
COPY server/ .

# Compilar servidor
RUN npm run build

# Criar pastas para persistência (essencial para Coolify/Docker)
RUN mkdir -p uploads sessions data

# Copiar o build do frontend gerado no estágio anterior para a pasta 'public' do servidor
COPY --from=builder /app/client/dist ./public

# Variáveis de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Expor porta e rodar
EXPOSE 3000
CMD ["npm", "start"]
