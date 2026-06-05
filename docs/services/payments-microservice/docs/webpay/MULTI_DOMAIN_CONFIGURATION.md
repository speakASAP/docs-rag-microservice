# WebPay Multi-Domain Configuration Guide

## Current Setup

### Merchant Account

- **Merchant ID**: `WEBPAY_MERCHANT_ID` (configured via environment variable)
- **Connected Domain**: `speakasap.com` (initially configured)
- **Production URL**: `https://3dsecure.gpwebpay.com/pgw/order.do`

> **Note**: The actual merchant ID is stored in `.env` file and should not be committed to version control.

### How WebPay Works

1. **Payment Request**: When creating a payment, we send a `URL` parameter to WebPay containing the return/callback URL
2. **Payment Processing**: User completes payment on WebPay gateway
3. **Return Redirect**: WebPay redirects user back to the `URL` we specified
4. **Callback**: WebPay also sends a POST callback to the same `URL` with payment status

### Current Implementation

**In payments-microservice:**

- The `URL` parameter is dynamically set from `request.callbackUrl` in each payment request
- The URL is included in the signature calculation (prevents tampering)
- No hardcoded domain restrictions in the code

**In speakasap-portal:**

- Callback URL is generated using `reverse('payment_webhook', host='www')`
- This generates URLs based on the current domain (speakasap.com, alfares.cz, flipflop.cz, etc.)

## Multi-Domain Support

### Can We Use Multiple Domains?

**YES, but with important considerations:**

1. **URL Parameter is Dynamic**: The code already supports dynamic callback URLs
2. **Signature Validation**: WebPay validates the signature, which includes the URL - this prevents URL tampering
3. **Domain Whitelisting**: WebPay may require return URLs to be whitelisted in the merchant portal

### What Needs to Be Done

#### Option 1: Self-Configuration (Recommended First Step)

1. **Check WebPay Merchant Portal**:
   - Log into the WebPay merchant portal (<https://portal.gpwebpay.com> or similar)
   - Navigate to merchant settings/configuration
   - Look for "Return URLs", "Callback URLs", or "Allowed Domains" settings
   - Add all domains that need to accept payments:
     - `https://speakasap.com/api/payments/webhook`
     - `https://www.speakasap.com/api/payments/webhook`
     - `https://alfares.cz/api/payments/webhook`
     - `https://www.alfares.cz/api/payments/webhook`
     - `https://flipflop.cz/api/payments/webhook`
     - `https://www.flipflop.cz/api/payments/webhook`
     - Any other domains you use

2. **Test Each Domain**:
   - Create test payments from each domain
   - Verify callbacks are received correctly
   - Check that signatures validate properly

#### Option 2: Contact WebPay Support (If Portal Doesn't Allow Self-Configuration)

If the merchant portal doesn't allow adding multiple return URLs, you need to:

1. **Contact WebPay Support**:
   - Email: <support@gpwebpay.com> (or check your merchant portal for support contact)
   - Request: "Add multiple return URLs for merchant account [YOUR_MERCHANT_ID]"
   - Provide list of all domains that need to accept payments

2. **Information to Provide**:

   ```text
   Merchant ID: [YOUR_MERCHANT_ID] (found in .env as WEBPAY_MERCHANT_ID)
   Request: Configure multiple return URLs for multi-domain support
   
   Domains to whitelist:
   - https://speakasap.com/api/payments/webhook
   - https://www.speakasap.com/api/payments/webhook
   - https://alfares.cz/api/payments/webhook
   - https://www.alfares.cz/api/payments/webhook
   - https://flipflop.cz/api/payments/webhook
   - https://www.flipflop.cz/api/payments/webhook
   - [add any other domains]
   ```

3. **Alternative: Wildcard Pattern** (if supported):
   - Some payment gateways support wildcard patterns like `https://*.speakasap.com/*`
   - Ask WebPay if they support this

### Technical Implementation

The current code already supports multiple domains - no code changes needed:

1. **speakasap-portal** generates callback URLs based on the current domain
2. **payments-microservice** accepts any callback URL in the request
3. **WebPay** receives the URL and redirects back to it

The only potential issue is if WebPay validates/whitelists return URLs on their side.

### Testing Checklist

After configuration:

- [ ] Test payment from speakasap.com
- [ ] Test payment from alfares.cz
- [ ] Test payment from flipflop.cz
- [ ] Verify callback is received correctly for each domain
- [ ] Verify signature validation works for each domain
- [ ] Check WebPay merchant portal logs for any rejected URLs

### Important Notes

1. **Single Merchant Account**: You can use one merchant account (configured via `WEBPAY_MERCHANT_ID` environment variable) for all domains - no need for separate accounts
2. **URL Signature**: The URL is part of the signature, so it cannot be tampered with
3. **HTTPS Required**: All callback URLs must use HTTPS in production
4. **Exact Match**: WebPay may require exact URL matches (including trailing slashes) - test carefully

### Documentation References

- `GP_webpay_HTTP_API.pdf` - HTTP API documentation
- `GP_webpay_portal_user_guide.pdf` - Merchant portal user guide
- `GP_webpay_Service_description.pdf` - Service description

Check these PDFs for:

- Return URL configuration options
- Multi-domain support documentation
- Merchant portal settings

## Recommendation

1. **First**: Try to configure return URLs yourself in the WebPay merchant portal
2. **If not possible**: Contact WebPay support with the information above
3. **Test thoroughly**: After configuration, test payments from each domain

The code is already ready for multi-domain support - it's just a matter of WebPay configuration.
