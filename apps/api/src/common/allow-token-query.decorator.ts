import { SetMetadata } from '@nestjs/common';

export const ALLOW_TOKEN_QUERY_KEY = 'allowTokenQuery';

/**
 * Allow the access JWT to be supplied via the `?token=` query parameter on
 * this route only. Needed for browser EventSource (SSE), which cannot set an
 * Authorization header. The token undergoes the exact same verification as a
 * Bearer header; a Bearer header still takes precedence when present.
 */
export const AllowTokenQuery = () => SetMetadata(ALLOW_TOKEN_QUERY_KEY, true);
