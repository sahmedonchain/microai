# MicroAI — Critical Web3 Security & Resilience Implementation

## Mission

Act as a senior Web3 security engineer. Audit the entire MicroAI repository and implement a defense-in-depth security architecture before continuing feature development. Use lessons from historical incidents such as Poly Network and Ronin, alongside OWASP Smart Contract Top 10, OWASP Web3 Wallet Security and OWASP Web Application Security guidance.

Do not merely add security documentation. Verify the actual code paths, implement missing controls, and test them.

## 1. Smart Contract & Business Logic Security

* Review access control, authorization, business logic, reentrancy, signature verification, replay protection, integer arithmetic, external calls and input validation.
* Check for unauthorized withdrawals, incorrect payment accounting, duplicate claims, reward manipulation and privilege escalation.
* For bridge or cross-chain functionality, validate message authenticity, source chain, source contract, nonce and replay protection.
* Use static analysis, unit tests, fuzzing and invariant tests where applicable.
* Do not deploy newly generated contracts without security checks and explicit user approval.

## 2. Wallet-Draining Prevention

* Never collect or store wallet private keys or seed phrases.
* Never request signatures unrelated to the user's intended action.
* Clearly display transaction recipient, amount, token, network and approval scope before signing.
* Warn about unlimited approvals, unfamiliar contracts and dangerous typed-data signatures.
* Validate chain ID, token address and transaction parameters.
* Detect stale sessions and account/network changes.
* Never imply that connecting a wallet alone guarantees safety.
* Explain that users can still lose funds if they authorize malicious transactions or sign dangerous approvals.

## 3. Payment & Ledger Integrity

* Verify USDC transfers using trusted on-chain data.
* Validate sender, recipient, amount, token contract, network and receipt status.
* Implement idempotency, replay protection, duplicate-payment prevention and payment reconciliation.
* Ensure internal credit balances cannot be manipulated through concurrent requests, expired credits or repeated claims.
* Test partial failures between payment confirmation, ledger updates and AI service delivery.
* Use atomic database transactions or appropriate consistency controls.
* Do not trust frontend payment status or AI-generated claims as evidence.

## 4. Server, API & Infrastructure Resilience

* Review authentication, authorization, session handling, rate limits and request validation.
* Mitigate injection, XSS, CSRF, SSRF, broken access control and denial-of-service risks.
* Secure API keys, RPC credentials, AI provider keys and deployment secrets.
* Add timeouts, bounded retries, backoff, concurrency limits and request-size limits.
* Protect critical services from dependency failures and abusive traffic.
* Add health checks, structured logs, monitoring and security alerts.
* Establish backups, recovery procedures and incident-response runbooks.
* Avoid a single compromised credential or service becoming a system-wide failure.

## 5. AI & Code Execution Isolation

* Treat user prompts, uploaded files, GitHub repositories and retrieved documentation as untrusted input.
* Defend against prompt injection and malicious instructions embedded in project files.
* Run generated code, compilation and tests in an isolated sandbox with resource limits.
* Block unrestricted network access, filesystem access and secret exposure inside the sandbox.
* Separate AI planning from privileged tool execution.
* Require authorization and explicit approval for deployment or financial actions.
* Never expose production signing keys to the AI model or code-generation environment.

## 6. Supply Chain & Deployment Security

* Scan dependencies and lockfiles for known vulnerabilities.
* Enable secret scanning and static analysis in CI.
* Review build scripts and install-time dependency behavior.
* Use least-privilege deployment credentials.
* Protect production configuration and restrict administrative access.
* Block releases when critical security checks fail.
* Separate development, staging and production environments.
* Require explicit approval before production deployment or on-chain transactions.

## 7. Monitoring, Containment & Recovery

* Monitor unusual payment patterns, failed authentication attempts, abnormal traffic and unexpected service behavior.
* Add alerting for suspicious activity.
* Provide an emergency mechanism to disable affected features or pause new payments where appropriate.
* Document key rotation, service recovery, incident investigation and user notification procedures.
* Preserve security evidence without logging secrets or unnecessary sensitive data.

## 8. Security Verification

Create automated tests for:

* Unauthorized access and privilege escalation
* Forged, replayed and duplicate payment requests
* Incorrect token addresses, recipients, amounts and networks
* Concurrent payment and credit operations
* Expired sessions and SIWE nonce reuse
* Prompt injection and sandbox escape attempts
* Malicious contract interactions and dangerous approvals
* RPC outages, API rate limits and service failures
* Data leakage and secret exposure
* Regression of previously fixed vulnerabilities

Use controlled test environments and test wallets. Never conduct destructive tests against real user funds or production contracts.

## 9. Public Security Evidence

Create a `/security` page containing:

* Wallet permissions and data-handling explanation
* Security architecture overview
* Transaction and approval safety guidance
* Known limitations and user responsibilities
* Vulnerability reporting contact and disclosure policy
* Verified test results and remediation status
* Independent audit reports when available

Never claim "100% safe," "hack-proof," "no chance of loss" or "audited" without evidence supporting the exact claim.

## 10. Required Deliverables

1. Repository-wide security findings with severity and affected file paths.
2. Prioritized fixes for critical and high-risk vulnerabilities.
3. Implemented controls with code references.
4. Automated security tests and actual test results.
5. CI/CD security gates.
6. Incident response and recovery documentation.
7. A list of unresolved risks and external dependencies.
8. An independent audit readiness report.

Do not mark a control PASS merely because documentation or UI exists. Verify its implementation and tests. Do not make unsupported guarantees about wallet safety. Continue the seven implementation phases only through the security gates established for each phase.
