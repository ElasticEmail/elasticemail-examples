// Shown by FatalErrorBoundary when rendering throws. Redwood's dev server shows the
// stack trace on top of it in development.
const FatalErrorPage = () => (
  <main>
    <h1>Something went wrong</h1>
    <p className="muted">Check the browser console and the server log.</p>
  </main>
);

export default FatalErrorPage;
