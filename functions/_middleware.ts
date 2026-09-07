type PagesEnv = {
  FAMILY_AUTH_USERNAME?: string;
  FAMILY_AUTH_PASSWORD?: string;
};

type PagesContext = {
  request: Request;
  env: PagesEnv;
  next: () => Promise<Response>;
};

type AuthValidationResult = 'accepted' | 'rejected' | 'missing-config';

const authRealm = 'Family Logistics Assistant';

const unauthorizedResponse = () =>
  new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${authRealm}"`,
    },
  });

const missingConfigResponse = () =>
  new Response('Authentication is not configured.', {
    status: 503,
  });

const decodeBase64 = (value: string): string | null => {
  try {
    return atob(value);
  } catch {
    return null;
  }
};

const hasInvalidBase64Characters = (value: string): boolean =>
  !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1;

const parseBasicAuthorization = (
  authorizationHeader: string | null,
): { username: string; password: string } | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, encodedCredentials, extra] = authorizationHeader.trim().split(/\s+/);

  if (scheme !== 'Basic' || !encodedCredentials || extra) {
    return null;
  }

  if (hasInvalidBase64Characters(encodedCredentials)) {
    return null;
  }

  const decodedCredentials = decodeBase64(encodedCredentials);

  if (!decodedCredentials) {
    return null;
  }

  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
};

export const validateBasicAuth = (
  authorizationHeader: string | null,
  env: PagesEnv,
): AuthValidationResult => {
  if (!env.FAMILY_AUTH_USERNAME || !env.FAMILY_AUTH_PASSWORD) {
    return 'missing-config';
  }

  const credentials = parseBasicAuthorization(authorizationHeader);

  if (!credentials) {
    return 'rejected';
  }

  if (
    credentials.username !== env.FAMILY_AUTH_USERNAME ||
    credentials.password !== env.FAMILY_AUTH_PASSWORD
  ) {
    return 'rejected';
  }

  return 'accepted';
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const authResult = validateBasicAuth(context.request.headers.get('Authorization'), context.env);

  if (authResult === 'missing-config') {
    return missingConfigResponse();
  }

  if (authResult === 'rejected') {
    return unauthorizedResponse();
  }

  return context.next();
};
