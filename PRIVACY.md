# Privacy

Mint Browser does not add analytics, advertising SDKs, crash-report uploads, a remote browser account, or a history database. No wallet keys, API keys, saved passwords or personal profiles are distributed with the application.

Website cookies, local storage, IndexedDB and browser cache use an in-memory Electron session. They are shared between this application's tabs for normal website behavior and are not restored when the process exits. **Clear session** closes all tabs, clears storage and cache, and closes the session's network connections. Downloads you choose to save remain on disk.

Remote websites run in sandboxed, isolated views without Node.js access or the application bridge. Camera, microphone, geolocation, notifications, device permissions and restricted filesystem requests are denied. WebRTC is configured to disable non-proxied UDP, reducing exposure of local network addresses. Certificate validation and browser web security remain enabled.

Visiting a website still sends requests to that website and its third-party resources. Those services can see your public IP, user agent and activity, set temporary cookies, and collect data according to their policies. Mint Browser is not a VPN, Tor browser or an anonymity guarantee. Chromium/Electron or the operating system may keep runtime diagnostics and GPU caches; this project does not promise forensic erasure or protection from a compromised device.

The public project screenshots are from a fresh test session, without a signed-in account or connected wallet. Application binaries contain only the packaged application files and Electron runtime notices, not the developer's browser data or credentials.
