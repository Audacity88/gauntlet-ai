# Summary of Authentication Debugging Steps

Below is a high-level summary of the steps taken so far to troubleshoot and fix the JWT authentication and database connection issues in our application.

---

## 1. Identified Authentication Errors

- Observed frequent `401 Unauthorized` responses in API logs.
- Error message: `JWT validation error: Signature verification failed`.
- Confirmed the token was being sent from the frontend’s `Authorization: Bearer <token>` header.
- Determined that Supabase’s session tokens are signed with the **Supabase JWT secret**, not the anon or service keys.

### Key Takeaways
- We must use the **actual JWT secret** (found in Supabase project settings) to validate Supabase-generated session tokens.
- The Supabase `anon` and `service` keys are **not** the same as the JWT signing secret.

---

## 2. Updated JWT Validation Logic

1. **Initial Approach**  
   - Tried using `settings.SECRET_KEY` from `.env` and realized it was not the correct key if it didn’t match Supabase’s JWT secret.  
   - Attempted using `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY`, which are also **not** the JWT signing key.

2. **Correct Approach**  
   - From Supabase’s Project Settings → **API** → **JWT Settings**, copied the actual **JWT secret**.  
   - Placed it in `.env` (e.g., `SUPABASE_JWT_SECRET=<your_actual_jwt_secret>`).  
   - Updated `deps.py` or equivalent auth dependency to reference `settings.SUPABASE_JWT_SECRET` instead of the other keys.  
   - Verified the signing algorithm matches (often `HS256` for Supabase).

### Key Takeaways
- Ensure that the environment variable actually matches the “JWT Secret” in Supabase’s dashboard.
- Confirm that the backend code references that exact variable for `jwt.decode(...)` or `JWTBearer(...)`.

---

## 3. Validated Frontend Tokens

- Realized the token being used for testing was **not** the user session token, but the **anon key** or some other incorrect token.
- Confirmed that the **actual** session token should come from `supabase.auth.getSession()` on the frontend.
- Verified the token structure:
  - Has `sub`, `role`, and a `user_metadata` object with user data.
  - Signed by Supabase with the **same** secret we configured on the backend.

### Key Takeaways
- The token in your network requests must be the **session access token**, not any other key.
- Logging out the token’s claims via `jwt.decode(token, ..., algorithms=["HS256"])` helps verify correctness.

---

## 4. Addressed Database Connection Errors

- Saw connection or SSL errors in logs:  
  - `nodename nor servname provided, or not known`  
  - `SSL: CERTIFICATE_VERIFY_FAILED`  
- Attempted fixes:
  1. Converted `postgres://` → `postgresql+asyncpg://` for SQLAlchemy.
  2. Ensured `ssl_context` with `CERT_REQUIRED` and `cafile=certifi.where()`.
  3. Tried removing/adding `sslmode` or `ssl_context` because asyncpg doesn’t always accept them in the same way.
  4. Verified the correct **Supabase “pooler”** host if using the Supabase pooling config.
  5. Ensured environment variables match the actual Supabase Postgres connection string.

### Key Takeaways
- For Supabase, ensure the correct host (e.g., `db.<project>.supabase.co` or the “pooler” domain).
- Use `postgresql+asyncpg://...` for Async SQLAlchemy.
- Don’t include unsupported `sslmode` or `ssl_context` arguments if the dialect doesn’t allow them.
- If SSL is required, set up the appropriate `ssl.create_default_context()` with certificates.

---

## 5. Current Status & Next Steps

- **JWT issue**:  
  - Confirmed we must use `SUPABASE_JWT_SECRET` from Supabase settings to validate session tokens.
  - Updated backend environment and code to use `settings.SUPABASE_JWT_SECRET`.
  - **Still** must confirm tokens being tested are actual session tokens from `supabase.auth.getSession()`.

- **Database SSL**:  
  - Verified most SSL errors revolve around the pooler host or incomplete SSL context usage.
  - If you see `Certificate verify failed`, consider using a recognized CA (`certifi`) or Supabase’s recommended `sslmode=require`.

### Recommended Final Checks

1. **Check `.env`**: Confirm `SUPABASE_JWT_SECRET` is exactly the same string from Supabase’s “JWT Secret” field.  
2. **Restart the server**: Make sure the new env variable is loaded.  
3. **Decode and Log** the front-end token in the backend route to ensure the claims match a real session token.  
4. **Test** with your actual logged-in user session token:
   - `curl -H "Authorization: Bearer <session_token>" ...`  
5. **Database**: If still failing SSL, confirm you’re using the correct “pooler” host from Supabase and have no invalid `sslmode` config.

By implementing these steps consistently and ensuring the correct JWT secret plus a valid token, the `Signature verification failed` error should be resolved, and your database connections should be stable over SSL.
