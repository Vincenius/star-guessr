export function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: May 24, 2026</p>

      <section className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">TL;DR</h2>
        <p className="text-sm text-gray-600">
          This site uses a self-hosted version of{' '}
          <a href="https://umami.is" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Umami
          </a>{' '}
          for anonymous visit counting — no cookies, no personal data. If you submit a score to the leaderboard, your chosen nickname and score are stored on the server. Game state (daily progress, personal best) is stored only in your browser's localStorage. No account, no email, no tracking.
        </p>
      </section>

      <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Who is responsible</h2>
          <p>
            Vincent Will<br />
            <a href="mailto:hello@vincentwill.com" className="text-blue-600 hover:underline">hello@vincentwill.com</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data we collect</h2>

          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Analytics (Umami)</h3>
          <p>
            This site uses a self-hosted instance of Umami to count page visits. Umami does not use cookies and anonymizes all data — your IP address is never stored. The only information collected is the page visited, referrer, browser type, and approximate country. You can opt out via your browser's "Do Not Track" setting or an ad blocker such as uBlock Origin.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Leaderboard</h3>
          <p>
            If you choose to submit your score to the leaderboard, the nickname you enter and your total score are stored in a database on the server. No IP address or other identifying information is associated with this entry. Submission is entirely voluntary.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-1">Browser storage (localStorage)</h3>
          <p>
            Your browser stores game state locally (daily progress, session tokens, personal best scores) so you can resume a game and avoid replaying the same daily challenge. This data never leaves your device and is not accessible to the server.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-1">GitHub API</h3>
          <p>
            Repository data is fetched from the GitHub API. No personal data is sent to GitHub on your behalf. Refer to{' '}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              GitHub's Privacy Statement
            </a>{' '}
            for details on how they handle API requests.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data sharing</h2>
          <p>
            No personal data is sold or shared with third parties. Leaderboard entries (nickname + score) are publicly visible on the leaderboard page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data retention</h2>
          <p>
            Leaderboard entries are retained indefinitely as they form the public high-score table. localStorage data persists in your browser until you clear it. You can delete your local data at any time through your browser's developer tools or settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your rights</h2>
          <p>
            Under the GDPR you have the right to access, rectify, or erase personal data held about you. Since leaderboard entries contain only a freely chosen nickname (not your real name), they are generally not considered personal data. If you believe an entry can be linked to you and wish to have it removed, contact{' '}
            <a href="mailto:hello@vincentwill.com" className="text-blue-600 hover:underline">hello@vincentwill.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Changes to this policy</h2>
          <p>
            This policy may be updated occasionally. The date at the top of this page reflects the most recent revision.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact</h2>
          <p>
            Questions or requests:{' '}
            <a href="mailto:hello@vincentwill.com" className="text-blue-600 hover:underline">hello@vincentwill.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
