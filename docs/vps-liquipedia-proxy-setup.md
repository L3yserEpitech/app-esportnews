# VPS setup — dedicated-IP forward proxy for Liquipedia

> **You (the assistant reading this) are running on a fresh VPS.** Your job is to
> turn this machine into a small, secure **HTTP forward proxy** whose only purpose
> is to relay traffic to Liquipedia (`*.liquipedia.net`) through this VPS's clean,
> dedicated IP. You have zero prior context about the project — everything you need
> is in this document. Work through it top to bottom, then report back the values
> in the **"Deliverables"** section.
>
> **⚠️ VALIDATION GATE — read this first.** This machine must be **fully hardened**,
> not just made to work. Sections **1–13** set up the proxy; section **14** hardens
> the whole VPS (SSH, firewall default-deny, fail2ban, kernel/network anti-DDoS,
> auto-updates, attack-surface minimization). Before you run ANY command:
> 1. Read the **entire** document including section 14.
> 2. **Present a concise combined plan** (setup + hardening) to the human operator
>    and **wait for explicit approval**. Do not start until they validate it.
> 3. Then execute **step by step**, announcing each step, and **respecting every
>    anti-lockout safeguard** in section 14 (keep your current SSH session open,
>    verify a second session works before closing the first, open firewall ports
>    before enabling the firewall, create the sudo user + key before disabling root/
>    password SSH). A mistake here can lock you out of the box permanently.

---

## 1. Why this exists (context)

A separate application backend runs on **Railway** (a cloud PaaS). It consumes the
**Liquipedia Database API** (`https://api.liquipedia.net`) with a valid API key, and
also fetches images from `https://liquipedia.net/commons/...`.

**The problem:** Liquipedia's edge (Cloudflare) blocks large ranges of **Railway
shared egress IPs** wholesale, because that IP space sends them a lot of abuse.
Our traffic is legitimate and well within rate limits, but we're collateral damage
on the shared IP. Liquipedia confirmed there is **no way to whitelist an API key at
the edge** — the fix is to egress from a **dedicated, non-Railway IP**.

**The solution (this VPS):** a dumb **forward proxy**. The Railway backend keeps ALL
of its logic (API key, rate-limit budgeting, caching, parsing). It simply sends its
Liquipedia HTTP requests **through this VPS**, so those requests reach Liquipedia
from this VPS's clean IP instead of a Railway IP.

```
Railway backend ──HTTP proxy (CONNECT tunnel)──► THIS VPS (clean dedicated IP) ──► *.liquipedia.net
   (all app logic, API key)                       (dumb forward proxy, no logic)
```

**This VPS must NOT:**
- run any application code or store the Liquipedia API key (it never sees it — the
  key travels inside the tunneled HTTPS request, opaque to the proxy),
- be an open proxy to the whole internet (that would get it abused/blocked too).

**This VPS MUST:**
- forward only to `*.liquipedia.net`,
- require authentication,
- be reachable from the Railway backend (which has a dynamic/shared source IP, so we
  cannot allowlist it by IP — we authenticate with a username/password instead).

---

## 2. Assumptions & prerequisites

- OS: **Debian 12** or **Ubuntu 22.04/24.04** (adapt `apt` if different; tell Jules if the OS differs).
- You have **root / sudo**.
- The VPS has a **public, dedicated IPv4** (find it: `curl -4 -s https://api.ipify.org`).
- Provider is **NOT Railway** (Hetzner, OVH, DigitalOcean, Scaleway, etc.).

If any assumption is false, **stop and report** rather than guessing.

---

## 3. STEP 0 (critical) — verify this VPS's IP is not already blocked

Before installing anything, confirm Liquipedia does not already block this VPS's IP.
Run:

```bash
curl -4 -s -o /dev/null -w "%{http_code}\n" https://api.liquipedia.net/api/v3/match
```

