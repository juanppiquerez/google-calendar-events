-- CreateTable: idempotency keys for POST /bookings
CREATE TABLE "BookingIdempotency" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingIdempotency_userId_idempotencyKey_key" ON "BookingIdempotency"("userId", "idempotencyKey");
CREATE INDEX "BookingIdempotency_createdAt_idx" ON "BookingIdempotency"("createdAt");

ALTER TABLE "BookingIdempotency" ADD CONSTRAINT "BookingIdempotency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- btree_gist is required for EXCLUDE constraints that combine equality (=) with range overlap (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion constraint: prevents two CONFIRMED bookings for the same user from overlapping.
--
-- Why this exists (defense in depth against race conditions):
-- The application checks for conflicts before INSERT, but two concurrent requests can both
-- pass that check and attempt to insert overlapping rows. Only a database-level constraint
-- can guarantee mutual exclusion under concurrency. PostgreSQL EXCLUDE USING gist enforces
-- that no two rows with status = 'CONFIRMED' share the same userId and overlapping time range.
--
-- Bounds '[)' (start inclusive, end exclusive) match application overlap logic: adjacent
-- bookings that touch at a boundary (end == start) do not conflict.
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_no_overlap_confirmed"
EXCLUDE USING gist (
  "userId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE (status = 'CONFIRMED');
