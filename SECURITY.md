# Security

Report vulnerabilities privately to the repository owner using GitHub's **Report a vulnerability** feature when available. Do not post credentials, wallet keys or private browsing data in public issues.

The maintained release is 1.1.x. Keep Electron updated when distributing builds. The project is a small browser MVP and has not received an independent penetration test or security certification.

Remote pages have no Node.js integration, preload bridge or native shell access. Only the bundled application's main frame can send browser commands. Generated `blob:`/`data:`/`srcdoc` chart frames are allowed inside sandboxed web content; native/file protocols remain blocked.

Windows builds are unsigned. Verify the published SHA-256 checksum before redistribution. The MIT license permits commercial use but does not provide a warranty. Electron and Chromium third-party license notices are included in the binary distribution.
