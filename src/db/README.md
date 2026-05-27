Banco de dados local (SQLite)

- Arquivo: `src/db/database.sqlite` (criado automaticamente ao iniciar o servidor)
- O servidor (`server.js`) inicializa o banco e cria as tabelas `users` e `upcomingGames` se necessário.
- Se as tabelas estiverem vazias, dados seed são lidos de `src/data/users.json` e `src/data/upcomingGames.json`.

Uso (desenvolvimento):
1. `npm install`
2. `npm start`
3. Abra `http://localhost:3000`

Segurança: este banco local é apenas para desenvolvimento. Para produção, use um servidor de banco de dados gerenciado e proteja credenciais.
