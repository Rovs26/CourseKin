"""URL validation and SSRF protection utilities."""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Blocked IP ranges (private, loopback, link-local, metadata endpoints)
_BLOCKED_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),         # Private class A
    ipaddress.ip_network("172.16.0.0/12"),      # Private class B
    ipaddress.ip_network("192.168.0.0/16"),     # Private class C
    ipaddress.ip_network("169.254.0.0/16"),     # Link-local (AWS metadata)
    ipaddress.ip_network("0.0.0.0/8"),          # "This" network
    ipaddress.ip_network("::1/128"),            # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),          # IPv6 link-local
]

_BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal"}


def validate_url_safe(url: str) -> None:
    """Validate that a URL doesn't point to internal/private resources.

    Raises HTTPException(400) if the URL is unsafe.
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP and HTTPS URLs are allowed")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: no hostname found")

    # Block known dangerous hostnames
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        raise HTTPException(status_code=400, detail="URLs pointing to internal services are not allowed")

    # Resolve hostname to IP and check against blocked ranges
    try:
        addr_infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve URL hostname")

    for family, _, _, _, sockaddr in addr_infos:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        for blocked in _BLOCKED_RANGES:
            if ip in blocked:
                logger.warning("SSRF blocked: %s resolved to %s", url, ip_str)
                raise HTTPException(
                    status_code=400,
                    detail="URLs pointing to internal or private networks are not allowed",
                )
