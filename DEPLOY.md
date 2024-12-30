# Deployment Guide

## Prerequisites

- Node.js 18+ or Bun 1.0+
- PostgreSQL database
- Domain name (optional)

## Deployment Steps

1. Clone the repository:

```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Edit the `.env` file with your configuration:

```env
HOST=your-domain.com # or your server IP
PORT=5000 # or your preferred port
SECRET_KEY=your-random-secret-key
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/webdrop
CORS_ORIGINS=https://your-domain.com
```

4. Install dependencies:

```bash
bun install
```

5. Build the application:

```bash
bun run build
```

6. Start the production server:

```bash
bun run start
```

## Using Process Manager (Optional)

For keeping the application running in production, you can use PM2:

1. Install PM2:

```bash
npm install -g pm2
```

2. Start with PM2:

```bash
pm2 start npm --name "webdrop" -- start
```

3. Setup auto-restart:

```bash
pm2 startup
pm2 save
```

## Using Nginx as Reverse Proxy (Recommended)

1. Install Nginx:

```bash
sudo apt install nginx
```

2. Create Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable configuration:

```bash
sudo ln -s /etc/nginx/sites-available/webdrop /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificate (Recommended)

1. Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

2. Get SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

## Updating the Application

1. Pull latest changes:

```bash
git pull origin main
```

2. Install dependencies:

```bash
bun install
```

3. Rebuild the application:

```bash
bun run build
```

4. Restart the application:

```bash
# If using PM2:
pm2 restart webdrop

# If running directly:
bun run start
```

## Troubleshooting

1. If you see EADDRINUSE error:

   - Check if another process is using the port: `lsof -i :5000`
   - Kill the process if needed: `kill -9 <PID>`

2. If WebSocket connections fail:

   - Ensure your firewall allows WebSocket connections
   - Check Nginx configuration has proper WebSocket headers

3. Database connection issues:
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check database credentials in .env file
   - Ensure database exists: `psql -l`

## Monitoring

1. View application logs:

```bash
# If using PM2:
pm2 logs webdrop

# If running directly:
tail -f logs/app.log
```

2. Monitor system resources:

```bash
pm2 monit
```