Interpret the status code:
- **`401` or `403`** → the IP is **clean** (auth required, since we sent no API key). This is what we want. Continue.
- **`429`** → this VPS's IP is **also blocked** by Liquipedia. **STOP.** This provider/IP won't work; report to Jules that a different provider or a fresh IP is needed.

Also record the public IP now: `curl -4 -s https://api.ipify.org` — you'll need it in the deliverables.

---

## 4. STEP 1 — install tinyproxy

`tinyproxy` is a tiny, well-suited HTTP forward proxy.

```bash
sudo apt-get update
sudo apt-get install -y tinyproxy apache2-utils
```

(`apache2-utils` is only used to help generate a strong password if needed; optional.)

---

## 5. STEP 2 — generate a strong credential

We authenticate the proxy with HTTP Basic Auth. Generate a strong random password and
choose a username (e.g. `esportnews`):

```bash
PROXY_USER="esportnews"
PROXY_PASS="$(openssl rand -hex 24)"
echo "PROXY_USER=$PROXY_USER"
echo "PROXY_PASS=$PROXY_PASS"
```

**Save both** — they go in the deliverables and into the tinyproxy config below. Treat
`PROXY_PASS` as a secret.

Also pick a port. Default **8888** is fine (avoid 8080/3128 which bots scan hardest):

```bash
PROXY_PORT=8888
```

---

## 6. STEP 3 — write the tinyproxy config

Back up the shipped config, then write ours. **Substitute** `PROXY_PORT`, `PROXY_USER`,
`PROXY_PASS` with the real values (do not leave the placeholders).

```bash
sudo cp /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf.bak 2>/dev/null || true
sudo tee /etc/tinyproxy/tinyproxy.conf >/dev/null <<EOF
User tinyproxy
Group tinyproxy

# Listen on all interfaces so the Railway backend can reach us. Access is gated by
# BasicAuth + the domain allowlist below, and by the firewall (only this port + SSH).
Listen 0.0.0.0
Port ${PROXY_PORT}

Timeout 600
MaxClients 100

# Basic auth — REQUIRED for every request. Railway will use these creds.
BasicAuth ${PROXY_USER} ${PROXY_PASS}

# Allow HTTPS tunneling (CONNECT) only to 443. api.liquipedia.net is HTTPS.
ConnectPort 443

# Domain allowlist: deny everything, permit only *.liquipedia.net. This makes the
# proxy useless to anyone who somehow gets the creds (it can ONLY reach Liquipedia),
# so it can't be abused as an open relay.
Filter "/etc/tinyproxy/allowlist.filter"
FilterDefaultDeny Yes
FilterExtended On
FilterCaseSensitive Off

# Quiet-ish logging. Bump to Info while debugging.
LogLevel Warning
LogFile "/var/log/tinyproxy/tinyproxy.log"
PidFile "/run/tinyproxy/tinyproxy.pid"

# Don't leak that we're a proxy / don't add Via headers with our hostname.
DisableViaHeader Yes
EOF
```

Write the allowlist (matches `liquipedia.net` and any subdomain like `api.liquipedia.net`):

```bash
sudo tee /etc/tinyproxy/allowlist.filter >/dev/null <<'EOF'
(^|\.)liquipedia\.net$
EOF
```

> Notes:
> - `FilterDefaultDeny Yes` + this file = **allowlist mode** (only listed hosts pass).
> - The filter applies to the CONNECT hostname (HTTPS), which is exactly what we need.
> - If a future need arises to allow another host, add one regex line and restart.

---

## 7. STEP 4 — firewall (only SSH + the proxy port)

> This is the **minimum** to not lock yourself out during setup. The **authoritative,
> hardened firewall** (default-deny, SSH rate-limit, per-IP connection cap on the
> proxy port, IPv6) is in **section 14.3** — apply that version. This step just gets a
> safe baseline in place immediately.

Using `ufw` (install if missing: `sudo apt-get install -y ufw`):

