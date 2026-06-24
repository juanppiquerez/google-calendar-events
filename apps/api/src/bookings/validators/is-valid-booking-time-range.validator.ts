import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CreateBookingDto } from '../dto/create-booking.dto';

/** Tolerance for network latency when rejecting past start times. */
export const PAST_START_TOLERANCE_MS = 5_000;

@ValidatorConstraint({ name: 'IsValidBookingTimeRange', async: false })
export class IsValidBookingTimeRange implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { startTime, endTime } = args.object as CreateBookingDto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    if (start >= end) {
      return false;
    }

    if (start.getTime() < Date.now() - PAST_START_TOLERANCE_MS) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const { startTime, endTime } = args.object as CreateBookingDto;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'startTime and endTime must be valid ISO 8601 dates';
    }

    if (start >= end) {
      return 'startTime must be before endTime';
    }

    return 'startTime cannot be in the past';
  }
}
