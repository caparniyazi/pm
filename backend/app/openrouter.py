import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
REQUEST_TIMEOUT_SECONDS = 30


class OpenRouterError(Exception):
    pass


def ask_openrouter_messages(
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    response_format: dict | None = None,
) -> str:
    body: dict = {"model": model, "messages": messages}
    if response_format is not None:
        body["response_format"] = response_format
    payload = json.dumps(body).encode("utf-8")
    request = Request(
        OPENROUTER_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            response_data = json.load(response)
    except HTTPError as error:
        try:
            error_data = json.load(error)
            provider_message = error_data.get("error", {}).get("message")
        except (json.JSONDecodeError, AttributeError):
            provider_message = None
        detail = f"OpenRouter returned HTTP {error.code}"
        if isinstance(provider_message, str) and provider_message:
            detail = f"{detail}: {provider_message}"
        raise OpenRouterError(detail) from error
    except (URLError, TimeoutError) as error:
        raise OpenRouterError("OpenRouter request failed") from error
    except json.JSONDecodeError as error:
        raise OpenRouterError("OpenRouter returned invalid JSON") from error

    try:
        content = response_data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise OpenRouterError("OpenRouter response did not contain a message") from error
    if not isinstance(content, str) or not content:
        raise OpenRouterError("OpenRouter response contained an empty message")
    return content


def ask_openrouter(api_key: str, model: str, prompt: str) -> str:
    return ask_openrouter_messages(
        api_key,
        model,
        [{"role": "user", "content": prompt}],
    )
