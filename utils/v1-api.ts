export const allowedTypesConnectionAdd: {
    key: string;
    type: string;
    description: string;
    optinal?: boolean;
    options?: any[];
}[] = [
    {
        key: "server_id",
        type: "string",
        description: "discord server id",
    },
    { key: "user_id", type: "string", description: "discord user id" },
    {
        key: "account_id",
        type: "string",
        description: "discord user id or doras account id",
    },
    {
        key: "type",
        type: "string",
        description: "type of connection",
        options: [
            {
                key: "twitch",
                type: "string",
                description: "twitch connection",
            },
            {
                key: "kick",
                type: "string",
                description: "kick connection",
            },
            {
                key: "youtube_live",
                type: "string",
                description: "youtube live connection",
            },
            {
                key: "youtube_latest",
                type: "string",
                description: "youtube latest connection",
            },
        ],
    },
    {
        key: "channel_id",
        type: "string",
        description: "discord channel id",
    },
    {
        key: "username",
        type: "string",
        description: "username of the connection",
    },
    {
        key: "message",
        type: "string",
        description: "message to send",
    },
    {
        key: "social_links",
        type: "boolean",
        description: "social links",
        optinal: true,
    },
    {
        key: "social_link_url",
        type: "string|null",
        description: "social link url",
        optinal: true,
    },
    {
        key: "keep_vod",
        type: "boolean",
        description: "keep vod",
        optinal: true,
    },
];
export const allowedTypesConnectionEdit: {
    key: string;
    type: string;
    description: string;
    optinal?: boolean;
    options?: any[];
}[] = [
    {
        key: "server_id",
        type: "string",
        description: "discord server id",
    },
    { key: "user_id", type: "string", description: "discord user id" },
    {
        key: "id",
        type: "string",
        description: "connection id",
    },
    {
        key: "type",
        type: "string",
        description: "type of connection",
        options: [
            {
                key: "twitch",
                type: "string",
                description: "twitch connection",
            },
            {
                key: "kick",
                type: "string",
                description: "kick connection",
            },
            {
                key: "youtube_live",
                type: "string",
                description: "youtube live connection",
            },
            {
                key: "youtube_latest",
                type: "string",
                description: "youtube latest connection",
            },
        ],
    },
    {
        key: "channel_id",
        type: "string",
        description: "discord channel id",
    },
    {
        key: "username",
        type: "string",
        description: "username of the connection",
    },
    {
        key: "message",
        type: "string",
        description: "message to send",
    },
    {
        key: "social_links",
        type: "boolean",
        description: "social links",
        optinal: true,
    },
    {
        key: "social_link_url",
        type: "string|null",
        description: "social link url",
        optinal: true,
    },
    {
        key: "keep_vod",
        type: "boolean",
        description: "keep vod",
        optinal: true,
    },
];
export const allowedTypesConnectionRemove: {
    key: string;
    type: string;
    description: string;
    optinal?: boolean;
    options?: any[];
}[] = [
    {
        key: "server_id",
        type: "string",
        description: "discord server id",
    },
    { key: "user_id", type: "string", description: "discord user id" },
    {
        key: "id",
        type: "string",
        description: "connection id",
    },
    {
        key: "type",
        type: "string",
        description: "type of connection",
        options: [
            {
                key: "twitch",
                type: "string",
                description: "twitch connection",
            },
            {
                key: "kick",
                type: "string",
                description: "kick connection",
            },
            {
                key: "youtube_live",
                type: "string",
                description: "youtube live connection",
            },
            {
                key: "youtube_latest",
                type: "string",
                description: "youtube latest connection",
            },
        ],
    },
];

