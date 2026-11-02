# authkit-ts (legacy)

> **Legacy, not developed since 2026-04.** Kept for reference and a candidate for archiving. New work lives in:
> [authfly/authfly](https://github.com/authfly/authfly) (the `@authfly/core` provider contract and server SDKs),
> [authfly/authkit](https://github.com/authfly/authkit) (auth widgets for 9 targets on UI8Kit 3) and
> [authfly/cli](https://github.com/authfly/cli) (the Authfly server and `npx authfly`).

The early browser SDK of Authfly: provider-agnostic flow contracts (start, challenge, verify, complete, error), a
localized error catalog and a DOM controller for embedded authentication widgets (`src/`).

Note: `package.json` still says `@authfly/core` 0.2.0. That name now belongs to the contract package in
authfly/authfly (`@authfly/core` 1.x on npm); this repo is not published.

```sh
bun install && bun run build
```

Apache-2.0, © Authfly.