```bash
sudo ufw allow 22/tcp          # SSH — do this FIRST so you don't lock yourself out
sudo ufw allow ${PROXY_PORT}/tcp
sudo ufw --force enable
sudo ufw status verbose
```

If the provider has its own cloud firewall/security group, mirror the same rules there
(allow inbound TCP on 22 and `PROXY_PORT`).

---

## 8. STEP 5 — enable & start the service

```bash
sudo systemctl enable tinyproxy
sudo systemctl restart tinyproxy
sudo systemctl status tinyproxy --no-pager
```

If it fails to start, check `sudo journalctl -u tinyproxy -n 50 --no-pager` and the
config syntax; fix and restart.

---

## 9. STEP 6 — verify (all four checks must pass)

Run these ON the VPS. Substitute the real `PROXY_USER`/`PROXY_PASS`/`PROXY_PORT`.

**(a) No auth → must be rejected (407):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -x http://127.0.0.1:${PROXY_PORT} https://api.liquipedia.net/api/v3/match
# expect: 407  (Proxy Authentication Required)
```

**(b) With auth, to Liquipedia → tunnel works, IP is clean (401/403, NOT 429):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -x http://${PROXY_USER}:${PROXY_PASS}@127.0.0.1:${PROXY_PORT} https://api.liquipedia.net/api/v3/match
# expect: 401 or 403  (Liquipedia auth required = we reached it from a clean IP)
# 429 here = the VPS IP is blocked too → STOP, report to Jules.
```

**(c) With auth, to a non-allowlisted host → must be blocked by the filter:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -x http://${PROXY_USER}:${PROXY_PASS}@127.0.0.1:${PROXY_PORT} https://example.com
# expect: 403/forbidden (tinyproxy filter denies non-liquipedia hosts)
```

**(d) Reachable from OUTSIDE (optional but recommended):** from any other machine (or ask Jules to run it), replacing `<VPS_IP>`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -x http://${PROXY_USER}:${PROXY_PASS}@<VPS_IP>:${PROXY_PORT} https://api.liquipedia.net/api/v3/match
# expect: 401/403 (same as b, but proving the port is open through the firewall)
```

If (a)=407, (b)=401/403, (c)=403, (d)=401/403 → the proxy is correctly set up and secure.

---

## 10. Deliverables — report these back to Jules

Once all checks pass, report **exactly** this (Jules pastes the proxy URL into a Railway
env var; the backend code already knows how to use it):

1. **Proxy URL** (this is the important one):
   ```
   http://<PROXY_USER>:<PROXY_PASS>@<VPS_PUBLIC_IP>:<PROXY_PORT>
   ```
   e.g. `http://esportnews:ab12...ef@203.0.113.45:8888`
2. The VPS **public IPv4** (`<VPS_PUBLIC_IP>`).
3. Confirmation of the Step 0 check (IP clean: 401/403, not 429).
4. Confirmation that verification checks (a)(b)(c) passed.
5. The provider name + region (so Jules knows what the egress IP belongs to).

Jules will set, on the Railway backend service:
```
LIQUIPEDIA_HTTP_PROXY=http://<PROXY_USER>:<PROXY_PASS>@<VPS_PUBLIC_IP>:<PROXY_PORT>
```
(The backend applies this proxy ONLY to its Liquipedia + image HTTP clients; all other
outbound traffic keeps going direct. No further action needed on the VPS.)

---

## 11. Security checklist (do not skip)

