export const toBigInt = (value: string | number): BigInt => {
  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (typeof value === 'string') {
    if (value.slice(0, 2) === '0x') {
      return BigInt(value);
    } else if (/^\d+$/.test(value)) {
      return BigInt(value);
    } else if (/^[0-9a-fA-F]+$/.test(value)) {
      return BigInt('0x' + value);
    }
  }

  return BigInt(value);
};

export const hexify = (data: string | bigint, targetLength?: number): string => {
  let hash = '';

  if (typeof data === 'bigint') {
    hash = data.toString(16);
  }

  if (typeof data === 'string') {
    if (data.slice(0, 2) === '0x') {
      hash = data.slice(2);
    } else if (/^\d+$/.test(data)) {
      hash = BigInt(data).toString(16);
    } else if (/^[0-9a-fA-F]+$/.test(data)) {
      hash = data;
    }
  }

  if (targetLength) hash = hash.padStart(targetLength, '0');

  return '0x' + hash;
};
