"""Minimal post-deploy smoke checks for a ReviewFlow staging environment.

This script deliberately avoids performing mutations. With a Clerk bearer
token provided through an environment variable, it also verifies one
authenticated read endpoint.

Example:
    REVIEWFLOW_SMOKE_BEARER_TOKEN=... python -m scripts.staging_smoke \
        --api-url https://api-staging.reviewflow.app \
        --frontend-url https://staging.reviewflow.app \
        --expected-env staging
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def _get_json(url: str, headers: dict[str, str] | None = None) -> tuple[int, dict]:
    request = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            try:
                return response.status, json.loads(body)
            except json.JSONDecodeError:
                return response.status, {"body": body}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"body": body}
    except urllib.error.URLError as exc:
        return 0, {"error": str(exc.reason)}


def _get_text(url: str) -> tuple[int, str]:
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except urllib.error.URLError as exc:
        return 0, str(exc.reason)


def _check(name: str, passed: bool, detail: str) -> bool:
    label = "PASS" if passed else "FAIL"
    print(f"[{label}] {name}: {detail}")
    return passed


def run(api_url: str, frontend_url: str, expected_env: str, token_env: str) -> bool:
    api_url = api_url.rstrip("/")
    frontend_url = frontend_url.rstrip("/")
    results: list[bool] = []

    status, health = _get_json(f"{api_url}/health")
    results.append(
        _check(
            "API liveness",
            status == 200 and health.get("status") == "ok",
            f"HTTP {status}, env={health.get('env')}",
        )
    )
    results.append(
        _check(
            "API environment",
            health.get("env") == expected_env,
            f"expected {expected_env}, got {health.get('env')}",
        )
    )

    status, readiness = _get_json(f"{api_url}/ready")
    results.append(
        _check(
            "Database readiness",
            status == 200
            and readiness.get("status") == "ready"
            and readiness.get("database") == "ok",
            f"HTTP {status}, database={readiness.get('database')}",
        )
    )

    status, page = _get_text(frontend_url)
    results.append(
        _check(
            "Frontend landing page",
            status == 200 and "ReviewFlow" in page,
            f"HTTP {status}",
        )
    )

    token = os.getenv(token_env, "").strip() if token_env else ""
    if token:
        status, summaries = _get_json(
            f"{api_url}/projects/summaries",
            {"Authorization": f"Bearer {token}"},
        )
        results.append(
            _check(
                "Authenticated project summaries",
                status == 200 and isinstance(summaries.get("items"), list),
                f"HTTP {status}",
            )
        )
    else:
        print(f"[SKIP] Authenticated project summaries: set {token_env} to test Clerk auth")

    return all(results)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run non-mutating ReviewFlow staging smoke checks.")
    parser.add_argument("--api-url", required=True, help="Base URL for the staging API.")
    parser.add_argument("--frontend-url", required=True, help="Base URL for the staging frontend.")
    parser.add_argument("--expected-env", default="staging", help="Expected API APP_ENV value.")
    parser.add_argument(
        "--token-env",
        default="REVIEWFLOW_SMOKE_BEARER_TOKEN",
        help="Environment variable containing an optional Clerk bearer token.",
    )
    args = parser.parse_args()
    return 0 if run(args.api_url, args.frontend_url, args.expected_env, args.token_env) else 1


if __name__ == "__main__":
    sys.exit(main())
