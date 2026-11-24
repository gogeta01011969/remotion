// Shared by local uploads and GitHub Actions; environment values do not override these.
// These are clearly animated comparison diagrams, not simulated real-world footage.
export const youtubeSettings: {uploadEnabled:boolean;privacy:'private'|'unlisted'|'public';containsSyntheticMedia:boolean} = {
  uploadEnabled: true,
  privacy: 'public',
  containsSyntheticMedia: false,
};
