import { isIP } from 'node:net';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function normalizeCameraAddress(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const address = value.trim();
  if (!/^https?:\/\//i.test(address)) return address;

  try {
    const url = new URL(address);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) {
      return address;
    }

    return url.toString();
  } catch {
    return address;
  }
}

@ValidatorConstraint({ name: 'isCameraAddress', async: false })
export class IsCameraAddressConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (isIP(value)) return true;

    try {
      const url = new URL(value);
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an IP address or an HTTP(S) stream URL`;
  }
}

export function IsCameraAddress(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isCameraAddress',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: IsCameraAddressConstraint,
    });
  };
}