type UpdateField = { field: string; description: string; type: string };
export function validateBodyConnectionAdd(body: any): {
    valid: boolean;
    error?: string;
    fields?: UpdateField[];
} {
    const allUpdateFields = allowedTypesConnectionAdd.map(
        ({ key, type, description }) => ({
            field: key,
            type,
            description,
        })
    );
    const allowedKeys = allowedTypesConnectionAdd.map(({ key }) => key);

    // Check if body is empty
    let result = isBodyEmpty(body, allUpdateFields);
    if (!result.valid) return result;

    // Validate each key in body
    for (const key of Object.keys(body)) {
        result = validateKeyExists(key, allowedKeys, allUpdateFields);
        if (!result.valid) return result;
    }

    // Validate each field's type and nested structure
    for (const {
        key,
        type,
        description,
        optinal,
    } of allowedTypesConnectionAdd) {
        if (!(key in body)) {
            if (!optinal) {
                // If the field is required, return an error that it is missing
                return {
                    valid: false,
                    error: `Missing required field: '${key}'.`,
                    fields: [{ field: key, type, description }],
                };
            }
            continue; // If the field is optional, skip validation
        }
        // Validate field type
        if (type === "string|null") {
            if (body[key] === null || typeof body[key] === "string") {
                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: `Invalid type for field '${key}'. Expected 'string' or 'null', but got '${typeof body[
                        key
                    ]}'.`,
                    fields: [{ field: key, type, description }],
                };
            }
        }
        result = validateType(key, typeof body[key], type, description);
        if (!result.valid) return result;
    }

    return { valid: true };
}
export function validateBodyConnectionEdit(body: any): {
    valid: boolean;
    error?: string;
    fields?: UpdateField[];
} {
    const allUpdateFields = allowedTypesConnectionEdit.map(
        ({ key, type, description }) => ({
            field: key,
            type,
            description,
        })
    );
    const allowedKeys = allowedTypesConnectionEdit.map(({ key }) => key);

    // Check if body is empty
    let result = isBodyEmpty(body, allUpdateFields);
    if (!result.valid) return result;

    // Validate each key in body
    for (const key of Object.keys(body)) {
        result = validateKeyExists(key, allowedKeys, allUpdateFields);
        if (!result.valid) return result;
    }

    // Validate each field's type and nested structure
    for (const {
        key,
        type,
        description,
        optinal,
    } of allowedTypesConnectionEdit) {
        if (!(key in body)) {
            if (!optinal) {
                // If the field is required, return an error that it is missing
                return {
                    valid: false,
                    error: `Missing required field: '${key}'.`,
                    fields: [{ field: key, type, description }],
                };
            }
            continue; // If the field is optional, skip validation
        }

        // Validate field type
        if (type === "string|null") {
            if (body[key] === null || typeof body[key] === "string") {
                return { valid: true };
            } else {
                return {
                    valid: false,
                    error: `Invalid type for field '${key}'. Expected 'string' or 'null', but got '${typeof body[
                        key
                    ]}'.`,
                    fields: [{ field: key, type, description }],
                };
            }
        }
        result = validateType(key, typeof body[key], type, description);
        if (!result.valid) return result;
    }

    return { valid: true };
}
export function validateBodyConnectionRemove(body: any): {
    valid: boolean;
    error?: string;
    fields?: UpdateField[];
} {
    const allUpdateFields = allowedTypesConnectionRemove.map(
        ({ key, type, description }) => ({
            field: key,
            type,
            description,
        })
    );
    const allowedKeys = allowedTypesConnectionRemove.map(({ key }) => key);

    // Check if body is empty
    let result = isBodyEmpty(body, allUpdateFields);
    if (!result.valid) return result;

    // Validate each key in body
    for (const key of Object.keys(body)) {
        result = validateKeyExists(key, allowedKeys, allUpdateFields);
        if (!result.valid) return result;
    }

    // Validate each field's type and nested structure
    for (const {
        key,
        type,
        description,
        optinal,
    } of allowedTypesConnectionRemove) {
        if (!(key in body)) {
            if (!optinal) {
                // If the field is required, return an error that it is missing
                return {
                    valid: false,
                    error: `Missing required field: '${key}'.`,
                    fields: [{ field: key, type, description }],
                };
            }
            continue; // If the field is optional, skip validation
        }

        // Validate field type
        result = validateType(key, typeof body[key], type, description);
        if (!result.valid) return result;
    }

    return { valid: true };
}

// Helper functions for validation
function isBodyEmpty(
    body: any,
    fields: UpdateField[]
): { valid: boolean; error?: string; fields?: UpdateField[] } {
    if (Object.keys(body).length === 0) {
        return {
            valid: false,
            error: "The request body is empty. The following fields can be updated:",
            fields: fields,
        };
    }
    return { valid: true };
}

function validateKeyExists(
    key: string,
    allowedKeys: string[],
    fields: UpdateField[]
): { valid: boolean; error?: string; fields?: UpdateField[] } {
    if (!allowedKeys.includes(key)) {
        return {
            valid: false,
            error: `Invalid key: '${key}'. The following fields can be used:`,
            fields: fields,
        };
    }
    return { valid: true };
}

function validateType(
    fieldKey: string,
    fieldType: string,
    expectedType: string,
    description: string
): { valid: boolean; error?: string; fields?: UpdateField[] } {
    if (fieldType !== expectedType) {
        return {
            valid: false,
            error: `Invalid type for '${fieldKey}'. Expected type below:`,
            fields: [{ field: fieldKey, type: expectedType, description }],
        };
    }
    return { valid: true };
}
