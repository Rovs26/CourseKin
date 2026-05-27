from app.core.utils import utc_now_iso


def build_fake_reviewer(project_id: str, source_id: str) -> dict:
    now = utc_now_iso()

    return {
        "project_id": project_id,
        "source_id": source_id,
        "status": "ready",
        "output_type": "full-reviewer",
        "version": 1,
        "content_json": {
            "summary": "This is a sample generated reviewer for the selected source. It is temporary mock content used to validate the frontend-backend connection.",
            "key_points": [
                "Main idea one from the source",
                "Main idea two from the source",
                "Main idea three from the source"
            ],
            "definitions": [
                {
                    "term": "Empire",
                    "definition": "A group of territories ruled by a single authority."
                },
                {
                    "term": "Republic",
                    "definition": "A state where power is held by the people and their representatives."
                }
            ],
            "qa": [
                {
                    "question": "What is the main topic of this reviewer?",
                    "answer": "It is a temporary generated reviewer based on the selected source."
                },
                {
                    "question": "Why are we using fake reviewer data?",
                    "answer": "To validate the full frontend and backend flow before real extraction and generation are connected."
                }
            ],
            "quiz": [
                {
                    "topic": "Application flow",
                    "question": "What is the purpose of this fake reviewer?",
                    "choices": [
                        "To replace the final AI system",
                        "To validate the app flow",
                        "To delete the source",
                        "To skip backend work"
                    ],
                    "answer": "To validate the app flow",
                    "rationale": "This fake reviewer is only used to make the API and frontend testable before the real generation pipeline is complete."
                }
            ],
            "flashcards": [
                {
                    "front": "Why use mock reviewer output first?",
                    "back": "To test the end to end system before the real generation pipeline is finished."
                },
                {
                    "front": "What status should a completed reviewer have?",
                    "back": "ready"
                }
            ]
        },
        "created_at": now,
        "updated_at": now,
    }
