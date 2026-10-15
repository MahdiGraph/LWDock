# Leaseweb Dock

A small self-hosted panel for people who rent Leaseweb servers on behalf of others.

You keep the Leaseweb account. Your friends, clients or teammates get their own login and can manage only the servers you assign to them: reboot, reinstall, rescue mode, network, graphs and more, without ever touching your Leaseweb portal or API key.

- **One admin account** holds the Leaseweb API key (stored encrypted).
- **Users** see only the servers assigned to them.
- **Everything the Leaseweb API offers for a server** is available to its user: power, OS install, rescue, IPs and reverse DNS, null routing, switch ports, credentials, graphs, jobs, hardware, snapshots, console and ISOs.
- **Outbound proxy**: send every Leaseweb API request through an HTTP, HTTPS or SOCKS proxy, with no direct fallback.
- **Activity log** of who did what to which server.
- Dark and light mode, works on phones.

## Install

You need a Linux server with a public IP (1 GB RAM is enough). One command installs Docker and the Docker Compose plugin if they are missing, downloads Leaseweb Dock to `/opt/leaseweb-dock`, generates a secret and starts it:

```bash
curl -fsSL https://raw.githubusercontent.com/MahdiGraph/LWDock/main/install.sh | sudo bash
```

The installer asks two questions:

1. **Where to listen**: on all addresses (you open `http://SERVER-IP:PORT` directly), or on `127.0.0.1` only (you put Caddy, nginx or another reverse proxy in front).
2. **Which port**: it suggests a free one and refuses ports that are already taken.

At the end it prints the address to open. Create the admin account right away: the first person to open the page becomes the admin.

To skip the questions, for example in automation, set the answers in front of `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/MahdiGraph/LWDock/main/install.sh | sudo LISTEN_ADDRESS=127.0.0.1 PORT=8080 INSTALL_DIR=/srv/dock bash
```

Run the same command again later to update. It keeps your data and settings, and pressing Enter keeps the current address and port.

Leaseweb Dock uses Docker Compose v2, the `docker compose` command (with a space). The old standalone `docker-compose` 1.x is end-of-life and is not used even if it is installed; the installer adds the v2 plugin next to it.

### With Docker Compose by hand

```bash
git clone https://github.com/MahdiGraph/LWDock.git leaseweb-dock
cd leaseweb-dock
echo "APP_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d
```

`docker compose up` uses the published image (`ghcr.io/mahdigraph/lwdock`). If it cannot be pulled, build it locally with `docker compose up -d --build`.

### From source (Node.js 20.9 or newer)

```bash
git clone https://github.com/MahdiGraph/LWDock.git
cd LWDock
npm ci
npm run build
npm start
```

The panel listens on port 3000 and keeps its data in `./data`. Change that with a `.env` file (see `.env.example`).

## First steps

