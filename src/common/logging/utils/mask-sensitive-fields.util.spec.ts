import { maskSensitiveFields } from './mask-sensitive-fields.util';

describe('maskSensitiveFields', () => {
  it('masks sensitive fields recursively', () => {
    expect(
      maskSensitiveFields({
        authorization: 'Bearer token',
        nested: {
          password: 'secret-password',
          profile: {
            email: 'minsoo@example.com',
          },
        },
        items: [
          {
            apiKey: 'api-key',
            value: 'visible',
          },
        ],
      }),
    ).toEqual({
      authorization: '[masked]',
      nested: {
        password: '[masked]',
        profile: {
          email: 'minsoo@example.com',
        },
      },
      items: [
        {
          apiKey: '[masked]',
          value: 'visible',
        },
      ],
    });
  });

  it('normalizes header-style field names', () => {
    expect(
      maskSensitiveFields({
        'set-cookie': 'session=abc',
        access_token: 'access-token',
        refreshToken: 'refresh-token',
      }),
    ).toEqual({
      'set-cookie': '[masked]',
      access_token: '[masked]',
      refreshToken: '[masked]',
    });
  });
});
