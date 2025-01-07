import { NextResponse } from 'next/server';

// In-memory store for rate limiting
const rateLimitStore = {};

// Admin key for bypassing rate limits (optional)
const ADMIN_KEY = process.env.ADMIN_KEY || 'secret-admin-key';

// Whitelisted IPs (optional)
const WHITELISTED_IPS = ['127.0.0.1', '192.168.1.1'];

/**
 * Check rate limit:
 * - Max 100 queries per IP
 * - At least 15 seconds between queries
 */
function checkRateLimit(ip) {
  if (WHITELISTED_IPS.includes(ip)) {
    return { allowed: true, reason: '' }; // Skip rate limit for whitelisted IPs
  }

  const now = Date.now();
  const userEntry = rateLimitStore[ip] || { count: 0, lastRequest: 0 };

  if (userEntry.count >= 100) {
    return {
      allowed: false,
      reason: 'You have reached the maximum of 100 queries for your IP address.',
    };
  }

  if (now - userEntry.lastRequest < 15 * 1000) {
    return {
      allowed: false,
      reason: 'Please wait at least 15 seconds before making another query.',
    };
  }

  return { allowed: true, reason: '' };
}

/**
 * Update rate limit for an IP
 */
function updateRateLimit(ip) {
  const now = Date.now();
  const userEntry = rateLimitStore[ip] || { count: 0, lastRequest: 0 };
  userEntry.count += 1;
  userEntry.lastRequest = now;
  rateLimitStore[ip] = userEntry;
}

/**
 * Fetch RDAP data with fallback (for domains only)
 */
async function fetchWithFallback(type, object) {
  const rdapUrl = `https://rdap.org/${type}/${object}`;
  const response = await fetch(rdapUrl);

  if (response.ok) {
    return await response.json();
  }

  if (type === 'domain') {
    const fallbackUrl = `https://rdap.iana.org/domain/${object}`;
    const fallbackResponse = await fetch(fallbackUrl);

    if (!fallbackResponse.ok) {
      throw new Error(
        `Primary and fallback requests failed. Fallback status: ${fallbackResponse.statusText}`
      );
    }

    return await fallbackResponse.json();
  }

  throw new Error(`Primary request failed: ${response.statusText}`);
}

export async function POST(request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'; // fallback for dev environments

    // Admin bypass
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey === ADMIN_KEY) {
      console.log(`Admin bypass granted for IP: ${ip}`);
    } else {
      // Rate limit check
      const rateCheck = checkRateLimit(ip);
      if (!rateCheck.allowed) {
        return NextResponse.json({ message: rateCheck.reason }, { status: 429 });
      }
    }

    const { type, object } = await request.json();
    if (!type || !object) {
      return NextResponse.json(
        { message: 'Please provide both "type" and "object".' },
        { status: 400 }
      );
    }

    // Fetch RDAP data with fallback
    const data = await fetchWithFallback(type, object);

    // Update rate limit for non-admin users
    if (adminKey !== ADMIN_KEY) {
      updateRateLimit(ip);
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error(`Error processing request: ${err.message}`);
    return NextResponse.json(
      { message: `An error occurred: ${err.message}` },
      { status: 500 }
    );
  }
}

