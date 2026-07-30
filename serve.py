#!/usr/bin/env python3
"""Dev server that never lets the browser cache.

`python3 -m http.server` sends no Cache-Control, so browsers hold on to
data.js / main.js / style.css and you edit into the void. This is the same
server with caching switched off.

    python3 serve.py [port]     # default 8000
"""

import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_header(self, key, value):
        if key.lower() == "last-modified":
            return  # nothing to revalidate against — always send fresh bytes
        super().send_header(key, value)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"serving this folder, cache off → http://localhost:{port}")
    HTTPServer(("127.0.0.1", port), partial(NoCacheHandler)).serve_forever()
