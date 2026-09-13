# PTCGL Code Redemption Mock

A local copy of the Pokémon TCG Live code redemption page for testing the
RedeemDex Firefox extension.

## Build and run

From the repository root:

```bash
npm install
npm run build:mock
npm --prefix mock run serve
```

Then open:

http://127.0.0.1:8000/

For development, Vite can serve the mock directly:

```bash
npm --prefix mock run dev
```

The mock backend is entirely local. It introduces a small artificial delay to
exercise asynchronous code handling without contacting Pokémon servers.

## Random mock results

Each submitted code randomly receives one of these results:

- `That code has already been redeemed by someone else.`
- `That code is not valid.`
- `You have already redeemed that code.`
- `Valid`

The delete control is deliberately an `<img>` with an `onclick` handler, to
match the DOM behaviour expected by the extension.
