import { v4, v6 } from 'ip-regex';

export function isIP(input: string): number {
  var result = 0;
  if (v4({ exact: true }).test(input)) {
    result = 4;
  } else if (v6({ exact: true }).test(input)) {
    result = 6;
  }
  return result;
};

export function isIPv4(input: string): boolean {
  return isIP(input) === 4;
};

export function isIPv6(input: string): boolean {
  return isIP(input) === 6;
};