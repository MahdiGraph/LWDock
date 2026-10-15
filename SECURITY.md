# Security policy

Leaseweb Dock holds Leaseweb API keys that can power off, reinstall and wipe servers, so security reports are taken seriously.

## Reporting a vulnerability

Please do **not** open a public issue. Report it privately instead:

1. Go to the [Security tab](https://github.com/MahdiGraph/LWDock/security) of this repository.
2. Press **Report a vulnerability** and describe the problem, how to reproduce it and what an attacker could do.

You will get an answer as soon as possible. Once a fix is released, the advisory is published with credit to you, unless you prefer to stay anonymous.

## Supported versions

Only the latest release receives security fixes. Update by running the installer again:

```bash
curl -fsSL https://raw.githubusercontent.com/MahdiGraph/LWDock/main/install.sh | sudo bash
```

## Hardening your installation

- Put the panel behind HTTPS (see the README) and listen on `127.0.0.1` when a reverse proxy is in front.
- Create the admin account right after installing; until then, anyone who opens the panel can claim it.
- Give each person their own user account and remove accounts that are no longer needed.
- Keep `APP_SECRET` (in `/opt/leaseweb-dock/.env`) private and back it up together with the database.
