# VPS network recovery — 2026-11-19

After container recreation, `amnezia-awg2` was attached only to Docker's `bridge`, while `amnezia-dns` lived on `amnezia-dns-net` at `172.29.172.254`. A DNS lookup from the VPN container timed out.

Applied without restarting either container:

```sh
docker network connect --gw-priority -1 amnezia-dns-net amnezia-awg2
```

Verified: DNS lookups for example.com and teamspeak.com succeed from the VPN container. The default route remains via `172.17.0.1` on eth0. The DNS network is reachable on eth1 and the existing VPN NAT rules cover eth1. Docker retains this attachment across container restarts; a full container recreation must include both networks with the DNS gateway priority below the primary network.

TeamSpeak currently runs version 6.0.0-beta13.1, exposing UDP 9987 and TCP 30033. Its startup at 2026-11-18 22:43 UTC generated a new admin privilege key, indicating fresh provisioning. No TeamSpeak settings were changed during this diagnosis. Screen-sharing functionality requires a test with actual clients; functioning voice ports alone cannot validate it.
