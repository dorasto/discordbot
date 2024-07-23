import { ChatInputCommandInteraction, PermissionResolvable } from "discord.js";

export interface PermissionResult {
    result: boolean;
    missing: string[];
}

export async function checkPermissions(
    command: any,
    interaction: ChatInputCommandInteraction
): Promise<PermissionResult> {
    const member = await interaction.guild!.members.fetch({
        user: interaction.client.user!.id,
    });
    const requiredPermissions = command.permissions as PermissionResolvable[];

    if (!command.permissions) return { result: true, missing: [] };

    const missing = member.permissions.missing(requiredPermissions);

    return { result: !Boolean(missing.length), missing };
}
