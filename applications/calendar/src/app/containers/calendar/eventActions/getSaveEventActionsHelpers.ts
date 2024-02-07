import { ICAL_METHOD } from '@proton/shared/lib/calendar/constants';
import { getBase64SharedSessionKey } from '@proton/shared/lib/calendar/crypto/keys/helpers';
import { getInviteVeventWithUpdatedParstats } from '@proton/shared/lib/calendar/mailIntegration/invite';
import { omit } from '@proton/shared/lib/helpers/object';
import { SyncMultipleApiResponse, VcalVeventComponent } from '@proton/shared/lib/interfaces/calendar';
import { GetCalendarKeys } from '@proton/shared/lib/interfaces/hooks/GetCalendarKeys';

import { INVITE_ACTION_TYPES, InviteActions, OnSendPrefsErrors, SendIcs } from '../../../interfaces/Invite';
import {
    SyncEventActionOperations,
    getCreateSyncOperation,
    getUpdateSyncOperation,
} from '../getSyncMultipleEventsPayload';
import { getAddedAttendeesPublicKeysMap, getCorrectedSaveInviteActions } from './inviteActions';

/**
 * Helper that saves in the DB an intermediate event without attendees, taking into account send preferences errors
 * in the process (i.e. removing attendees with send preferences errors when possible).
 *
 * This intermediate event is needed when creating invitations as we need to get a SharedEventID from the API
 * before sending out the ICS's
 */
export const createIntermediateEvent = async ({
    inviteActions,
    vevent,
    hasDefaultNotifications,
    calendarID,
    addressID,
    memberID,
    getCalendarKeys,
    onSendPrefsErrors,
    handleSyncActions,
}: {
    inviteActions: InviteActions;
    vevent: VcalVeventComponent;
    hasDefaultNotifications: boolean;
    calendarID: string;
    addressID: string;
    memberID: string;
    getCalendarKeys: GetCalendarKeys;
    onSendPrefsErrors: OnSendPrefsErrors;
    handleSyncActions: (actions: SyncEventActionOperations[]) => Promise<SyncMultipleApiResponse[]>;
}) => {
    const { inviteActions: cleanInviteActions, vevent: cleanVevent } = await onSendPrefsErrors({
        inviteActions,
        vevent,
    });

    const createIntermediateOperation = getCreateSyncOperation({
        veventComponent: omit(cleanVevent, ['attendee']),
        hasDefaultNotifications,
    });
    const syncIntermediateActions = [
        {
            calendarID,
            addressID,
            memberID,
            operations: [createIntermediateOperation],
        },
    ];

    const [
        {
            Responses: [
                {
                    Response: { Event: intermediateEvent },
                },
            ],
        },
    ] = await handleSyncActions(syncIntermediateActions);

    if (!intermediateEvent) {
        throw new Error('Failed to generate intermediate event');
    }

    const sharedSessionKey = await getBase64SharedSessionKey({
        calendarEvent: intermediateEvent,
        getCalendarKeys,
    });

    if (sharedSessionKey) {
        cleanInviteActions.sharedEventID = intermediateEvent.SharedEventID;
        cleanInviteActions.sharedSessionKey = sharedSessionKey;
    }

    return { intermediateEvent, vevent: cleanVevent, inviteActions: cleanInviteActions };
};

export const getCorrectedSendInviteData = async ({
    newVevent,
    oldVevent,
    inviteActions,
    hasModifiedDateTimes,
    onEquivalentAttendees,
    isCreatingSingleEdit,
}: {
    newVevent: VcalVeventComponent;
    oldVevent: VcalVeventComponent;
    inviteActions: InviteActions;
    hasModifiedDateTimes?: boolean;
    onEquivalentAttendees: (veventComponent: VcalVeventComponent, inviteActions: InviteActions) => Promise<void>;
    isCreatingSingleEdit?: boolean;
}) => {
    const correctedSaveInviteActions = getCorrectedSaveInviteActions({
        inviteActions,
        newVevent,
        oldVevent,
        hasModifiedDateTimes,
    });
    if (isCreatingSingleEdit && correctedSaveInviteActions.type === INVITE_ACTION_TYPES.SEND_UPDATE) {
        // We are creating a single edit, which is like creating a new event, not updating an existing one
        correctedSaveInviteActions.type = INVITE_ACTION_TYPES.SEND_INVITATION;
    }
    await onEquivalentAttendees(newVevent, correctedSaveInviteActions);
    const isSendInviteType = [INVITE_ACTION_TYPES.SEND_INVITATION, INVITE_ACTION_TYPES.SEND_UPDATE].includes(
        correctedSaveInviteActions.type
    );

    const method = isSendInviteType ? ICAL_METHOD.REQUEST : undefined;
    const correctedVevent = getInviteVeventWithUpdatedParstats(newVevent, oldVevent, method);

    return { vevent: correctedVevent, inviteActions: correctedSaveInviteActions, isSendInviteType };
};

/**
 * Helper that produces the update sync operation needed when the organizer
 * creates a single edit for an invitation series.
 */
export const getUpdateInviteOperationWithIntermediateEvent = async ({
    inviteActions,
    vevent,
    oldVevent,
    hasDefaultNotifications,
    calendarID,
    addressID,
    memberID,
    getCalendarKeys,
    sendIcs,
    onSendPrefsErrors,
    handleSyncActions,
}: {
    inviteActions: InviteActions;
    vevent: VcalVeventComponent;
    oldVevent: VcalVeventComponent;
    hasDefaultNotifications: boolean;
    calendarID: string;
    addressID: string;
    memberID: string;
    getCalendarKeys: GetCalendarKeys;
    sendIcs: SendIcs;
    onSendPrefsErrors: OnSendPrefsErrors;
    handleSyncActions: (actions: SyncEventActionOperations[]) => Promise<SyncMultipleApiResponse[]>;
}) => {
    const {
        intermediateEvent,
        vevent: intermediateVevent,
        inviteActions: intermediateInviteActions,
    } = await createIntermediateEvent({
        inviteActions,
        vevent,
        hasDefaultNotifications,
        calendarID,
        addressID,
        memberID,
        getCalendarKeys,
        onSendPrefsErrors,
        handleSyncActions,
    });
    const {
        veventComponent: finalVevent,
        inviteActions: finalInviteActions,
        sendPreferencesMap,
    } = await sendIcs(
        {
            inviteActions: intermediateInviteActions,
            vevent: intermediateVevent,
            cancelVevent: oldVevent,
            noCheckSendPrefs: true,
        },
        // we pass the calendarID here as we want to call the event manager in case the operation fails
        calendarID
    );

    const addedAttendeesPublicKeysMap = getAddedAttendeesPublicKeysMap({
        veventComponent: finalVevent,
        inviteActions: finalInviteActions,
        sendPreferencesMap,
    });

    return getUpdateSyncOperation({
        veventComponent: finalVevent,
        calendarEvent: intermediateEvent,
        hasDefaultNotifications,
        isAttendee: false,
        addedAttendeesPublicKeysMap,
    });
};
