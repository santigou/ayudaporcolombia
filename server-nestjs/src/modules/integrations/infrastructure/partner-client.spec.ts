import { SecretsService } from './secrets.service';
import { PartnerClient, extractJsonPath } from './partner-client';

const config: any = { get: () => undefined }; // defaults: timeout 10000
const secrets = new SecretsService({ get: () => 'test-encryption-key' } as any);

function partnerFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'partner-1',
    slug: 'app-b',
    authType: 'api_key',
    outboundUrl: 'https://partner.example.com/webhook',
    outboundHeaderName: null,
    outboundApiKeyValueEnc: secrets.encrypt('partner-secret-key'),
    loginUrl: null,
    loginEmailEnc: null,
    loginPasswordEnc: null,
    tokenJsonPath: null,
    tokenHeader: null,
    ...overrides,
  } as any;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as any;
}

describe('extractJsonPath', () => {
  it('extrae valores anidados y tolera nulls', () => {
    expect(extractJsonPath({ data: { token: 'abc' } }, 'data.token')).toBe('abc');
    expect(extractJsonPath({ data: null }, 'data.token')).toBeUndefined();
    expect(extractJsonPath(null, 'token')).toBeUndefined();
    expect(extractJsonPath({ id: 42 }, 'id')).toBe(42);
  });
});

describe('PartnerClient', () => {
  let client: PartnerClient;

  beforeEach(() => {
    client = new PartnerClient(secrets, config);
    (global as any).fetch = jest.fn();
  });

  it('modo api_key: envía la clave descifrada en el header configurado', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { ok: true }));
    const res = await client.deliver(partnerFixture(), { event: 'point_created' });
    expect(res.httpStatus).toBe(200);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-Key']).toBe('partner-secret-key');
  });

  it('respeta el header personalizado del partner', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, {}));
    await client.deliver(partnerFixture({ outboundHeaderName: 'X-Token' }), {});
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['X-Token']).toBe('partner-secret-key');
  });

  it('captura el externalId si el partner responde { id }', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(201, { id: 'their-id-9' }));
    const res = await client.deliver(partnerFixture(), {});
    expect(res.externalId).toBe('their-id-9');
  });

  it('falla con HTTP de error (sin reintento en api_key)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    await expect(client.deliver(partnerFixture(), {})).rejects.toThrow('HTTP 500');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });

  it('modo login: login → Bearer → si 401 re-loguea y reintenta una vez', async () => {
    const loginPartner = partnerFixture({
      authType: 'login',
      outboundApiKeyValueEnc: null,
      loginUrl: 'https://partner.example.com/login',
      loginEmailEnc: secrets.encrypt('user@partner.com'),
      loginPasswordEnc: secrets.encrypt('pass1234'),
      tokenJsonPath: 'data.token',
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'tok-1' } })) // login 1
      .mockResolvedValueOnce(jsonResponse(401, {})) // webhook con token vencido
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'tok-2' } })) // re-login
      .mockResolvedValueOnce(jsonResponse(200, { id: 'ok' })); // retry webhook

    const res = await client.deliver(loginPartner, { event: 'point_created' });
    expect(res.httpStatus).toBe(200);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(4);

    const webhookInit1 = (global.fetch as jest.Mock).mock.calls[1][1];
    expect(webhookInit1.headers['Authorization']).toBe('Bearer tok-1');
    const loginBody2 = JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body);
    expect(loginBody2).toEqual({ email: 'user@partner.com', password: 'pass1234' });
    const webhookInit2 = (global.fetch as jest.Mock).mock.calls[3][1];
    expect(webhookInit2.headers['Authorization']).toBe('Bearer tok-2');
  });

  it('falla si el login no devuelve token en el path configurado', async () => {
    const loginPartner = partnerFixture({
      authType: 'login',
      outboundApiKeyValueEnc: null,
      loginUrl: 'https://partner.example.com/login',
      loginEmailEnc: secrets.encrypt('a@b.c'),
      loginPasswordEnc: secrets.encrypt('pass'),
      tokenJsonPath: 'data.token',
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { otro: 'x' }));
    await expect(client.deliver(loginPartner, {})).rejects.toThrow('no se encontró token');
  });

  it('falla si el partner api_key no tiene credencial configurada', async () => {
    await expect(
      client.deliver(partnerFixture({ outboundApiKeyValueEnc: null }), {}),
    ).rejects.toThrow('no tiene API key outbound');
  });
});