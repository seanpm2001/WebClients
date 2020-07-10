import React, { useState, ChangeEvent } from 'react';
import { c } from 'ttag';
import { Alert, Href, Label, Input, generateUID, useNotifications } from 'react-components';

import { Message } from '../../models/message';
import ComposerInnerModal from './ComposerInnerModal';
import { MessageChange } from './Composer';
import { clearBit, setBit } from 'proton-shared/lib/helpers/bitset';
import { MESSAGE_FLAGS } from '../../constants';

interface Props {
    message?: Message;
    onClose: () => void;
    onChange: MessageChange;
}

const ComposerPasswordModal = ({ message, onClose, onChange }: Props) => {
    const [uid] = useState(generateUID('password-modal'));
    const [password, setPassword] = useState(message?.Password || '');
    const [passwordVerif, setPasswordVerif] = useState(message?.Password || '');
    const [passwordHint, setPasswordHint] = useState(message?.PasswordHint || '');
    const { createNotification } = useNotifications();

    const handleChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
        setter(event.target.value);
    };

    const handleSubmit = () => {
        if (password !== passwordVerif) {
            createNotification({
                type: 'error',
                text: c('Error').t`Message passwords do not match.`
            });
            return;
        }
        onChange(
            (message) => ({
                data: {
                    Flags: setBit(message.data?.Flags, MESSAGE_FLAGS.FLAG_INTERNAL),
                    Password: password,
                    PasswordHint: passwordHint
                }
            }),
            true
        );
        onClose();
    };

    const handleCancel = () => {
        onChange(
            (message) => ({
                data: {
                    Flags: clearBit(message.data?.Flags, MESSAGE_FLAGS.FLAG_INTERNAL),
                    Password: undefined,
                    PasswordHint: undefined
                }
            }),
            true
        );
        onClose();
    };

    const disabled = password === '' || passwordVerif === '';

    return (
        <ComposerInnerModal
            title={c('Info').t`Encrypt for non-ProtonMail users`}
            disabled={disabled}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
        >
            <Alert>
                {c('Info')
                    .t`Encrypted messages to non-ProtonMail recipients will expire in 28 days unless a shorter expiration time is set.`}
                <br />
                <Href url="https://protonmail.com/support/knowledge-base/encrypt-for-outside-users/">
                    {c('Info').t`Learn more`}
                </Href>
            </Alert>
            <div className="flex flex-nowrap mb1 onmobile-flex-column">
                <Label htmlFor={`composer-password-${uid}`}>{c('Info').t`Message Password`}</Label>
                <div className="flex-item-fluid">
                    <Input
                        id={`composer-password-${uid}`}
                        type="password"
                        autoComplete="off"
                        required
                        value={password}
                        onChange={handleChange(setPassword)}
                        placeholder={c('Placeholder').t`Password`}
                    />
                </div>
            </div>
            <div className="flex flex-nowrap mb1 onmobile-flex-column">
                <Label htmlFor={`composer-password-verif-${uid}`}>{c('Info').t`Confirm Password`}</Label>
                <div className="flex-item-fluid">
                    <Input
                        id={`composer-password-verif-${uid}`}
                        type="password"
                        autoComplete="off"
                        required
                        value={passwordVerif}
                        onChange={handleChange(setPasswordVerif)}
                        placeholder={c('Placeholder').t`Confirm Password`}
                    />
                </div>
            </div>
            <div className="flex flex-nowrap mb1 onmobile-flex-column">
                <Label htmlFor={`composer-password-hint-${uid}`}>{c('Info').t`Password Hint (Optional)`}</Label>
                <div className="flex-item-fluid">
                    <Input
                        id={`composer-password-hint-${uid}`}
                        type="text"
                        autoComplete="off"
                        value={passwordHint}
                        onChange={handleChange(setPasswordHint)}
                        placeholder={c('Placeholder').t`Hint`}
                    />
                </div>
            </div>
        </ComposerInnerModal>
    );
};

export default ComposerPasswordModal;
