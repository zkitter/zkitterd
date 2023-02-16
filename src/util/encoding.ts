export const toBigInt = (value: string | number): BigInt => {
  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (/[a-z]/gi.test(value)) {
    if (value.slice(0, 2) === '0x') return BigInt(value);
    return BigInt('0x' + value);
  }

  return BigInt(value);
};
