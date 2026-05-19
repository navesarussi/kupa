/**
 * Supabase Storage helpers for mobile uploads
 */

import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

const GROUP_IMAGES_BUCKET = 'group-images';

function extensionFromUri(uri: string): string {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1]?.toLowerCase() ?? 'jpg';
}

function contentTypeFromExtension(ext: string): string {
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
}

// fetch(localUri).blob() is unreliable in React Native; read via expo-file-system
// and hand Supabase a Uint8Array, which it accepts directly.
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function uploadGroupImage(
    groupId: string,
    localUri: string
): Promise<string | null> {
    const ext = extensionFromUri(localUri);
    const path = `${groupId}/avatar.${ext}`;
    const contentType = contentTypeFromExtension(ext);

    const base64 = await new File(localUri).base64();
    const bytes = base64ToBytes(base64);

    const { error } = await supabase.storage
        .from(GROUP_IMAGES_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });

    if (error) {
        console.error('Failed to upload group image:', error.message);
        return null;
    }

    const { data } = supabase.storage
        .from(GROUP_IMAGES_BUCKET)
        .getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
}
