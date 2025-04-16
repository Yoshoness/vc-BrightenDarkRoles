/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { makeRange } from "@components/PluginSettings/components";

// Calculate a CSS color string based on the user ID
function calculateNameColorForUser(color: string) {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return false;

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const lum = luminance(r, g, b);
    return lum < settings.store.SetLuminanceThreshold / 100;
}

function luminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

const settings = definePluginSettings({
    SetLuminanceThreshold: {
        description: "Set threshold of luminance to be brightened.",
        type: OptionType.SLIDER,
        markers: makeRange(5, 30, 5),
        default: 15
    },
    memberListColors: {
        description: "Replace role colors in the member list",
        restartNeeded: true,
        type: OptionType.BOOLEAN,
        default: true
    },
});

export default definePlugin({
    name: "BrightenDarkRoles",
    description: "Sets hardly visible roles on usernames to white for readability.",
    authors: [{ name: "Yoshoness", id: 206081832289042432n }],
    settings,

    patches: [
        {
            find: '="SYSTEM_TAG"',
            replacement: {
                match: /\i.gradientClassName]\),style:/,
                replace: "$&{color:$self.calculateNameColorForMessageContext(arguments[0])},_style:"
            }
        },
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(typingIndicatorRef:.+?},)(\i=.+?)color:null!=.{0,50}?(?=,)/,
                replace: (_, rest1, rest2) => `${rest1}whiteColor=$self.calculateNameColorForListContext(arguments[0]),${rest2}color:whiteColor`
            },
            predicate: () => settings.store.memberListColors
        }
    ],

    calculateNameColorForMessageContext(context: any) {
        const userId: string | undefined = context?.message?.author?.id;
        const colorString = context?.author?.colorString;
        const luminance = calculateNameColorForUser(context?.author?.colorString);

        // Color preview in role settings
        if (context?.message?.channel_id === "1337" && userId === "313337")
            return colorString;

        if (context?.channel?.isPrivate()) {
            return colorString;
        }

        return (colorString && luminance)
            ? "ffffff"
            : colorString;
    },
    calculateNameColorForListContext(context: any) {
        const id = context?.user?.id;
        const colorString = context?.colorString;
        const luminance = calculateNameColorForUser(context?.colorString);

        if (context?.channel?.isPrivate()) {
            return colorString;
        }

        return (colorString && luminance)
            ? "ffffff"
            : colorString;
    }
});
