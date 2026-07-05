/**
 * Gerador de PIX "copia e cola" (BR Code / padrão EMV do Banco Central).
 * Produz um payload estático válido para ser lido por qualquer app de banco.
 */

const emv = (id: string, value: string) => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

/** CRC16-CCITT (polinômio 0x1021, init 0xFFFF) exigido pelo padrão PIX. */
const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const sanitize = (text: string, max: number) =>
  text
    .normalize('NFD') // decompõe acentos (ç -> c + ̧)
    .replace(/[^A-Za-z0-9 ]/g, '') // mantém só ASCII; remove marcas de acento
    .toUpperCase()
    .slice(0, max);

export interface PixParams {
  key: string;
  keyType?: 'CPF/CNPJ' | 'E-mail' | 'Telefone' | 'Aleatória';
  name: string;
  city: string;
  amount?: number;
  txid?: string;
}

/** Chave telefone no BR Code precisa do formato +55DDDNÚMERO. */
const normalizeKey = (key: string, keyType?: string) => {
  if (keyType === 'Telefone') {
    const digits = key.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
    return '+55' + digits;
  }
  return key.trim();
};

/** Formata a chave para exibição amigável (ex.: (27) 99935-9431). */
export const formatPixKeyDisplay = (key: string, keyType?: string) => {
  if (keyType === 'Telefone') {
    const d = key.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return key;
};

/** Monta a string PIX copia-e-cola (BR Code estático). */
export const buildPixBRCode = ({ key, keyType, name, city, amount, txid }: PixParams): string => {
  const gui = emv('00', 'br.gov.bcb.pix');
  const keyField = emv('01', normalizeKey(key, keyType));
  const merchantAccount = emv('26', gui + keyField);

  const fields = [
    emv('00', '01'), // Payload Format Indicator
    merchantAccount,
    emv('52', '0000'), // Merchant Category Code
    emv('53', '986'), // Moeda BRL
    amount && amount > 0 ? emv('54', amount.toFixed(2)) : '',
    emv('58', 'BR'), // País
    emv('59', sanitize(name, 25) || 'RECEBEDOR'),
    emv('60', sanitize(city, 15) || 'BRASIL'),
    emv('62', emv('05', sanitize(txid || '***', 25) || '***')), // Additional data (txid)
  ].join('');

  const partial = fields + '6304';
  return partial + crc16(partial);
};

/** URL de imagem do QR Code a partir de qualquer texto (sem backend). */
export const qrImageUrl = (text: string, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
