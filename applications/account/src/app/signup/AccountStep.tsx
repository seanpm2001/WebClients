import { Fragment, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';

import { c } from 'ttag';

import { Button, Href } from '@proton/atoms';
import {
    Challenge,
    ChallengeError,
    ChallengeRef,
    ChallengeResult,
    DropdownSizeUnit,
    Info,
    InlineLinkButton,
    InputFieldTwo,
    Option,
    PasswordInputTwo,
    SelectTwo,
    useConfig,
    useFormErrors,
    useLoading,
} from '@proton/components';
import metrics from '@proton/metrics';
import { getIsVPNApp } from '@proton/shared/lib/authentication/apps';
import {
    APPS,
    APP_NAMES,
    BRAND_NAME,
    CALENDAR_APP_NAME,
    CLIENT_TYPES,
    MAIL_APP_NAME,
    SSO_PATHS,
} from '@proton/shared/lib/constants';
import {
    confirmPasswordValidator,
    emailValidator,
    getMinPasswordLengthMessage,
    passwordLengthValidator,
    requiredValidator,
    usernameCharacterValidator,
    usernameLengthValidator,
} from '@proton/shared/lib/helpers/formValidators';
import { getTermsURL } from '@proton/shared/lib/helpers/url';
import clsx from '@proton/utils/clsx';
import noop from '@proton/utils/noop';

import Content from '../public/Content';
import Header from '../public/Header';
import Main from '../public/Main';
import Loader from './Loader';
import { getSignupApplication } from './helper';
import { SignupType } from './interfaces';

import './AccountStep.scss';

interface Props {
    clientType: CLIENT_TYPES;
    onBack?: () => void;
    defaultUsername?: string;
    defaultEmail?: string;
    toApp: APP_NAMES | undefined;
    signupTypes: SignupType[];
    signupType: SignupType;
    onChangeSignupType: (signupType: SignupType) => void;
    defaultRecoveryEmail?: string;
    domains: string[];
    hasChallenge?: boolean;
    title: string;
    subTitle: string;
    onSubmit: (form: {
        username: string;
        email: string;
        password: string;
        signupType: SignupType;
        domain: string;
        payload: ChallengeResult;
    }) => Promise<void>;
    loading?: boolean;
}

const AccountStep = ({
    clientType,
    toApp,
    onBack,
    title,
    subTitle,
    defaultUsername,
    defaultEmail,
    signupTypes,
    signupType,
    onChangeSignupType,
    onSubmit,
    hasChallenge = true,
    domains,
    loading: loadingDependencies,
}: Props) => {
    const { APP_NAME } = useConfig();
    const challengeRefLogin = useRef<ChallengeRef>();
    const anchorRef = useRef<HTMLButtonElement | null>(null);
    const [loading, withLoading] = useLoading();
    const [, setRerender] = useState<any>();
    const [challengeLoading, setChallengeLoading] = useState(hasChallenge);
    const [challengeError, setChallengeError] = useState(false);
    const [username, setUsername] = useState(defaultUsername || '');
    const [email, setEmail] = useState(defaultEmail || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [maybeDomain, setDomain] = useState(domains?.[0] || ''); // This is set while domains are loading
    const [passwordInputFocused, setPasswordInputFocused] = useState(false);

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    const domainOptions = domains.map((DomainName) => ({ text: DomainName, value: DomainName }));

    const isLoadingView = challengeLoading || loadingDependencies;

    const { validator, onFormSubmit } = useFormErrors();

    const domain = maybeDomain || domains?.[0];

    const run = async () => {
        const payload = await challengeRefLogin.current?.getChallenge();
        return onSubmit({
            username: trimmedUsername,
            password,
            signupType,
            domain,
            email: trimmedEmail,
            payload,
        });
    };

    const handleSubmit = () => {
        if (loading || !onFormSubmit()) {
            return;
        }
        withLoading(run()).catch(noop);
    };

    useEffect(() => {
        if (isLoadingView) {
            return;
        }
        // Special focus management for challenge
        setTimeout(() => {
            challengeRefLogin.current?.focus('#email');
        }, 0);
    }, [signupType, isLoadingView]);

    /**
     * Signup page load count metric
     */
    useEffect(() => {
        if (isLoadingView) {
            return;
        }

        void metrics.core_signup_pageLoad_total.increment({
            step: signupType === SignupType.Email ? 'external_account_creation' : 'proton_account_creation',
            application: getSignupApplication(APP_NAME),
        });
    }, [isLoadingView, signupType]);

    const emailLabel = signupType === SignupType.Username ? c('Signup label').t`Username` : c('Signup label').t`Email`;

    const innerChallenge = (
        <InputFieldTwo
            id="email"
            bigger
            label={emailLabel}
            error={validator(
                signupType === SignupType.Username
                    ? [
                          requiredValidator(trimmedUsername),
                          usernameCharacterValidator(trimmedUsername),
                          usernameLengthValidator(trimmedUsername),
                      ]
                    : [requiredValidator(trimmedEmail), emailValidator(trimmedEmail)]
            )}
            disableChange={loading}
            autoFocus
            inputClassName={hasChallenge ? 'email-input-field' : undefined}
            suffix={(() => {
                if (signupType === SignupType.Email) {
                    /* Something empty to avoid a layout gap when switching */
                    return <></>;
                }
                if (domainOptions.length === 1) {
                    return (
                        <span className="text-ellipsis" title={`@${domain}`}>
                            @{domain}
                        </span>
                    );
                }
                return (
                    <SelectTwo
                        id="select-domain"
                        originalPlacement="bottom-end"
                        anchorRef={anchorRef}
                        size={{ width: DropdownSizeUnit.Static }}
                        unstyled
                        onOpen={() => setRerender({})}
                        onClose={() => setRerender({})}
                        value={domain}
                        onChange={({ value }) => setDomain(value)}
                    >
                        {domainOptions.map((option) => (
                            <Option key={option.value} value={option.value} title={option.text}>
                                @{option.text}
                            </Option>
                        ))}
                    </SelectTwo>
                );
            })()}
            value={signupType === SignupType.Username ? username : email}
            onValue={(() => {
                if (signupType === SignupType.Username) {
                    return (value: string) => {
                        const sanitizedValue = value.replaceAll('@', '');
                        setUsername(sanitizedValue);
                        // If sanitisation happens, force re-render the input with a new value so that the values get removed in the iframe
                        if (sanitizedValue !== value) {
                            flushSync(() => {
                                setUsername(sanitizedValue + ' ');
                            });
                            setUsername(sanitizedValue);
                        }
                    };
                }
                return setEmail;
            })()}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                    // formRef.submit does not trigger handler
                    handleSubmit();
                }
            }}
        />
    );

    if (challengeError) {
        return <ChallengeError />;
    }

    const terms = (
        <Fragment key="terms">
            <br />
            <Href href={getTermsURL(getIsVPNApp(toApp, clientType) ? APPS.PROTONVPN_SETTINGS : undefined)}>{
                // translator: Full sentence "By creating a Proton account, you agree to our terms and conditions"
                c('new_plans: signup').t`terms and conditions`
            }</Href>
        </Fragment>
    );

    const signIn = (
        <Link key="signin" className="link text-nowrap" to={SSO_PATHS.LOGIN}>
            {c('Link').t`Sign in`}
        </Link>
    );

    return (
        <Main>
            <Header
                title={title}
                subTitle={
                    isLoadingView ? (
                        /**
                         * Take up required space whilst loading
                         * and prevent a layout shift in most cases.
                         */
                        <>&#x200b;</>
                    ) : (
                        subTitle
                    )
                }
                onBack={onBack}
            />
            <Content>
                {isLoadingView && (
                    <div className="text-center absolute absolute-center">
                        <Loader />
                    </div>
                )}
                <form
                    name="accountForm"
                    className={isLoadingView ? 'visibility-hidden' : undefined}
                    onSubmit={(e) => {
                        e.preventDefault();
                        return handleSubmit();
                    }}
                    method="post"
                    autoComplete="off"
                    noValidate
                >
                    {/*This is attempting to position at the same place as the select since it's in the challenge iframe*/}
                    <div className="relative">
                        <div
                            ref={anchorRef as any}
                            className="absolute top-custom right-custom"
                            style={{
                                '--right-custom': '6px',
                                '--top-custom': '53px', // Magic values where the select will be
                            }}
                        />
                    </div>
                    <input
                        id="username"
                        name="username"
                        className="visibility-hidden absolute"
                        type="email"
                        autoComplete="username"
                        value={(() => {
                            if (signupType === SignupType.Username) {
                                return trimmedUsername.length ? `${trimmedUsername}@${domain}` : '';
                            }
                            return email;
                        })()}
                        readOnly
                    />
                    {hasChallenge ? (
                        <Challenge
                            bodyClassName="pl0-5 pr0-5"
                            iframeClassName="challenge-width-increase"
                            challengeRef={challengeRefLogin}
                            type={0}
                            title={emailLabel}
                            name="username"
                            onSuccess={() => {
                                setChallengeLoading(false);
                            }}
                            onError={() => {
                                setChallengeLoading(false);
                                setChallengeError(true);
                            }}
                        >
                            {innerChallenge}
                        </Challenge>
                    ) : (
                        innerChallenge
                    )}
                    {signupTypes.includes(SignupType.Email) && signupTypes.length > 1 ? (
                        <div className={clsx('text-center mb1', isLoadingView && 'hidden')}>
                            <InlineLinkButton
                                id="existing-email-button"
                                onClick={() => {
                                    // Reset verification parameters if email is changed
                                    onChangeSignupType(
                                        (() => {
                                            if (signupType === SignupType.Username) {
                                                return SignupType.Email;
                                            }
                                            return signupTypes.find((type) => type !== signupType) || signupType;
                                        })()
                                    );
                                    setUsername('');
                                    setEmail('');
                                }}
                            >
                                {signupType === SignupType.Email
                                    ? c('Action').t`Get a new encrypted email address`
                                    : c('Action').t`Use your current email instead`}
                            </InlineLinkButton>
                            <Info
                                buttonTabIndex={-1}
                                className="ml0-5"
                                title={
                                    signupType === SignupType.Email
                                        ? c('Info')
                                              .t`With an encrypted ${BRAND_NAME} address, you can use all ${BRAND_NAME} services`
                                        : c('Info')
                                              .t`You will need a ${BRAND_NAME} address to use ${MAIL_APP_NAME} and ${CALENDAR_APP_NAME}`
                                }
                            />
                        </div>
                    ) : null}

                    <InputFieldTwo
                        as={PasswordInputTwo}
                        id="password"
                        label={c('Label').t`Password`}
                        assistiveText={passwordInputFocused && getMinPasswordLengthMessage()}
                        error={validator([requiredValidator(password), passwordLengthValidator(password)])}
                        bigger
                        disableChange={loading}
                        autoComplete="new-password"
                        value={password}
                        onValue={setPassword}
                        rootClassName="mt0-5"
                        onFocus={() => setPasswordInputFocused(true)}
                        onBlur={() => setPasswordInputFocused(false)}
                    />

                    <InputFieldTwo
                        as={PasswordInputTwo}
                        id="repeat-password"
                        label={c('Label').t`Repeat password`}
                        error={validator([
                            requiredValidator(password),
                            passwordLengthValidator(confirmPassword),
                            confirmPasswordValidator(confirmPassword, password),
                        ])}
                        bigger
                        disableChange={loading}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onValue={setConfirmPassword}
                        rootClassName="mt0-5"
                    />
                    <Button size="large" color="norm" type="submit" fullWidth loading={loading} className="mt1-5">
                        {c('Action').t`Create account`}
                    </Button>

                    <div className="text-center mt1-25">
                        {
                            // translator: Full sentence "Already have an account? Sign in"
                            c('Go to sign in').jt`Already have an account? ${signIn}`
                        }
                    </div>

                    <hr className="my1-25" />

                    <div className="color-weak text-center text-sm px2 on-tiny-mobile-px0">
                        {
                            // translator: Full sentence "By creating a Proton account, you agree to our terms and conditions"
                            c('new_plans: signup').jt`By creating a ${BRAND_NAME} account, you agree to our ${terms}`
                        }
                    </div>
                </form>
            </Content>
        </Main>
    );
};

export default AccountStep;
