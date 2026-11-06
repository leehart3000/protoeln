// Who runs this ProtoELN site, and where it's hosted, for its About and Privacy pages and its
// footer (as site.ts in ProtoLIMS). These are protoeln.org's; anyone running ProtoELN elsewhere
// sets their own here (the pages' wording otherwise fits any site).
export const SITE = {
  // Who runs the site, and decides how personal data here is used (the data controller).
  operator: 'Lee Hart',
  // How they run it, completing "This site is run by Lee Hart, …".
  operatorDetail: 'personally, as a non-commercial project in the UK',
  // Where to send privacy questions and requests.
  contactEmail: 'privacy@protoeln.org',
  // Where the site's source code is (the AGPL asks for it to be offered).
  sourceUrl: 'https://gitlab.com/leehart3000/protoeln',
  // Who processes personal data for the site, and what for.
  processors: [
    {
      name: 'Cloudflare',
      role: 'serves the website and runs the application, from its global network, keeps files such as images in entries (in Europe), and forwards email',
    },
    { name: 'MongoDB Atlas', role: 'hosts the database, on AWS in Ireland' },
    { name: 'ORCID', role: 'confirms who you are when you sign in' },
  ],
  // How long the hosts' own logs are kept.
  logsKept: "for the providers' standard periods",
  // Where to complain about how personal data is handled.
  regulator: { name: "the Information Commissioner's Office", url: 'https://ico.org.uk' },
  // When the privacy notice last changed.
  privacyUpdated: '6 November 2026',
}
