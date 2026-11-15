export type LegalKind = 'terms' | 'privacy';

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export const LEGAL_UPDATED = '20 October 2026';

export const LEGAL: Record<LegalKind, LegalDoc> = {
  terms: {
    title: 'Terms and conditions',
    updated: LEGAL_UPDATED,
    intro:
      'These terms explain how you may use Rilvona and its university dashboard. By linking your university account or continuing to use the dashboard you agree to them.',
    sections: [
      {
        heading: 'Your Rilvona account',
        body: [
          'You sign in to Rilvona with your Google account. There is no separate password. Ticking the box on the sign in screen and continuing means you agree to these terms and to the privacy policy.',
          'Keep your Google account secure; anything done while signed in to it is treated as done by you.',
        ],
      },
      {
        heading: 'What Rilvona is',
        body: [
          'Rilvona is a student companion app. The university dashboard shows your own attendance, timetable, marks and notices in one place and helps you plan.',
          'Rilvona is an independent project. It is not owned, run, sponsored or endorsed by Chandigarh University.',
        ],
      },
      {
        heading: 'Your university account',
        body: [
          'You may only link an account that belongs to you. Do not use another student’s details.',
          'Linking works by signing in to the university portal (CUIMS) on your behalf, from your phone, with the credentials and captcha you enter. You are responsible for following the university’s own rules for using its portal.',
          'You can unlink at any time from the menu. Unlinking deletes the data Rilvona stored for you and removes your password from your phone.',
        ],
      },
      {
        heading: 'Accuracy and predictions',
        body: [
          'The dashboard copies what the university portal showed at the last refresh. It can be out of date, incomplete or wrong if the portal changes.',
          'Attendance predictions, “classes you can skip” figures and the academic calendar are estimates. They assume your timetable repeats, every class takes place and is recorded, and no classes are added or cancelled. Holidays and dates come from the university’s public website and may change.',
          'Your official attendance, marks and results are the ones on the university portal. Do not rely on Rilvona for decisions about exams, eligibility or shortage of attendance. Check with your department.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not misuse the app: no attempts to break, overload or reverse-engineer it, to access other people’s data, or to use it for anything unlawful.',
          'Do not use Rilvona to bypass the university’s security measures. The captcha is always shown to you to solve yourself.',
        ],
      },
      {
        heading: 'Availability and changes',
        body: [
          'Rilvona is provided as it is, without promises that it will always work or be error free. The university portal can change or block access at any time, which may stop the dashboard from refreshing.',
          'Features may be added, changed or removed. We may update these terms; continuing to use the app after an update means you accept it.',
        ],
      },
      {
        heading: 'Liability',
        body: [
          'To the extent the law allows, Rilvona and its makers are not liable for losses that result from using or being unable to use the app, including decisions you make based on its numbers.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: LEGAL_UPDATED,
    intro:
      'This explains what the Rilvona university dashboard collects, where it goes and how you can remove it.',
    sections: [
      {
        heading: 'Signing in with Google',
        body: [
          'Rilvona uses Google Sign-In. Google gives Rilvona your name, email address and a Google account ID so we can create and recognise your account. We never see your Google password.',
          'Rilvona keeps that name, email and account ID on its servers for as long as your account exists, together with the date you agreed to the terms and privacy policy.',
        ],
      },
      {
        heading: 'Your password',
        body: [
          'Your university password is stored only in your phone’s secure keychain. It is sent only to Chandigarh University’s own servers when you sign in. Rilvona’s servers never receive it.',
          'Signing out of Rilvona keeps it on your phone for your account, so signing back in only needs the captcha. If a different Rilvona account signs in on the phone it is deleted. Unlinking, or choosing “Use a different account”, deletes it too.',
        ],
      },
      {
        heading: 'What Rilvona stores about you',
        body: [
          'When you link your account, the data read from the university portal is saved on Rilvona’s servers so the dashboard can show it: your university ID, name, programme, semester and section, mentor details, profile photo, attendance (including each marked lecture), timetable, marks and portal notices.',
          'The portal session (cookies) used to sign in stays on your phone.',
        ],
      },
      {
        heading: 'Where data is sent',
        body: [
          'From your phone to Google, to sign in to Rilvona. Google’s own privacy policy applies to that step.',
          'From your phone to Chandigarh University’s servers, to sign in and read your records.',
          'From your phone to Rilvona’s servers, to save and show the imported data.',
          'From your phone to the public pages on cuchd.in, to read the holiday list and academic calendar. No personal details are sent for this.',
          'We do not sell your data and we do not show ads. The app contains no advertising or third party analytics or crash reporting tools.',
        ],
      },
      {
        heading: 'Captcha',
        body: [
          'The sign in captcha is shown to you and solved by you. Rilvona does not read it or solve it automatically.',
        ],
      },
      {
        heading: 'On your phone',
        body: [
          'The app keeps some things locally: your saved sign in (in the keychain), the portal session, your exam date sheet (read from the portal and never sent to Rilvona), the last academic calendar it read, and your calendar choice. Uninstalling the app removes them.',
        ],
      },
      {
        heading: 'Deleting your data',
        body: [
          'Open the menu and choose “Unlink account”. That deletes the university data Rilvona stored for you and removes your password, portal session and saved date sheet from your phone.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'If this policy changes, the new version will appear here with a new date.',
        ],
      },
    ],
  },
};
