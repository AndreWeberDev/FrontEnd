Deploy e Backup — Arcade365

Requisitos de ambiente
- Node.js 18+ recomendado
- Variáveis de ambiente essenciais:
  - `JWT_SECRET` (obrigatório em produção)
  - `NODE_ENV=production` em ambientes de produção
  - `PORT` opcional (padrão 3000)
  - `ALLOWED_ORIGINS` (opcional) – domínios permitidos para CORS, separados por vírgula
  - `BCRYPT_ROUNDS` (opcional) – rounds de bcrypt (padrão 10)

Instruções básicas (servidor local)
1. Instalar dependências:

```bash
npm install
```
2. Iniciar:

```bash
JWT_SECRET=segreto_producao NODE_ENV=production npm start
```

HTTPS / Proxy
- Em produção coloque o app atrás de um proxy reverso (Nginx, Cloud Run, Heroku, etc.) que termine HTTPS.
- Configure `JWT_SECRET` como variável de ambiente segura no host.
- `res.cookie(..., { secure: true })` está ativado quando `NODE_ENV=production`.

Backup do banco SQLite
- O arquivo do DB: `src/db/database.sqlite`.
- Estratégia simples (cron): copiar o arquivo regularmente para um storage externo (S3, Azure Blob, etc.).

Exemplo de cron (Linux) — copia diária para pasta `backups`:

```bash
mkdir -p /var/backups/arcade365
cp /path/to/project/src/db/database.sqlite /var/backups/arcade365/database-$(date +"%Y%m%d-%H%M").sqlite
```

Para upload a S3 (exemplo com AWS CLI):

```bash
aws s3 cp /var/backups/arcade365/database-20240101-0000.sqlite s3://meu-bucket/arcade365/backups/
```

Docker (exemplo simples)
- Crie um `Dockerfile` que instale Node, copie o projeto e exponha a porta. Garanta montar um volume para `src/db` para persistência.

Exemplo (esboço):

```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV NODE_ENV=production
CMD ["node","server.js"]
```

Observações de segurança
- Nunca commit `JWT_SECRET` em repositório.
- Em produção, prefira um gerenciador de segredos e um DB gerenciado (Postgres, MySQL). SQLite é adequado apenas para desenvolvimento ou low-scale.
- Considere usar HTTPS, CORS restrito (`ALLOWED_ORIGINS`), e monitorar/rotacionar refresh tokens.

Próximos passos sugeridos
- Migrar para Postgres e usar um serviço gerenciado.
- Configurar backups automáticos para S3/Blob com retenção e criptografia.
- Habilitar logging centralizado (Papertrail/ELK) e monitoramento.
