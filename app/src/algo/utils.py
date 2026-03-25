from urllib.parse import urlparse
from flask import request

def is_safe_url(target):
    """
    Check if the target URL is safe for redirecting.
    Prevents open redirect vulnerabilities by ensuring the URL is relative
    or belongs to the same host.
    """
    if not target:
        return False

    # Parse the target URL
    parsed = urlparse(target)

    # Allow relative URLs (no scheme or netloc)
    if not parsed.netloc and not parsed.scheme:
        return True

    # Allow URLs from the same host
    try:
        ref_url = urlparse(request.host_url)
        return parsed.netloc == ref_url.netloc and parsed.scheme in ("http", "https")
    except RuntimeError:
        # If we're outside of request context, only allow relative URLs
        return not parsed.netloc and not parsed.scheme
