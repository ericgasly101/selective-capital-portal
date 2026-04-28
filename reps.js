// Map short URL slugs -> rep email addresses.
// Share each rep their personalized link, e.g.:
//   https://your-app.up.railway.app/upload/js
//   https://your-app.up.railway.app/apply/js
//
// To add or remove a rep, edit this file and redeploy.

const REPS = {
  js:    { email: 'js@selectivecap.com',    name: 'JS' },
  josh:  { email: 'josh@selectivecap.com',  name: 'Josh' },
  ej:    { email: 'ej@selectivecap.com',    name: 'EJ' },
  jenn:  { email: 'jenn@selectivecap.com',  name: 'Jenn' },
  ryan:  { email: 'ryan@selectivecap.com',  name: 'Ryan' },
};

function getRep(slug) {
  if (!slug) return null;
  const key = String(slug).toLowerCase().trim();
  return REPS[key] || null;
}

module.exports = { REPS, getRep };
