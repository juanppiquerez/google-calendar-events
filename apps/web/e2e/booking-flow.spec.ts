import { test, expect } from '@playwright/test';
import type { Booking, AvailabilityResponse } from '@booking/shared-types';
import { BookingStatus } from '@booking/shared-types';

function tomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function emptyAvailability(date: string): AvailabilityResponse {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  return {
    date,
    timeZone: 'UTC',
    dayStart,
    dayEnd,
    occupiedSlots: [],
    googleCalendarConnected: false,
  };
}

test.describe('Booking flow (E2E)', () => {
  let bookings: Booking[] = [];

  test.beforeEach(async ({ page }) => {
    bookings = [];

    await page.route('**/api/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false, isValid: false, syncHealthy: false }),
      });
    });

    await page.route('**/api/bookings/availability**', async (route) => {
      const url = new URL(route.request().url());
      const date = url.searchParams.get('date') ?? tomorrowDateString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyAvailability(date)),
      });
    });

    await page.route('**/api/bookings', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(bookings),
        });
        return;
      }

      if (method === 'POST') {
        const body = route.request().postDataJSON() as {
          title: string;
          startTime: string;
          endTime: string;
        };
        const now = new Date().toISOString();
        const booking: Booking = {
          id: crypto.randomUUID(),
          userId: 'e2e-user-id',
          title: body.title,
          startTime: body.startTime,
          endTime: body.endTime,
          status: BookingStatus.CONFIRMED,
          createdAt: now,
          updatedAt: now,
        };
        bookings.push(booking);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(booking),
        });
      }
    });

    await page.route('**/api/bookings/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }

      const id = route.request().url().split('/').pop()!;
      const index = bookings.findIndex((b) => b.id === id);
      if (index === -1) {
        await route.fulfill({ status: 404, body: JSON.stringify({ message: 'Not found' }) });
        return;
      }

      bookings[index] = {
        ...bookings[index],
        status: BookingStatus.CANCELLED,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Booking cancelled successfully',
          booking: bookings[index],
        }),
      });
    });
  });

  test('login → dashboard → create booking → list → cancel', async ({ page }) => {
    const bookingTitle = `E2E reunion ${Date.now()}`;
    const date = tomorrowDateString();

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Booking System' })).toBeVisible();
    await expect(page.getByText('E2E Test User')).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.getByRole('link', { name: 'New booking' }).click();
    await expect(page.getByRole('heading', { name: 'New booking' })).toBeVisible();

    await page.getByLabel('Title').fill(bookingTitle);
    await page.locator('#date').fill(date);
    await page.getByLabel('Start time').fill('10:00');
    await page.getByLabel('End time').fill('11:00');
    await page.getByRole('button', { name: 'Create booking' }).click();

    await expect(page.getByText('Booking created successfully')).toBeVisible();

    await page.getByRole('link', { name: 'My bookings' }).click();
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
    await expect(page.getByText(bookingTitle)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();

    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page.getByText('Status: Cancelled')).toBeVisible();
  });
});
