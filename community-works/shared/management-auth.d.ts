export function isManagementAuthorization(value: string | null): boolean
export function managementIdentity(authorization: string | null, verifier: string | undefined,
  backendOrigin: string, fetcher?: typeof fetch): Promise<string | null>
