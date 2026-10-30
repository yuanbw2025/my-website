declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

declare module 'npm:aws4fetch@1.0.20' {
  export { AwsClient } from 'aws4fetch'
}
