import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
} from 'class-validator';
import { IsValidBookingTimeRange } from '../validators/is-valid-booking-time-range.validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsISO8601({ strict: true })
  startTime!: string;

  @IsISO8601({ strict: true })
  @Validate(IsValidBookingTimeRange)
  endTime!: string;
}
