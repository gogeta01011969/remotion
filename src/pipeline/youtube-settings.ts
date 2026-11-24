// Shared by local uploads and GitHub Actions. Change privacy to 'public' here
// after private testing; GitHub variables/secrets do not override these settings.
export const youtubeSettings: {uploadEnabled:boolean;privacy:'private'|'unlisted'|'public'} = {
  uploadEnabled: true,
  privacy: 'private',
};
