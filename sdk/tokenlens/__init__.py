"""
TokenLens Python SDK

Wraps OpenAI and Anthropic clients to route through the TokenLens proxy,
enabling automatic cost tracking by feature and user.

Usage:
    from tokenlens import TokenLens

    tl = TokenLens(api_key="tl_live_...")

    # Drop-in replacement for Anthropic client
    client = tl.anthropic(feature="chat-assistant", user="user_123")
    response = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello!"}]
    )

    # Drop-in replacement for OpenAI client
    client = tl.openai(feature="doc-summarizer", user="user_456")
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Summarize this..."}]
    )
"""

__version__ = "0.1.0"

DEFAULT_BASE_URL = "https://tokenlens-three.vercel.app"


class TokenLens:
    """TokenLens client for automatic AI API cost tracking."""

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL):
        """
        Args:
            api_key: Your TokenLens API key (starts with tl_live_).
                     Find it in the TokenLens dashboard under Settings → API Keys.
            base_url: TokenLens server URL. Defaults to the hosted version.
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def anthropic(self, *, feature: str = "default", user: str = "anonymous"):
        """
        Returns an Anthropic client that routes through TokenLens.
        Tracks costs by feature and end-user automatically.

        Args:
            feature: Name of the feature making the call (e.g., "chat-assistant").
            user: ID of the end-user making the request (e.g., "user_123").

        Returns:
            anthropic.Anthropic: Configured to proxy through TokenLens.

        Raises:
            ImportError: If the 'anthropic' package is not installed.
        """
        try:
            import anthropic
        except ImportError:
            raise ImportError(
                "The 'anthropic' package is required. Install it with: pip install anthropic"
            )
        return anthropic.Anthropic(
            base_url=f"{self.base_url}/api/proxy/anthropic",
            api_key="tl-routed",
            default_headers={
                "X-TL-Key": self.api_key,
                "X-TL-Feature": feature,
                "X-TL-User": user,
            },
        )

    def openai(self, *, feature: str = "default", user: str = "anonymous"):
        """
        Returns an OpenAI client that routes through TokenLens.
        Tracks costs by feature and end-user automatically.

        Args:
            feature: Name of the feature making the call (e.g., "doc-summarizer").
            user: ID of the end-user making the request (e.g., "user_456").

        Returns:
            openai.OpenAI: Configured to proxy through TokenLens.

        Raises:
            ImportError: If the 'openai' package is not installed.
        """
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "The 'openai' package is required. Install it with: pip install openai"
            )
        return OpenAI(
            base_url=f"{self.base_url}/api/proxy/openai/v1",
            api_key="tl-routed",
            default_headers={
                "X-TL-Key": self.api_key,
                "X-TL-Feature": feature,
                "X-TL-User": user,
            },
        )
