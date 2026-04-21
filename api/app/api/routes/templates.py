from fastapi import APIRouter, HTTPException

from app.services.templates import get_template, list_templates

router = APIRouter(tags=["Templates"])


@router.get("/templates")
def get_all_templates():
    templates = list_templates()
    return {
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "sections": t.sections,
                "counts": t.counts,
            }
            for t in templates
        ],
        "total": len(templates),
    }


@router.get("/templates/{template_id}")
def get_single_template(template_id: str):
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "sections": template.sections,
        "counts": template.counts,
    }
