# BookNook API

Express + MongoDB (TypeScript) server for BookNook. Exactly 8 routes:

| Method | Route                                    | Access              |
| ------ | ---------------------------------------- | ------------------- |
| GET    | `/books` (`?q=&category=&email=&limit=`) | public              |
| GET    | `/books/:id`                             | JWT                 |
| POST   | `/books`                                 | JWT                 |
| PATCH  | `/books/:id`                             | JWT, owner only     |
| DELETE | `/books/:id`                             | JWT, owner only     |
| POST   | `/borrows`                               | JWT                 |
| GET    | `/borrows`                               | JWT (own borrows)   |
| DELETE | `/borrows/:id`                           | JWT (return a book) |

## How JWT works

The Next.js client (BetterAuth `jwt` plugin) issues a token. This server
verifies it with `jose` using the public keys at `AUTH_URL/api/auth/jwks`, so no
secret is shared between the two apps.

## Borrow rules

- Copies are changed atomically with `$inc` (borrow: -1 only when copies > 0,
  return: +1).
- A unique index on `(bookId, userEmail)` stops double borrowing, even under
  race conditions.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev      # http://localhost:5000
npm run seed     # optional: add 10 sample books
```

## Deploy (Render)

Build command `npm install && npm run build`, start command `npm start`. Set
`MONGODB_URI`, `MONGODB_DB`, `AUTH_URL` (your live client URL) and `CLIENT_URL`
(same URL, used for CORS).