1. **Settings**: paste your Leaseweb API key and press *Test connection*. Create the key in the Leaseweb Customer Portal under [API keys](https://secure.leaseweb.com/api-client-management/).
2. **Settings → Outbound proxy** (optional): turn it on if the panel must reach Leaseweb through a proxy.
3. **Users**: create an account for each person. Copy the generated password and send it to them.
4. **Servers**: press *Assign* next to a server and tick the users who should manage it.

Users sign in at the same address and see only their own servers.

## What users can do

| Dedicated servers | Public Cloud instances and VPS |
| --- | --- |
| Power on, power off, reboot (power cycle) | Start, stop, reboot |
| Install an operating system, with control panel, SSH keys, root password and a post-install script | Reinstall from any image available to the machine |
| Boot into rescue mode | Web console (noVNC) |
| Follow, cancel, expire and retry jobs with live progress | Snapshots: take, restore, delete |
| IP addresses: reverse DNS, DDoS detection profile, null route on and off | IP addresses: reverse DNS, null route on and off |
| Open and close switch ports (public, internal, remote management) | Attach and detach ISO images |
| Bandwidth and data-traffic graphs | CPU and data-traffic graphs |
| Stored credentials: show, add, change, delete | Stored credentials, password reset |
| IPMI reset, hardware report and hardware scan | |

Admins can do all of that on every server, plus rename servers (Leaseweb reference), manage users and assignments, read the activity log and change settings. Billing details (prices, customer ID) are hidden from users.

## Outbound proxy

When the proxy is on, **every** request to the Leaseweb API goes through it. If the proxy is down or rejects the login, requests fail with a clear error; the panel never falls back to a direct connection.

| Protocol | Use it for |
| --- | --- |
| SOCKS5, DNS resolved by the proxy (`socks5h`) | Most SOCKS5 proxies. The proxy looks up `api.leaseweb.com`, so no DNS query leaves your server. |
| SOCKS5 (`socks5`) | SOCKS5 proxies that need an IP address instead of a host name. |
| SOCKS4 | Old SOCKS4 proxies. |
| HTTP proxy (`http`) | Ordinary HTTP proxies that support `CONNECT`. |
| HTTPS proxy (`https`) | HTTP proxies you connect to over TLS. |

Username and password are optional. The password is stored encrypted. *Test through proxy* checks the values on screen before you save them.

## HTTPS

Do not share the panel over plain HTTP. The easiest way to get HTTPS is [Caddy](https://caddyserver.com) on the same server. Choose *127.0.0.1 only* in the installer, point a DNS name at the server, then use the port the installer printed:

```
# /etc/caddy/Caddyfile
dock.example.com {
    reverse_proxy 127.0.0.1:PORT
}
```

To switch an existing installation to local-only, run the installer again and choose option 2, or set `PORT=127.0.0.1:PORT` in `/opt/leaseweb-dock/.env` and run `docker compose up -d` there.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on. With Docker Compose this is the host port, optionally with an address: `127.0.0.1:3000` listens on the local machine only. The installer writes it for you. |
| `APP_SECRET` | generated | Key that encrypts the API key and proxy password. If empty, one is generated and stored next to the database. Never change it after setup, or you have to enter the secrets again. |
| `DATA_DIR` | `./data` (`/data` in Docker) | Where the SQLite database lives. |
| `NPM_REGISTRY` | `https://registry.npmjs.org/` | Only for building the image yourself: the npm registry or mirror to download packages from. |
| `COOKIE_SECURE` | `auto` | `auto` marks the session cookie Secure when the request came over HTTPS. Set `true` behind a proxy that does not send `X-Forwarded-Proto`. |

## Update, back up, remove

```bash
# update (or simply run the installer again)
cd /opt/leaseweb-dock && git pull && docker compose pull && docker compose up -d

# back up the database
docker run --rm -v leaseweb-dock_lwdock-data:/data -v "$PWD":/backup busybox tar czf /backup/lwdock-backup.tgz -C /data .

# remove everything, including data
cd /opt/leaseweb-dock && docker compose down -v && cd / && rm -rf /opt/leaseweb-dock
```

Keep the `.env` file with your backup: the database is useless without its `APP_SECRET`.

## Security notes

- Users reach Leaseweb only through the panel, which checks every call against the user's assignments and a fixed list of allowed endpoints. Account-wide operations (ordering, invoices, private networks, terminating machines) are not exposed.
- Passwords are hashed with scrypt. The API key and proxy password are encrypted with AES-256-GCM.
- Sessions are HTTP-only cookies; sign-in attempts are rate limited.
- Every change made through the panel is written to the activity log, without passwords or scripts.
- Leaseweb notifications go to the contacts on your Leaseweb account, not to panel users.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`, in development). The stack is Next.js 16, React 19, Tailwind CSS 4, shadcn/ui and SQLite (better-sqlite3). The visual design follows the [taste skill](https://www.tasteskill.dev) (`.claude/skills/design-taste-frontend`).

## Disclaimer

Leaseweb Dock is an independent open-source project. It is not affiliated with, endorsed by or supported by Leaseweb. "Leaseweb" is a trademark of its owner.

## License

[MIT](LICENSE)
