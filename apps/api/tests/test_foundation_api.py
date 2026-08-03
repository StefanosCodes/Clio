import json

from fastapi.testclient import TestClient

from clio.main import create_app


def _events(response_text: str) -> list[dict[str, object]]:
    return [
        json.loads(line.removeprefix("data: "))
        for line in response_text.splitlines()
        if line.startswith("data: ")
    ]


def test_foundation_boots_and_streams_stable_events() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/health/live").json() == {"status": "live"}
        response = client.post(
            "/api/v1/foundation/chat/stream",
            json={
                "message": "hello",
                "client_message_id": "message_0001",
                "after_cursor": -1,
            },
        )

    assert response.status_code == 200
    events = _events(response.text)
    assert [event["event"] for event in events] == [
        "session",
        "status",
        "text_delta",
        "usage",
        "status",
        "done",
    ]
    assert [event["cursor"] for event in events] == list(range(6))
    assert events[3]["usage"]["evidence_class"] == "synthetic"


def test_foundation_reconnect_replays_strictly_after_cursor() -> None:
    with TestClient(create_app()) as client:
        first = client.post(
            "/api/v1/foundation/chat/stream",
            json={"message": "hello", "client_message_id": "message_0002"},
        )
        resumed = client.post(
            "/api/v1/foundation/chat/stream",
            json={
                "message": "hello",
                "client_message_id": "message_0002",
                "after_cursor": 2,
            },
        )

    assert [event["cursor"] for event in _events(first.text)] == list(range(6))
    assert [event["cursor"] for event in _events(resumed.text)] == [3, 4, 5]
