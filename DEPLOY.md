# Deploy do Sistema MeuCurso IA

## ⚠️ IMPORTANTE: WhatsApp não funciona na Vercel

A integração WhatsApp (Baileys) **NÃO FUNCIONA** em ambientes serverless como Vercel porque:
- Precisa de processo Node.js rodando 24/7
- Mantém WebSocket ativo constantemente
- Requer filesystem persistente para sessões

## Opções de Deploy

### 1. Railway (Recomendado - Mais Fácil)

Railway suporta processos persistentes e é similar à Vercel.

**Passo a passo:**

1. Crie conta em https://railway.app
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha o repositório `ia-mc`
5. Configure as variáveis de ambiente:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=sua-chave
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-dominio
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=seu-measurement-id
   OPENAI_API_KEY=sua-chave-openai
   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=@meucurso.com.br
   NEXT_PUBLIC_SUPER_ADMIN_EMAIL=rodrigo.reis@meucurso.com.br
   ```
6. Railway detecta automaticamente Next.js e faz deploy
7. Acesse a URL gerada (ex: `https://ia-mc-production.up.railway.app`)

**Custo:** ~$5-10/mês (Railway tem $5 grátis/mês)

### 2. DigitalOcean Droplet (VPS)

**Passo a passo:**

1. Crie Droplet Ubuntu 22.04 ($6/mês)
2. SSH no servidor:
   ```bash
   ssh root@seu-ip
   ```

3. Instale Node.js 20:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   apt-get install -y nodejs
   ```

4. Instale PM2 (gerenciador de processos):
   ```bash
   npm install -g pm2
   ```

5. Clone o repositório:
   ```bash
   git clone https://github.com/reisrodrigo1-dev/ia-mc.git
   cd ia-mc
   ```

6. Configure variáveis de ambiente:
   ```bash
   nano .env.local
   ```
   Cole as variáveis de ambiente

7. Instale dependências e build:
   ```bash
   npm install
   npm run build
   ```

8. Inicie com PM2:
   ```bash
   pm2 start npm --name "ia-mc" -- start
   pm2 save
   pm2 startup
   ```

9. Configure Nginx como reverse proxy:
   ```bash
   apt install nginx
   nano /etc/nginx/sites-available/ia-mc
   ```
   
   Adicione:
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   ln -s /etc/nginx/sites-available/ia-mc /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

10. Configure SSL com Certbot:
    ```bash
    apt install certbot python3-certbot-nginx
    certbot --nginx -d seu-dominio.com
    ```

**Custo:** $6/mês

### 3. AWS Lightsail

Similar ao DigitalOcean, mas na AWS. Mesmos passos, custo de $5-10/mês.

### 4. Render

1. Crie conta em https://render.com
2. New > Web Service
3. Conecte GitHub
4. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. Adicione variáveis de ambiente

**Custo:** $7/mês (plano Starter)

## Deploy Híbrido (Frontend Vercel + Backend Separado)

Se quiser manter o frontend na Vercel e só o WhatsApp em servidor separado:

1. Frontend/Dashboard na Vercel (sem WhatsApp)
2. API WhatsApp em Railway/VPS
3. Configure CORS para comunicação entre domínios

## Verificação Pós-Deploy

Após deploy em qualquer plataforma:

1. Acesse `/dashboard/whatsapp/connections`
2. Clique em "Nova Conexão"
3. Escaneie o QR Code com WhatsApp
4. Verifique se mostra "Conectado" em verde

## Monitoramento

- **Railway:** Dashboard built-in com logs
- **VPS:** Use `pm2 logs` e `pm2 monit`
- **Render:** Logs na dashboard

## Backup de Sessões WhatsApp

As sessões ficam em `/whatsapp_sessions`. Configure backup automático:

```bash
# Cron job diário
0 2 * * * tar -czf /backup/whatsapp-$(date +\%Y\%m\%d).tar.gz /seu-app/whatsapp_sessions
```

## Troubleshooting

**Erro "Connection Closed":**
- Sessão expirou, reconecte via QR Code

**Erro 500 na API:**
- Verifique logs: `pm2 logs` ou Railway dashboard
- Confirme variáveis de ambiente

**WhatsApp não conecta:**
- Porta 3000 aberta no firewall
- Processo Node.js rodando 24/7
- Filesystem com permissões de escrita

---

**Recomendação Final:** Use Railway por ser o mais fácil e similar à Vercel, mas com suporte a processos persistentes.
