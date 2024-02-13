import { c } from 'ttag';

import type { Api, MaybeNull } from '@proton/pass/types';
import { pullForkSession, setRefreshCookies as refreshTokens } from '@proton/shared/lib/api/auth';
import { getUser } from '@proton/shared/lib/api/user';
import { getAppHref } from '@proton/shared/lib/apps/helper';
import { getWelcomeToText } from '@proton/shared/lib/apps/text';
import type { FORK_TYPE } from '@proton/shared/lib/authentication/ForkInterface';
import { getKey } from '@proton/shared/lib/authentication/cryptoHelper';
import { InvalidForkConsumeError } from '@proton/shared/lib/authentication/error';
import type { PullForkResponse, RefreshSessionResponse } from '@proton/shared/lib/authentication/interface';
import { getForkDecryptedBlob } from '@proton/shared/lib/authentication/sessionForkBlob';
import { getValidatedForkType, getValidatedRawKey } from '@proton/shared/lib/authentication/sessionForkValidation';
import type { APP_NAMES } from '@proton/shared/lib/constants';
import { APPS, MAIL_APP_NAME, PASS_APP_NAME, SSO_PATHS } from '@proton/shared/lib/constants';
import { withAuthHeaders, withUIDHeaders } from '@proton/shared/lib/fetch/headers';
import { encodeBase64URL, uint8ArrayToString } from '@proton/shared/lib/helpers/encoding';
import type { User } from '@proton/shared/lib/interfaces';

import type { AuthSession } from './session';

export type RequestForkOptions = { app: APP_NAMES; host?: string; localID?: number; type?: FORK_TYPE };
export type RequestForkResult = { state: string; url: string };

export const requestFork = ({
    app,
    host = getAppHref('/', APPS.PROTONACCOUNT),
    localID,
    type,
}: RequestForkOptions): RequestForkResult => {
    const state = encodeBase64URL(uint8ArrayToString(crypto.getRandomValues(new Uint8Array(32))));

    const searchParams = new URLSearchParams();
    searchParams.append('app', app);
    searchParams.append('state', state);
    searchParams.append('independent', '0');

    if (localID !== undefined) searchParams.append('u', `${localID}`);
    if (type) searchParams.append('t', type);

    return { url: `${host}${SSO_PATHS.AUTHORIZE}?${searchParams.toString()}`, state };
};

export type ConsumeForkParameters = ReturnType<typeof getConsumeForkParameters>;
export type ConsumeForkPayload =
    | { mode: 'sso'; localState: MaybeNull<string>; state: string; selector: string; key?: Uint8Array; version: 1 | 2 }
    | { mode: 'secure'; state: string; selector: string; keyPassword: string };

export type ConsumeForkOptions = { api: Api; apiUrl?: string; payload: ConsumeForkPayload };

/**
 * If `keyPassword` is not provided to `ConsumeForkOptions`, it will attempt to recover it from
 * the `Payload` property of the `PullForkResponse`. `keyPassword` will always be omitted when
 * retrieving the fork options from the url parameters. This is not the case when using secure
 * extension messaging where `keyPassword` can safely be passed.
 * ⚠️ Only validates the fork state in SSO mode.
 */
export const consumeFork = async (options: ConsumeForkOptions): Promise<AuthSession> => {
    const { payload, apiUrl, api } = options;

    const validFork =
        (payload.mode === 'secure' || (payload.localState !== null && payload.key)) &&
        payload.selector &&
        payload.state;

    if (!validFork) throw new InvalidForkConsumeError(`Invalid fork state`);

    const pullForkParams = pullForkSession(payload.selector);
    pullForkParams.url = apiUrl ? `${apiUrl}/${pullForkParams.url}` : pullForkParams.url;

    const { UID, RefreshToken, LocalID, Payload } = await api<PullForkResponse>(pullForkParams);
    const refresh = await api<RefreshSessionResponse>(withUIDHeaders(UID, refreshTokens({ RefreshToken })));
    const { User } = await api<{ User: User }>(withAuthHeaders(UID, refresh.AccessToken, getUser()));

    const keyPassword =
        payload.mode === 'secure'
            ? payload.keyPassword
            : await (async () => {
                  try {
                      const key = await getKey(payload.key!);
                      return (await getForkDecryptedBlob(key, Payload, payload.version))?.keyPassword ?? '';
                  } catch (_) {
                      throw new InvalidForkConsumeError('Failed to decrypt fork payload');
                  }
              })();

    return {
        AccessToken: refresh.AccessToken,
        keyPassword,
        LocalID,
        RefreshToken: refresh.RefreshToken,
        UID,
        UserID: User.ID,
    };
};

export enum AccountForkResponse {
    CONFLICT,
    SUCCESS,
    ERROR,
}

export const getAccountForkResponsePayload = (type: AccountForkResponse, error?: any) => {
    const additionalMessage = error?.message ?? '';

    const payload = (() => {
        switch (type) {
            case AccountForkResponse.CONFLICT: {
                return {
                    title: c('Error').t`Authentication error`,
                    message: c('Info')
                        .t`It seems you are already logged in to ${PASS_APP_NAME}. If you're trying to login with a different account, please logout from the extension first.`,
                };
            }
            case AccountForkResponse.SUCCESS: {
                return {
                    title: getWelcomeToText(PASS_APP_NAME),
                    message: c('Info')
                        .t`More than a password manager, ${PASS_APP_NAME} protects your password and your personal email address via email aliases. Powered by the same technology behind ${MAIL_APP_NAME}, your data is end to end encrypted and is only accessible by you.`,
                };
            }
            case AccountForkResponse.ERROR: {
                return {
                    title: c('Error').t`Something went wrong`,
                    message: c('Warning').t`Unable to sign in to ${PASS_APP_NAME}. ${additionalMessage}`,
                };
            }
        }
    })();

    return { payload };
};

export const getConsumeForkParameters = () => {
    const sliceIndex = window.location.hash.lastIndexOf('#') + 1;
    const hashParams = new URLSearchParams(window.location.hash.slice(sliceIndex));
    const selector = hashParams.get('selector') || '';
    const state = hashParams.get('state') || '';
    const base64StringKey = hashParams.get('sk') || '';
    const type = hashParams.get('t') || '';
    const persistent = hashParams.get('p') || '';
    const trusted = hashParams.get('tr') || '';
    const version = hashParams.get('v') || '';

    return {
        state: state.slice(0, 100),
        selector,
        key: base64StringKey.length ? getValidatedRawKey(base64StringKey) : undefined,
        type: getValidatedForkType(type),
        persistent: persistent === '1',
        trusted: trusted === '1',
        version: version === '2' ? 2 : 1,
    } as const;
};
