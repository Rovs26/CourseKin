import requests
from app.core.config import settings


def trigger_n8n_workflow(payload: dict):
    url = f"{settings.N8N_BASE_URL}{settings.N8N_WEBHOOK_PATH}"
    try:
        response = requests.post(url, json=payload, timeout=15)
        return {
            "ok": response.ok,
            "status_code": response.status_code,
            "response": response.text,
            "url": url,
        }
    except requests.RequestException as e:
        return {
            "ok": False,
            "status_code": None,
            "response": str(e),
            "url": url,
        }