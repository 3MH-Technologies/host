#!/usr/bin/env bash
# 3MH Host Zero-Trust iptables Firewall Rules Script
# Enforces anti-SSRF protections and East-West inter-tenant isolation

set -euo pipefail

echo "[+] Applying 3MH Host Zero-Trust iptables security rules..."

# Define custom chains
iptables -N TENANT_FORWARD 2>/dev/null || iptables -F TENANT_FORWARD
iptables -N ANTI_SSRF 2>/dev/null || iptables -F ANTI_SSRF

# Direct forward traffic to TENANT_FORWARD
iptables -D FORWARD -j TENANT_FORWARD 2>/dev/null || true
iptables -I FORWARD 1 -j TENANT_FORWARD

# Allow established/related traffic
iptables -A TENANT_FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# Populate ANTI_SSRF rules
iptables -A ANTI_SSRF -d 169.254.169.254/32 -j DROP -m comment --comment "Block Cloud Metadata SSRF"
iptables -A ANTI_SSRF -d 169.254.0.0/16 -j DROP -m comment --comment "Block Link Local"
iptables -A ANTI_SSRF -d 10.0.0.0/8 -j DROP -m comment --comment "Block Class A Private Subnet"
iptables -A ANTI_SSRF -d 172.16.0.0/12 -j DROP -m comment --comment "Block Class B Private Subnet"
iptables -A ANTI_SSRF -d 192.168.0.0/16 -j DROP -m comment --comment "Block Class C Private Subnet"
iptables -A ANTI_SSRF -d 127.0.0.0/8 -j DROP -m comment --comment "Block Localhost Loopback"

# Route tenant bridge interfaces through ANTI_SSRF check
iptables -A TENANT_FORWARD -i br-tenant-+ -j ANTI_SSRF

# Inter-Tenant East-West Isolation: Drop traffic flowing between tenant bridges
iptables -A TENANT_FORWARD -i br-tenant-+ -o br-tenant-+ -j DROP -m comment --comment "Block East-West Inter-Tenant Traffic"

# Allowed outbound ports for egress (DNS, HTTP, HTTPS)
iptables -A TENANT_FORWARD -i br-tenant-+ -p udp --dport 53 -j ACCEPT
iptables -A TENANT_FORWARD -i br-tenant-+ -p tcp --dport 53 -j ACCEPT
iptables -A TENANT_FORWARD -i br-tenant-+ -p tcp --dport 80 -j ACCEPT
iptables -A TENANT_FORWARD -i br-tenant-+ -p tcp --dport 443 -j ACCEPT

# Default drop for remaining tenant egress attempt
iptables -A TENANT_FORWARD -i br-tenant-+ -j DROP

echo "[+] iptables Zero-Trust firewall rules successfully applied."
