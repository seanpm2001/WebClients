import type { OpenedItem } from '../crypto';
import type { ItemType, Metadata, ProtobufContentMap } from '../protobuf';
import type { ExtraField, PlatformSpecific } from '../protobuf/item-v1';

/**
 * Derives a generic "distributive object type" over all possible
 * oneofKind keys - This will allow us to create generic functions
 * and "object mappers" over every item type derived from the original
 * protoc-gen-ts generated types
 *
 * Item types can be extended via an "Extra" type (an object type indexed
 * on ItemType keys) - this will let us create "qualified" generics over
 * the base Item type (see ./items.dto.ts for an example)
 */
export type Item<T extends ItemType = ItemType, ExtraData extends { [K in T]?: any } = never> = {
    [Key in T]: {
        type: Key;
        content: ProtobufContentMap[Key];
        platformSpecific?: PlatformSpecific;
        extraFields: ExtraField[];
        metadata: Metadata;
    } & (ExtraData[Key] extends never ? {} : { extraData: ExtraData[Key] });
}[T];

export enum ItemState {
    Active = 1,
    Trashed = 2,
}

export type ItemRevision<T extends ItemType = ItemType> = Omit<OpenedItem, 'content'> & {
    data: Item<T>;
    shareId: string;
};

/**
 * Adds an optimistic & failed property to
 * the ItemRevision type
 */
export type ItemRevisionWithOptimistic = ItemRevision & { optimistic: boolean; failed: boolean };

/**
 * Generic utility type to construct
 * item key mappers over the different item types
 */
export type ItemMap<T> = {
    [type in ItemType]: T;
};

export type SelectedItem = { shareId: string; itemId: string };