- [ ] `BasicAuth` is set with a strong random password (24+ hex chars).
- [ ] `FilterDefaultDeny Yes` + allowlist = the proxy can ONLY reach `*.liquipedia.net`.
- [ ] Firewall allows ONLY SSH (22) + the proxy port. Everything else denied.
- [ ] SSH is key-based if possible; disable password SSH login if you set that up.
- [ ] `ConnectPort` is limited to `443` (no arbitrary CONNECT tunneling).
- [ ] No plaintext logging of credentials (tinyproxy doesn't log the password; keep `LogLevel` at Warning in normal operation).

**Never** remove `BasicAuth` or `FilterDefaultDeny` "to make it work" — an open proxy
to the whole internet WILL be found by bots within hours and get the IP blocked
(defeating the entire purpose).

---

## 12. Maintenance / troubleshooting

- Logs: `sudo tail -f /var/log/tinyproxy/tinyproxy.log` (set `LogLevel Info` temporarily for verbose).
- Restart after config change: `sudo systemctl restart tinyproxy`.
- Add an allowed host: append a regex line to `/etc/tinyproxy/allowlist.filter`, restart.
- If Liquipedia later blocks THIS IP too (check with Step 0's curl → 429), the VPS IP has
  been flagged; request a new IP from the provider or move providers, then re-run Step 0.
- Rotate the password: change `BasicAuth` in the config, restart, and give Jules the new
  proxy URL to update on Railway.

---

## 13. One-shot summary for a quick operator

```bash
# 0. Check IP is clean (expect 401/403, NOT 429)
curl -4 -s -o /dev/null -w "%{http_code}\n" https://api.liquipedia.net/api/v3/match

# 1. Install
sudo apt-get update && sudo apt-get install -y tinyproxy ufw

# 2. Creds
PROXY_USER="esportnews"; PROXY_PASS="$(openssl rand -hex 24)"; PROXY_PORT=8888
echo "$PROXY_USER / $PROXY_PASS / :$PROXY_PORT"

# 3. Config + allowlist  (see Step 3 — write /etc/tinyproxy/tinyproxy.conf and allowlist.filter)
# 4. Firewall
sudo ufw allow 22/tcp && sudo ufw allow ${PROXY_PORT}/tcp && sudo ufw --force enable
# 5. Start
sudo systemctl enable tinyproxy && sudo systemctl restart tinyproxy
# 6. Verify (Step 9 a/b/c) then report the proxy URL (Step 10)
```

---

## 14. Full VPS security hardening (REQUIRED)

This box is a single-purpose proxy exposed to the internet. It stores nothing
sensitive, but it MUST NOT become (a) an intrusion foothold, (b) an abuse relay, or
(c) a source of traffic that gets the IP blocked. Threat model = SSH brute-force,
proxy abuse, and connection-level floods. Apply everything below.

> **Present this plan to the operator and get approval before executing (see the
> Validation Gate at the top). Then do it step by step.**

### 14.0 Anti-lockout safeguards (follow for EVERY step that touches SSH or firewall)
- Keep your **current SSH session open** the whole time.
- After any SSH or firewall change, **open a SECOND SSH session** and confirm it works
  **before** closing the first. If the new session fails, revert from the still-open one.
- Create the **sudo user + install its SSH public key + test login with it** BEFORE
  disabling root login or password auth.
- In the firewall, **allow the SSH port FIRST**, then enable the firewall.
- If you change the SSH port, allow the NEW port in the firewall before reloading sshd,
  and keep the old session until the new port is verified.

### 14.1 Attack-surface principle — open only what's needed, close the rest
- Inbound, exactly **two** ports may be open: **SSH** and the **proxy port**. Nothing else.
- Audit what's actually listening; anything other than `sshd` and `tinyproxy` must be
  stopped/removed:
  ```bash
  sudo ss -tulpn        # list listening sockets
  ```
  Expected: sshd on 22 (or your chosen SSH port), tinyproxy on the proxy port. If you
  see anything else (a stray web server, database, mail, etc.), disable it:
  `sudo systemctl disable --now <service>` and/or `sudo apt-get purge <pkg>`.
- Do not install a web server, DB, or panel. Keep the package set minimal.

### 14.2 SSH hardening (the #1 intrusion vector)
1. **Create a non-root sudo user with key auth** (skip if it already exists):
   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   sudo usermod -aG sudo deploy
   sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
   # paste the operator's PUBLIC key:
   echo "ssh-ed25519 AAAA...operator_public_key... comment" | sudo tee /home/deploy/.ssh/authorized_keys
   sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
   ```
   **Test `ssh deploy@<VPS_IP>` in a second session before continuing.**
2. Harden sshd via a drop-in (don't hand-edit the main file):
   ```bash
   sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
   PermitRootLogin no
   PasswordAuthentication no
   PubkeyAuthentication yes
   KbdInteractiveAuthentication no
   ChallengeResponseAuthentication no
   AuthenticationMethods publickey
   MaxAuthTries 3
   LoginGraceTime 20
   ClientAliveInterval 300
   ClientAliveCountMax 2
   X11Forwarding no
   AllowAgentForwarding no
   AllowTcpForwarding no
   PermitTunnel no
   AllowUsers deploy
   EOF
   sudo sshd -t && sudo systemctl reload ssh   # 'ssh' or 'sshd' depending on distro
   ```
   > `AllowTcpForwarding no` / `PermitTunnel no` are safe here: the proxy is tinyproxy,
   > not SSH tunneling. This prevents the box being used as an SSH-based relay.
3. (Optional) Move SSH off port 22 to cut brute-force noise. If you do: add `Port <new>`
   to the drop-in, **open `<new>` in the firewall first**, verify, then remove 22.

### 14.3 Firewall — default-deny (authoritative version; supersedes Step 4)
Using `ufw`:
```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing        # outbound must stay open (proxy needs to reach Liquipedia)
sudo ufw limit 22/tcp                  # 'limit' = rate-limit SSH brute-force (use your SSH port)
sudo ufw allow 8888/tcp                # the proxy port
sudo ufw --force enable
sudo ufw status verbose
```
- `default deny incoming` closes everything not explicitly allowed (requirement #1).
- `ufw limit` throttles repeated SSH connection attempts from the same IP.
- **IPv6:** ufw applies rules to IPv6 too (ensure `IPV6=yes` in `/etc/default/ufw`, default on
  modern Ubuntu/Debian). If the VPS has a public IPv6, the same two-ports-only policy now
  covers it. If you don't need IPv6 at all, you may additionally disable it, but firewalling
  it is sufficient.
- **Per-IP connection cap on the proxy port** (blunts a single-source connection flood).
  ufw can't express this directly; add an nftables rule:
  ```bash
  sudo nft add table inet filter 2>/dev/null || true
  sudo nft 'add chain inet filter input { type filter hook input priority -10 ; }' 2>/dev/null || true
  # drop sources opening >30 concurrent connections to the proxy port:
  sudo nft add rule inet filter input tcp dport 8888 ct count over 30 drop
  ```
  Also mirror the provider firewall/security group (OVH/Hetzner console) with the same
  two-ports rule for defense in depth.

### 14.4 fail2ban — auto-ban brute-force & proxy abuse
```bash
sudo apt-get install -y fail2ban
```
Config (`/etc/fail2ban/jail.local`):
```bash
sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = ssh
maxretry = 4
bantime  = 24h

[tinyproxy]
enabled  = true
port     = 8888
logpath  = /var/log/tinyproxy/tinyproxy.log
maxretry = 5
bantime  = 6h
EOF
```
Custom tinyproxy filter — bans IPs that repeatedly fail auth or hit the domain
allowlist (i.e. someone probing/abusing the proxy):
```bash
sudo tee /etc/fail2ban/filter.d/tinyproxy.conf >/dev/null <<'EOF'
[Definition]
# Matches tinyproxy denials: failed proxy auth and filtered (non-allowlisted) hosts.
# Verify against real log lines (see note) and adjust if your tinyproxy version differs.
failregex = ^.*(Failed auth|Unauthorized|proxy authentication).*from <HOST>.*$
            ^.*Filtered connection.*(from|by) <HOST>.*$
            ^.*Connection to .* refused.*<HOST>.*$
ignoreregex =
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status
```
> **Verify the filter matches reality:** temporarily set `LogLevel Info` in
> `/etc/tinyproxy/tinyproxy.conf`, restart tinyproxy, then from another host run a
> no-auth request and a request to a non-allowlisted domain, and
> `sudo tail -n 50 /var/log/tinyproxy/tinyproxy.log` to see the exact strings. Tune
> `failregex` to those strings, then `sudo systemctl restart fail2ban` and set LogLevel
> back to Warning. Confirm with `sudo fail2ban-client status tinyproxy`.

### 14.5 Kernel / network hardening (sysctl) — anti-spoof, SYN-flood, no redirects
```bash
sudo tee /etc/sysctl.d/99-hardening.conf >/dev/null <<'EOF'
# SYN flood mitigation
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
# Anti-spoofing (reverse path filter)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
# Ignore ICMP broadcast (smurf) and bogus responses
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
# No source routing, no ICMP redirects (accept or send)
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
# Log spoofed/martian packets
net.ipv4.conf.all.log_martians = 1
EOF
sudo sysctl --system
```

### 14.6 Automatic security updates
```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades   # enables security auto-updates
# optional: auto-reboot at 4am if a patch needs it
echo 'Unattended-Upgrade::Automatic-Reboot "true";'            | sudo tee /etc/apt/apt.conf.d/51reboot >/dev/null
echo 'Unattended-Upgrade::Automatic-Reboot-Time "04:00";'      | sudo tee -a /etc/apt/apt.conf.d/51reboot >/dev/null
```

### 14.7 Volumetric DDoS — set expectations + enable provider protection
Be clear with the operator: a single small VPS **cannot** absorb a large volumetric
DDoS on its own — that is the **provider's** network job. What we do:
- **On the VPS:** SYN cookies (14.5), SSH rate-limit + per-IP connection cap (14.3),
  fail2ban (14.4), and `MaxClients` in tinyproxy — these blunt connection-level and
  brute-force abuse.
- **At the provider:** enable/confirm the network-level anti-DDoS. **OVH includes
  "Anti-DDoS" by default**; **Hetzner** has automatic DDoS protection; check the
  provider console and make sure it's on. If a real attack happens, rely on that layer
  and, worst case, ask the provider to change the IP.
Also: because the proxy only accepts authenticated requests to `*.liquipedia.net`, it
is **not usable as a reflection/amplification or spam relay** — the biggest abuse vector
for a proxy is already closed by BasicAuth + the domain allowlist (sections 3 & 6).

### 14.8 Minimize surface & good hygiene
- Remove packages you didn't need: `sudo apt-get autoremove --purge -y`.
- No panels/agents you don't use. Confirm `sudo ss -tulpn` shows only sshd + tinyproxy.
- Keep the tinyproxy `BasicAuth` password strong and **rotate it** if it may have leaked
  (change it, restart tinyproxy, give the operator the new proxy URL).
- Time sync on (for correct TLS + log timestamps): `timedatectl` should show NTP active.

### 14.9 Post-hardening verification (all must hold)
```bash
sudo ss -tulpn                         # only sshd + tinyproxy listening
sudo ufw status verbose                # default deny incoming; only SSH + proxy port
sudo fail2ban-client status            # sshd + tinyproxy jails active
sudo sshd -t && echo "sshd config ok"  # no config error
ssh -o BatchMode=yes -o PasswordAuthentication=yes root@<VPS_IP> true 2>&1 | grep -qi "permission denied\|not allowed" && echo "root/password SSH refused (good)"
```
Plus re-run the proxy checks in section 9 (a=407, b=401/403, c=403) to confirm hardening
didn't break the proxy.

### 14.10 Report to the operator (in addition to section 10 deliverables)
- Confirmation that: only SSH + proxy port are open; root & password SSH are disabled;
  fail2ban (sshd + tinyproxy) is active; unattended-upgrades enabled; sysctl applied;
  provider anti-DDoS confirmed on.
- The SSH **user** and **port** in use (so the operator knows how to reconnect), and a
  reminder that login is **key-only** (which key was authorized).
