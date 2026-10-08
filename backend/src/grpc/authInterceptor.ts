import * as grpc from '@grpc/grpc-js';

export const FALLBACK_CLUSTER_SECRET = 'olive-cluster-internal-secret-2026';

export function getInternalRpcSecret(): string {
  return process.env.INTERNAL_RPC_SECRET || FALLBACK_CLUSTER_SECRET;
}

export function createAuthMetadata(secret?: string): grpc.Metadata {
  const metadata = new grpc.Metadata();
  metadata.add('x-internal-auth', secret || getInternalRpcSecret());
  return metadata;
}

export function verifyInternalAuth(metadata: grpc.Metadata): boolean {
  const expectedSecret = getInternalRpcSecret();
  const values = metadata.get('x-internal-auth');
  if (!values || values.length === 0) {
    return false;
  }
  const token = String(values[0]);
  return token === expectedSecret;
}

export type GrpcUnaryHandler<Req = any, Res = any> = (
  call: grpc.ServerUnaryCall<Req, Res>,
  callback: grpc.sendUnaryData<Res>
) => void | Promise<void>;

/**
 * Wraps gRPC service handlers with strict internal token verification.
 * Rejects with UNAUTHENTICATED if 'x-internal-auth' is missing or incorrect.
 */
export function withAuth<Req = any, Res = any>(handler: GrpcUnaryHandler<Req, Res>): GrpcUnaryHandler<Req, Res> {
  return async (call: grpc.ServerUnaryCall<Req, Res>, callback: grpc.sendUnaryData<Res>) => {
    if (!verifyInternalAuth(call.metadata)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        name: 'Unauthenticated',
        message: 'Missing or invalid internal authorization token (x-internal-auth mismatch)',
      });
    }

    try {
      await handler(call, callback);
    } catch (err: any) {
      console.error('[gRPC Handler Exception]:', err?.message || err);
      return callback({
        code: grpc.status.INTERNAL,
        name: 'InternalError',
        message: err?.message || 'Internal gRPC execution error',
      });
    }
  };
}
