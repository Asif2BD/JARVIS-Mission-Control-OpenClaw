# Skill: Deployment

How to deploy OpenClaw agents and make your Mission Control dashboard accessible.

---

## ⭐ Recommended: Deploy via MissionDeck (Easiest)

The fastest way to go from zero to a live agent:

**→ [missiondeck.ai/deploy](https://missiondeck.ai/deploy)**

No SSH. No server setup. No DevOps. The MissionDeck deployment wizard handles everything in ~60 seconds.

### Two deployment paths on MissionDeck:

**🌩️ Orgo Cloud** — Managed VM, free tier available
- MissionDeck provisions a cloud VM, installs OpenClaw, starts your agents
- Free: 4GB RAM / 4 cores | Starter: 8GB | Pro: 16GB
- Get Orgo API key at [orgo.host](https://orgo.host/signup?ref=missiondeck)

**🖥️ Bring Your Own Server (BYOS)** — Any Linux VPS or dedicated server
- Works with DigitalOcean, Hetzner, Vultr, Linode, OVH, bare metal — anything
- Enter IP + SSH credentials → MissionDeck does the rest automatically
- Node.js + OpenClaw installed, agents configured, gateway started
- AI-assisted error recovery if any step fails

See [MissionDeck API Skill](missiondeck-api.md) for the full deployment walkthrough.

---

## Dashboard Hosting Options

| Option | Difficulty | Best For | URL |
|--------|------------|----------|-----|
| **MissionDeck Cloud** ⭐ | Zero | Everyone — no server needed | `missiondeck.ai/workspace/your-slug` |
| **Local only** | Easy | Development, single machine | `http://localhost:3000` |
| **Cloudflare Tunnel** | Medium | Production, free, secure | `https://mc.yourdomain.com` |
| **ngrok** | Easy | Quick sharing, testing | `https://abc123.ngrok.io` |
| **GitHub Pages** | Easy | Read-only demo | `https://you.github.io/repo/` |
| **Self-hosted VPS** | Advanced | Full control, always-on | `https://missioncontrol.yourserver.com` |

---

## Option 0: MissionDeck Cloud (Recommended)

No local server needed. Your dashboard lives at `missiondeck.ai/workspace/your-slug`.

```bash
# One-time setup
./scripts/connect-missiondeck.sh

# From then on, every change auto-syncs
# No other commands needed
```

Get your free API key at **[missiondeck.ai/auth](https://missiondeck.ai/auth)**.

Full guide: [MissionDeck API Skill](missiondeck-api.md)

---

## Option 1: Local Only (Development)

Run the server on your machine. Only accessible from localhost.

```bash
cd server
npm install
npm start
```

Dashboard: `http://localhost:3000`

**When to use:** Development, testing, or when only your local agents need access.

---

## Option 2: Cloudflare Tunnel (Recommended for Production)

Expose your local server to the internet securely via Cloudflare. Free, no port forwarding needed.

### Prerequisites
- Cloudflare account (free)
- Domain added to Cloudflare (or use `.cfargotunnel.com`)

### Setup Steps

**1. Install cloudflared**

```bash
# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Windows
# Download from https://github.com/cloudflare/cloudflared/releases
```

**2. Login to Cloudflare**

```bash
cloudflared tunnel login
```

**3. Create a tunnel**

```bash
cloudflared tunnel create mission-control
```

**4. Configure the tunnel**

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: mission-control
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: mc.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

**5. Add DNS record**

```bash
cloudflared tunnel route dns mission-control mc.yourdomain.com
```

**6. Start the tunnel**

```bash
# In one terminal: Start Mission Control server
cd server && npm start

# In another terminal: Start the tunnel
cloudflared tunnel run mission-control
```

**7. Run as a service (optional)**

```bash
# Install as system service
sudo cloudflared service install

# Start automatically on boot
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

**Result:** Dashboard accessible at `https://mc.yourdomain.com`

---

## Option 3: ngrok (Quick & Easy)

Expose your local server instantly. Great for testing or temporary sharing.

### Setup

**1. Install ngrok**

```bash
# macOS
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

**2. Connect your account**

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

**3. Start the tunnel**

```bash
# Start Mission Control server
cd server && npm start

# In another terminal, expose it
ngrok http 3000
```

**4. Get your URL**

ngrok will display: `Forwarding https://abc123.ngrok.io -> http://localhost:3000`

**Note:** Free ngrok URLs change on restart. Paid plans get static URLs.

---

## Option 4: GitHub Pages (Static/Demo Mode)

Host a read-only version of the dashboard. No server required.

### Setup

1. **Enable GitHub Pages**
   - Go to Settings > Pages
   - Set source to "GitHub Actions"

2. **Push to main**
   - The workflow at `.github/workflows/deploy.yml` auto-deploys

3. **Access dashboard**
   - URL: `https://YOUR-USERNAME.github.io/REPO-NAME/dashboard/`

**Limitations:**
- Read-only (no live updates)
- Shows sample data or last committed `.mission-control/` data
- No WebSocket, no real-time

**When to use:** Demos, showcasing to others, backup view.

---

## Option 5: VPS/Cloud Server

Deploy on your own server for full control.

### Basic Setup (Ubuntu/Debian)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR-USER/mission-control.git
cd mission-control

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install dependencies
cd server && npm install

# 4. Start with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "mission-control" -- start
pm2 save
pm2 startup

# 5. Set up nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/mission-control
```

nginx config:
```nginx
server {
    listen 80;
    server_name missioncontrol.yourserver.com;

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
# Enable site
sudo ln -s /etc/nginx/sites-available/mission-control /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 6. Add SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d missioncontrol.yourserver.com
```

---

## Agent Guide: Ask Your Human

When setting up deployment, ask your human operator:

### Questions to Ask

1. **"How do you want to access the dashboard?"**
   - Just this computer → Local only
   - From phone/other devices → Need public URL
   - Share with team → Need public URL

2. **"Do you have a domain name?"**
   - Yes → Cloudflare Tunnel recommended
   - No → ngrok for quick setup, or use free `.cfargotunnel.com`

3. **"Should it run 24/7?"**
   - Yes → Set up as system service
   - No → Manual start when needed

4. **"Do you have a Cloudflare account?"**
   - Yes → Cloudflare Tunnel is best
   - No, but can create one → Still best option (free)
   - No, just quick test → Use ngrok

### Recommended Flow

```
Agent: "I've set up Mission Control locally at http://localhost:3000. 
        Would you like me to make it accessible from anywhere?
        
        Options:
        1. Cloudflare Tunnel (free, secure, custom domain)
        2. ngrok (quick, temporary URL)
        3. GitHub Pages (read-only demo)
        
        For option 1, you'll need a Cloudflare account and domain.
        For option 2, just need to install ngrok.
        For option 3, I can set it up automatically via GitHub."
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Server not running. Run `cd server && npm start` |
| Tunnel not connecting | Check cloudflared/ngrok is running and authenticated |
| WebSocket errors | Make sure proxy passes `Upgrade` headers |
| GitHub Pages 404 | Check workflow ran successfully, source is "GitHub Actions" |
| Can't access from phone | Need public URL (tunnel or ngrok), localhost only works on same machine |

---

## See Also

- **[missiondeck.ai/deploy](https://missiondeck.ai/deploy)** — One-click agent deployment
- **[missiondeck.ai/agent-builder](https://missiondeck.ai/agent-builder)** — Visual agent design
- [Dashboard Skill](dashboard.md) — Server API and WebSocket details
- [Setup Skill](setup.md) — Initial installation
- [MissionDeck API Skill](missiondeck-api.md) — Full MissionDeck platform guide