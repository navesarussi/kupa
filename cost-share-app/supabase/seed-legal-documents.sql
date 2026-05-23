-- ============================================================================
-- Seed: initial published versions of Terms of Service & Privacy Policy.
-- One row per (slug, locale). Uses INSERT ... ON CONFLICT to allow re-running.
--
-- NOTE: text values are wrapped in dollar-quoting ($content$...$content$) so
-- Markdown body doesn't need apostrophe-escaping.
-- ============================================================================

-- Use a placeholder for the partnership name until the legal entity is
-- registered; update this row via Supabase Studio post-registration.
-- effective_date should be set to the v1.0 store-submission date before launch.

INSERT INTO public.legal_documents
    (slug, locale, version, title, content_md, effective_date, is_published)
VALUES (
    'terms',
    'en',
    '1.0.0',
    'Terms of Service',
    $content$
# Terms of Service

**Effective date:** {{EFFECTIVE_DATE}}
**Version:** 1.0.0

Welcome to Kupa. These Terms of Service ("Terms") are a binding agreement between you and **[Partnership Name]**, a partnership organized under the laws of the State of Israel ("Kupa", "we", "us"). They govern your use of the Kupa mobile application and any related services (collectively, the "Service").

**Please read these Terms carefully. If you do not agree, do not use the Service.**

## 1. Acceptance of Terms

By creating an account or using the Service, you confirm that you have read, understood, and agreed to be bound by these Terms and by our Privacy Policy. You must be at least **16 years old** to use Kupa. If you are between 16 and 18, you confirm that you have the consent of a parent or legal guardian to use the Service.

## 2. Description of the Service

Kupa is a tool that helps friends and groups **track shared expenses and calculate balances** between members. Kupa **does not process, hold, transfer, or guarantee any money**. We are not a bank, payment processor, money transmitter, or financial institution. All actual payments between users occur outside of the Service.

Kupa makes no representation that calculated balances are free of errors. You are solely responsible for verifying any amount before paying or accepting payment from another user.

## 3. Your Account

You sign in to Kupa using Google. By doing so, you authorize Google to share certain profile information (name, email, profile image) with us, as described in our Privacy Policy.

You agree to: (a) provide accurate, current, and complete information; (b) keep your account secure; (c) not share, transfer, or sell your account; and (d) notify us at sarussilberg@gmail.com of any unauthorized use. You are responsible for all activity that occurs under your account.

## 4. User Content

You may create groups, add expenses, upload receipt images, record settlements, and post other content (collectively, "User Content"). You retain all rights you have in your User Content. By submitting User Content, you grant Kupa a worldwide, non-exclusive, royalty-free license to host, store, reproduce, modify (for technical purposes), and display your User Content **solely for the purpose of operating and providing the Service to you and the other group members you choose to share it with**.

You represent that you have all rights necessary to submit your User Content and that it does not violate any law or third-party right.

## 5. Acceptable Use

You agree **not** to:

- Use the Service for any unlawful, fraudulent, or deceptive purpose.
- Harass, threaten, or impersonate any person.
- Upload content that is illegal, infringing, defamatory, obscene, or hateful.
- Attempt to gain unauthorized access to the Service, other accounts, or our infrastructure.
- Reverse engineer, decompile, or attempt to extract source code, except as permitted by law.
- Scrape, crawl, or use automated means to access the Service without our written consent.
- Use the Service to send spam, advertising, or unsolicited messages.
- Interfere with or disrupt the Service or its security features.

We may suspend or terminate your account if you violate these rules.

## 6. Invite Links & Groups

The Service generates invite links for friends and groups. Anyone with a valid link can preview limited public information (your name, profile image, group name) and may join. **You are responsible for whom you share invite links with.** You can rotate (invalidate and regenerate) an invite link at any time from within the Service.

Joining a group means your name, profile image, and the expenses and settlements you create are visible to all current and future members of that group.

## 7. Third-Party Services

The Service integrates with third-party services, including Google (sign-in), Apple App Store, Google Play, and our infrastructure provider (Supabase). Your use of those services is governed by their own terms and privacy policies. We are not responsible for third-party services.

## 8. Intellectual Property

The Service, including its software, design, trademarks, and branding, is owned by Kupa and its licensors and is protected by intellectual-property laws. Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for your personal, non-commercial use.

## 9. Paid Features (Future)

The Service is currently free. We may introduce optional paid features or subscription plans in the future. Any paid features will be purchased through Apple's or Google's in-app purchase systems and are subject to their billing rules, including auto-renewal, cancellation, and refund policies. We will disclose any pricing and renewal details before you confirm a purchase.

## 10. Advertising (Future)

The Service does not currently display third-party advertising. We may introduce advertising in the future. If we do, we will update our Privacy Policy with details about ad partners, identifiers, and applicable consent mechanisms before advertising is enabled.

## 11. Termination and Account Closure

You may close your account at any time from the Settings screen. Upon closure, your account is marked inactive and your personal profile information is hidden. **However, the expense records, settlements, and group activity you created remain visible to other group members as "Deleted user"**, to preserve the integrity of historical balance calculations. See the Privacy Policy for details.

We may suspend or terminate your access to the Service if you breach these Terms or if we are required to do so by law.

## 12. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY OF BALANCES OR CALCULATIONS. WE ARE NOT A PARTY TO ANY ACTUAL PAYMENT OR TRANSACTION BETWEEN USERS, AND WE DISCLAIM ALL RESPONSIBILITY FOR SUCH PAYMENTS.

## 13. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, KUPA, ITS PARTNERS, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THE SERVICE. OUR AGGREGATE LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE IS LIMITED TO THE GREATER OF (A) THE AMOUNTS YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED ISRAELI SHEKELS (₪100).

Nothing in these Terms limits liability that cannot be limited by applicable law (for example, liability for gross negligence, willful misconduct, or personal injury).

## 14. Indemnification

You agree to indemnify and hold Kupa harmless from any claim, loss, or expense (including reasonable legal fees) arising from your User Content, your use of the Service, or your violation of these Terms or any law.

## 15. Changes to the Terms

We may update these Terms from time to time. For material changes, we will notify you in the Service before the changes take effect. Your continued use of the Service after the effective date of the updated Terms constitutes acceptance of the new Terms.

## 16. Governing Law and Venue

These Terms are governed by the laws of the **State of Israel**, without regard to its conflict-of-law principles. The competent courts located in the **Tel Aviv district** have exclusive jurisdiction over any dispute arising out of or in connection with these Terms or the Service.

## 17. Miscellaneous

- **Severability.** If any provision of these Terms is held unenforceable, the remaining provisions will continue in full force.
- **No waiver.** Our failure to enforce any right is not a waiver of that right.
- **Entire agreement.** These Terms, together with the Privacy Policy, constitute the entire agreement between you and Kupa regarding the Service.
- **Assignment.** You may not assign these Terms; we may assign them in connection with a merger, acquisition, or sale of assets.

## 18. Contact

Questions about these Terms can be sent to **sarussilberg@gmail.com**.
$content$,
    DATE '2026-01-01',
    true
)
ON CONFLICT DO NOTHING;
