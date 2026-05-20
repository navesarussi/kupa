-- Idempotent: public profile-images storage bucket for user avatars

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Profile images are publicly readable" ON storage.objects;
CREATE POLICY "Profile images are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Users can upload own profile image" ON storage.objects;
CREATE POLICY "Users can upload own profile image"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'profile-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update own profile image" ON storage.objects;
CREATE POLICY "Users can update own profile image"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'profile-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete own profile image" ON storage.objects;
CREATE POLICY "Users can delete own profile image"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'profile-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
