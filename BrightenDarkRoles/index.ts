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
    MemberListColors: {
        description: "Replace role colors in the member list.",
        restartNeeded: true,
        type: OptionType.BOOLEAN,
        default: true
    },
});

function lighten(color) {
    if (color) {
        var { hue, saturation, lightness } = hexToHSL(color);
        const newHex = HSLToHex(hue, saturation, 50);
        return newHex
    }
}

function HSLToHex(h, s, l) {
    s /= 100;
    l /= 100;

    var c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r,
        g,
        b;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    // Having obtained RGB, convert channels to hex
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);

    // Prepend 0s, if necessary
    if (r.length == 1)
        r = "0" + r;
    if (g.length == 1)
        g = "0" + g;
    if (b.length == 1)
        b = "0" + b;

    return "#" + r + g + b;
}

function hexToHSL(hexCode: string) {
    // Hex => RGB normalized to 0-1
    const r = parseInt(hexCode.substring(1, 3), 16) / 255;
    const g = parseInt(hexCode.substring(3, 5), 16) / 255;
    const b = parseInt(hexCode.substring(5, 7), 16) / 255;

    // RGB => HSL
    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const delta = cMax - cMin;

    let hue: number, saturation: number, lightness: number;

    lightness = (cMax + cMin) / 2;

    if (delta === 0) {
        // If r=g=b then the only thing that matters is lightness
        hue = 0;
        saturation = 0;
    } else {
        // Magic
        saturation = delta / (1 - Math.abs(2 * lightness - 1));

        if (cMax === r)
            hue = ((g - b) / delta) % 6;
        else if (cMax === g)
            hue = (b - r) / delta + 2;
        else
            hue = (r - g) / delta + 4;
        hue *= 60;
        if (hue < 0)
            hue += 360;
    }

    // Move saturation and lightness from 0-1 to 0-100
    saturation *= 100;
    lightness *= 100;

    return { hue, saturation, lightness };
}

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
                match: /(?<=roleName:\i,)color:/,
                replace: "color:$self.calculateNameColorForListContext(arguments[0]),originalColor:"
            },
            predicate: () => settings.store.MemberListColors
        }
    ],

    calculateNameColorForMessageContext(context: any) {
        const userId: string | undefined = context?.message?.author?.id;
        const colorString = context?.author?.colorString;
        const luminance = calculateNameColorForUser(colorString);

        // Color preview in role settings
        if (context?.message?.channel_id === "1337" && userId === "313337")
            return colorString;

        if (context?.channel?.isPrivate()) {
            return colorString;
        }
        const newColorString = lighten(colorString);

        return (colorString && luminance)
            ? newColorString
            : colorString;
    },
    calculateNameColorForListContext(context: any) {
        const colorString = context?.colorString;
        const luminance = calculateNameColorForUser(colorString);

        if (context?.channel?.isPrivate()) {
            return colorString;
        }
        const newColorString = lighten(colorString);


        return (colorString && luminance)
            ? newColorString
            : colorString;
    }
});
