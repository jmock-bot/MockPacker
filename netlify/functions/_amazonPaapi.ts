/**
 * Amazon Product Advertising API 5.0 — SearchItems.
 *
 * Unlike the Google Shopping proxies this is not a bearer-key API: every
 * request is signed with AWS Signature V4 using the Associates access key /
 * secret, and results are tagged with the partner tag so referred sales earn
 * commission.
 *
 * Access requires an approved Amazon Associates account that has made 3
 * qualifying sales in the last 180 days — credentials do not exist before
 * that. See the README.
 */
import { createHash, createHmac } from 'node:crypto';
import {
  ProviderError,
  TIMEOUT_MS,
  asRows,
  dig,
  discountPercent,
  type ProductResult,
  type Row,
  type SearchContext,
} from './_searchCore';

export interface AmazonCredentials {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
}

interface Marketplace {
  host: string;
  region: string;
  /** The `Marketplace` request parameter, e.g. www.amazon.com. */
  site: string;
}

/**
 * PA-API host + signing region per marketplace. Selected from SEARCH_COUNTRY;
 * the partner tag must belong to the same marketplace (tags are per-locale).
 */
const MARKETPLACES: Record<string, Marketplace> = {
  us: { host: 'webservices.amazon.com', region: 'us-east-1', site: 'www.amazon.com' },
  ca: { host: 'webservices.amazon.ca', region: 'us-east-1', site: 'www.amazon.ca' },
  mx: { host: 'webservices.amazon.com.mx', region: 'us-east-1', site: 'www.amazon.com.mx' },
  br: { host: 'webservices.amazon.com.br', region: 'us-east-1', site: 'www.amazon.com.br' },
  uk: { host: 'webservices.amazon.co.uk', region: 'eu-west-1', site: 'www.amazon.co.uk' },
  gb: { host: 'webservices.amazon.co.uk', region: 'eu-west-1', site: 'www.amazon.co.uk' },
  de: { host: 'webservices.amazon.de', region: 'eu-west-1', site: 'www.amazon.de' },
  fr: { host: 'webservices.amazon.fr', region: 'eu-west-1', site: 'www.amazon.fr' },
  it: { host: 'webservices.amazon.it', region: 'eu-west-1', site: 'www.amazon.it' },
  es: { host: 'webservices.amazon.es', region: 'eu-west-1', site: 'www.amazon.es' },
  nl: { host: 'webservices.amazon.nl', region: 'eu-west-1', site: 'www.amazon.nl' },
  se: { host: 'webservices.amazon.se', region: 'eu-west-1', site: 'www.amazon.se' },
  pl: { host: 'webservices.amazon.pl', region: 'eu-west-1', site: 'www.amazon.pl' },
  be: { host: 'webservices.amazon.com.be', region: 'eu-west-1', site: 'www.amazon.com.be' },
  tr: { host: 'webservices.amazon.com.tr', region: 'eu-west-1', site: 'www.amazon.com.tr' },
  ae: { host: 'webservices.amazon.ae', region: 'eu-west-1', site: 'www.amazon.ae' },
  sa: { host: 'webservices.amazon.sa', region: 'eu-west-1', site: 'www.amazon.sa' },
  eg: { host: 'webservices.amazon.eg', region: 'eu-west-1', site: 'www.amazon.eg' },
  in: { host: 'webservices.amazon.in', region: 'eu-west-1', site: 'www.amazon.in' },
  jp: { host: 'webservices.amazon.co.jp', region: 'us-west-2', site: 'www.amazon.co.jp' },
  au: { host: 'webservices.amazon.com.au', region: 'us-west-2', site: 'www.amazon.com.au' },
  sg: { host: 'webservices.amazon.sg', region: 'us-west-2', site: 'www.amazon.sg' },
};

const PATH = '/paapi5/searchitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
const SERVICE = 'ProductAdvertisingAPI';

/**
 * Resources to request. Deliberately excludes CustomerReviews.StarRating /
 * .Count — PA-API 5.0 restricts review content, and asking for it returns
 * AccessDenied for ordinary Associates accounts. Amazon results therefore
 * carry no rating, which the UI already renders as absent.
 */
const RESOURCES = [
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'Images.Primary.Medium',
  'Offers.Listings.Price',
  'Offers.Listings.SavingBasis',
  'Offers.Listings.Availability.Message',
  'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
  'Offers.Listings.DeliveryInfo.IsPrimeEligible',
];

/* ── AWS Signature V4 ──────────────────────────────────────────────────── */

const sha256 = (data: string): string => createHash('sha256').update(data, 'utf8').digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

function signedHeaders(
  { accessKey, secretKey }: AmazonCredentials,
  market: Marketplace,
  payload: string,
  now: Date
): Record<string, string> {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: market.host,
    'x-amz-date': amzDate,
    'x-amz-target': TARGET,
  };

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const signedHeaderList = names.join(';');

  const canonicalRequest = [
    'POST',
    PATH,
    '',
    canonicalHeaders,
    signedHeaderList,
    sha256(payload),
  ].join('\n');

  const scope = `${dateStamp}/${market.region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), market.region), SERVICE),
    'aws4_request'
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaderList}, Signature=${signature}`;
  return headers;
}

/* ── Response mapping ──────────────────────────────────────────────────── */

/** PA-API returns availability as prose; map the phrasings we can trust. */
function stockFrom(message: string | null): boolean | null {
  if (!message) return null;
  const m = message.toLowerCase();
  if (m.includes('out of stock') || m.includes('unavailable')) return false;
  if (m.includes('in stock')) return true;
  return null;
}

function deliveryFrom(listing: unknown): { estimate: string | null; shipping: number | null } {
  const free = dig(listing, 'DeliveryInfo', 'IsFreeShippingEligible') === true;
  const prime = dig(listing, 'DeliveryInfo', 'IsPrimeEligible') === true;
  const parts = [free ? 'Free shipping' : null, prime ? 'Prime' : null].filter(Boolean);
  return { estimate: parts.length ? parts.join(' · ') : null, shipping: free ? 0 : null };
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const amount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function mapItem(item: Row, index: number, checkedAt: string): ProductResult {
  const listing = dig(item, 'Offers', 'Listings', 0);
  const price = amount(dig(listing, 'Price', 'Amount'));
  // SavingBasis is the "was" price — the list price a discount is measured from.
  const original = amount(dig(listing, 'SavingBasis', 'Amount'));
  const { estimate, shipping } = deliveryFrom(listing);
  return {
    id: text(item.ASIN) ?? `amazon-${index}`,
    name: text(dig(item, 'ItemInfo', 'Title', 'DisplayValue')) ?? 'Unknown product',
    brand:
      text(dig(item, 'ItemInfo', 'ByLineInfo', 'Brand', 'DisplayValue')) ??
      text(dig(item, 'ItemInfo', 'ByLineInfo', 'Manufacturer', 'DisplayValue')),
    imageUrl: text(dig(item, 'Images', 'Primary', 'Medium', 'URL')),
    price,
    originalPrice: original,
    discountPercent: discountPercent(price, original),
    store: 'Amazon',
    shippingCost: shipping,
    deliveryEstimate: estimate,
    inStock: stockFrom(text(dig(listing, 'Availability', 'Message'))),
    // Review content is not licensed through PA-API 5.0 — see RESOURCES.
    rating: null,
    reviewCount: null,
    // DetailPageURL already carries the partner tag; never rewrite or strip it.
    url: text(item.DetailPageURL),
    checkedAt,
  };
}

/** Turns PA-API's error envelope into a message worth showing. */
function describeError(body: Row, status: number): ProviderError {
  const errors = asRows(body.Errors);
  const code = errors.length ? text(errors[0].Code) ?? '' : '';
  switch (code) {
    case 'UnrecognizedClient':
    case 'InvalidSignature':
    case 'IncompleteSignature':
      return new ProviderError(502, 'Amazon rejected the API credentials. Check the server configuration.');
    case 'InvalidPartnerTag':
    case 'InvalidAssociate':
      return new ProviderError(
        502,
        'Amazon rejected the partner tag. It must belong to the same marketplace as SEARCH_COUNTRY.'
      );
    case 'TooManyRequests':
      return new ProviderError(429, 'Amazon is rate-limiting requests. Try again in a moment.');
    case 'AccessDenied':
    case 'AccessDeniedAwsUsers':
      return new ProviderError(
        502,
        'Amazon denied API access. Associates accounts need 3 qualifying sales before PA-API is enabled.'
      );
    default:
      if (status === 429) return new ProviderError(429, 'Amazon is rate-limiting requests. Try again in a moment.');
      return new ProviderError(502, 'Amazon’s product API had a problem. Try again shortly.');
  }
}

/* ── Entry point ───────────────────────────────────────────────────────── */

/** PA-API caps SearchItems at 10 items per page. */
const ITEM_COUNT = 10;

export async function searchAmazon(
  creds: AmazonCredentials,
  { query, filters, country }: SearchContext
): Promise<ProductResult[]> {
  const market = MARKETPLACES[country] ?? MARKETPLACES.us;

  const body: Row = {
    Keywords: query,
    SearchIndex: 'All',
    ItemCount: ITEM_COUNT,
    PartnerTag: creds.partnerTag,
    PartnerType: 'Associates',
    Marketplace: market.site,
    Resources: RESOURCES,
  };
  // PA-API takes price bounds in the currency's lowest unit (cents), unlike
  // Offers.Listings.Price.Amount, which comes back in major units.
  if (typeof filters.priceMin === 'number') body.MinPrice = Math.round(filters.priceMin * 100);
  if (typeof filters.priceMax === 'number') body.MaxPrice = Math.round(filters.priceMax * 100);

  const payload = JSON.stringify(body);
  const headers = signedHeaders(creds, market, payload, new Date());

  const res = await fetch(`https://${market.host}${PATH}`, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => ({}))) as Row;

  if (!res.ok) {
    // A keyword with no matches comes back as an error, not an empty list.
    const codes = asRows(data.Errors).map((e) => text(e.Code));
    if (codes.includes('NoResults')) return [];
    throw describeError(data, res.status);
  }

  const checkedAt = new Date().toISOString();
  return asRows(dig(data, 'SearchResult', 'Items')).map((item, i) => mapItem(item, i, checkedAt));
}

/**
 * Disclosures the Associates Operating Agreement requires alongside displayed
 * Amazon data: the affiliate identification statement, and a price accuracy
 * notice stamped with when the data was fetched.
 */
export function amazonDisclosures(now: Date): string[] {
  const stamp = `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  return [
    'As an Amazon Associate, MockPacker earns from qualifying purchases.',
    `Product prices and availability are accurate as of ${stamp} and are subject to change. ` +
      'Any price and availability information displayed on Amazon at the time of purchase will ' +
      'apply to the purchase of this product.',
  ];
}
